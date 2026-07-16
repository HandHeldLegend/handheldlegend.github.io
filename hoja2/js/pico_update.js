const VID = 0x2e8a;
const PID = 0x0003;
const INTERFACE_CLASS = 255; // Vendor-specific interface class

const FLASH_ERASE_CMD = 0x03;
const FLASH_WRITE_CMD = 0x05;
const EXIT_XIP_CMD = 0x06;
const EXCLUSIVE_CMD = 0x01;
const REBOOT_CMD = 0x02;
const MAGIC_NUM = 0x431fd10b;

let picoDevice;
let interfaceNumber = null;
let endpointOut = null;
let endpointIn = null;

/** Cached UF2 payload when Picoboot fails and we need a staged folder-picker step */
let cachedUf2ForPicker = null;
let cachedUf2Url = null;

var userToken = 1;
function getUserToken() {
    var ret = userToken;
    userToken += 1;
    userToken %= 0xFFFFFFFF;
    return ret;
}

export function supportsDirectoryPicker() {
    // File System Access API requires a secure context (https or localhost).
    return typeof window.showDirectoryPicker === 'function' && window.isSecureContext === true;
}

function isWindowsHost() {
    const ua = navigator.userAgent.toLowerCase();
    return ua.includes('windows') || ua.includes('win32') || ua.includes('win64') || ua.includes('wow64');
}

function withTimeout(promise, ms, label = 'operation') {
    let timer;
    return Promise.race([
        promise.finally(() => clearTimeout(timer)),
        new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
        }),
    ]);
}

function updateProgress(percent, isFlashing = false, message = null) {
    const progressBar = document.getElementById('progressBar');
    const statusText = document.getElementById('statusText');
    const percentage = document.getElementById('percentage');

    if (!progressBar || !statusText || !percentage) {
        console.log(`Progress: ${Math.round(percent)}% ${message || ''}`);
        return;
    }

    percent = Math.max(0, Math.min(100, percent));
    progressBar.style.width = percent + '%';

    if (isFlashing) {
        progressBar.classList.add('flashing');
    } else {
        progressBar.classList.remove('flashing');
    }

    percentage.textContent = Math.round(percent) + '%';

    if (message) {
        statusText.textContent = message;
        return;
    }

    if (isFlashing) {
        statusText.textContent = percent === 100
            ? 'Firmware update complete!'
            : 'Flashing firmware...';
    } else {
        statusText.textContent = percent === 100
            ? 'Download complete'
            : 'Downloading firmware...';
    }
}

export function setUpdateStatus(message, percent = null, isFlashing = false) {
    if (percent == null) {
        const statusText = document.getElementById('statusText');
        if (statusText) statusText.textContent = message;
        else console.log(message);
        return;
    }
    updateProgress(percent, isFlashing, message);
}

class PicobootCmd {
    constructor(cmdId, transferLength = 0) {
        this.dMagic = MAGIC_NUM;
        this.dToken = getUserToken();
        this.bCmdId = cmdId;
        this.bCmdSize = 0;
        this._unused = 0;
        this.dTransferLength = transferLength;
        this.args = new ArrayBuffer(16);
    }

    setRebootCmd(dPC, dSP, dDelayMS) {
        const view = new DataView(this.args);
        view.setUint32(0, dPC, true);
        view.setUint32(4, dSP, true);
        view.setUint32(8, dDelayMS, true);
        this.bCmdSize = 12;
    }

    setRangeCmd(dAddr, dSize) {
        const view = new DataView(this.args);
        view.setUint32(0, dAddr, true);
        view.setUint32(4, dSize, true);
        this.bCmdSize = 8;
    }

    setExclusiveCmd(bExclusive) {
        const view = new DataView(this.args);
        view.setUint8(0, bExclusive);
        this.bCmdSize = 1;
    }

    toUint8Array() {
        const buffer = new ArrayBuffer(32);
        const view = new DataView(buffer);

        view.setUint32(0, this.dMagic, true);
        view.setUint32(4, this.dToken, true);
        view.setUint8(8, this.bCmdId);
        view.setUint8(9, this.bCmdSize);
        view.setUint16(10, this._unused, true);
        view.setUint32(12, this.dTransferLength, true);

        const argsView = new Uint8Array(this.args);
        new Uint8Array(buffer, 16, 16).set(argsView);

        return new Uint8Array(buffer);
    }
}

function isUserCancelled(error) {
    if (!error) return false;
    const name = error.name || '';
    return name === 'NotFoundError' || name === 'AbortError';
}

function convertUf2ToBinUrl(url) {
    if (!url) return url;
    const match = url.toLowerCase().lastIndexOf('.uf2');
    if (match === -1) return url;
    return url.slice(0, match) + '.bin';
}

function ensureUf2Url(url) {
    if (!url) return url;
    if (url.toLowerCase().endsWith('.uf2')) return url;
    if (url.toLowerCase().endsWith('.bin')) {
        return url.slice(0, -4) + '.uf2';
    }
    return url;
}

async function sha256Hex(buffer) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

async function downloadFirmware(url, label = 'Downloading firmware...') {
    updateProgress(10, false, label);
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    updateProgress(40, false, label);
    const data = await response.arrayBuffer();
    updateProgress(70, false, 'Download complete');
    return data;
}

async function closePicoDevice() {
    if (!picoDevice) return;
    try {
        if (interfaceNumber != null && picoDevice.opened) {
            await picoDevice.releaseInterface(interfaceNumber);
        }
    } catch (_) { /* ignore */ }
    try {
        if (picoDevice.opened) await picoDevice.close();
    } catch (_) { /* ignore */ }
    picoDevice = null;
    interfaceNumber = null;
    endpointOut = null;
    endpointIn = null;
}

/**
 * Request the Pico bootloader and claim the Picoboot vendor interface.
 * Prefers an already-authorized device from getDevices() so no picker is needed.
 * @param {{ allowRequestDevice?: boolean }} [options]
 * @returns {{ ok: true } | { ok: false, cancelled: boolean, needsPermission: boolean, claimFailed?: boolean, error?: Error }}
 */
export async function pico_try_claim_bootloader(options = {}) {
    const allowRequestDevice = options.allowRequestDevice !== false;
    // claimInterface can hang forever on Windows when WinUSB is not bound
    const claimTimeoutMs = options.claimTimeoutMs ?? 2000;
    interfaceNumber = null;
    endpointOut = null;
    endpointIn = null;

    const tryOpenAndClaim = async (device) => {
        picoDevice = device;
        if (!picoDevice.opened) {
            await withTimeout(picoDevice.open(), claimTimeoutMs, 'USB open');
        }
        await withTimeout(findAndClaimInterface(picoDevice), claimTimeoutMs, 'USB claim');
        if (interfaceNumber === null) {
            throw new Error('Vendor interface not found');
        }
        return { ok: true };
    };

    const failClaim = (error, { cancelled = false, needsPermission = false } = {}) => ({
        ok: false,
        cancelled,
        needsPermission,
        claimFailed: true,
        error,
    });

    // Already-permitted Pico (e.g. after a connect event) — no user gesture required
    let hadKnownDevice = false;
    try {
        const existing = await navigator.usb.getDevices();
        const known = existing.find((d) => d.vendorId === VID && d.productId === PID);
        if (known) {
            hadKnownDevice = true;
            try {
                return await tryOpenAndClaim(known);
            } catch (error) {
                console.warn('Could not claim known Pico bootloader:', error);
                await closePicoDevice();
                // Do not pop another USB picker — fall through to UF2
                return failClaim(error, {
                    needsPermission: !allowRequestDevice,
                });
            }
        }
    } catch (error) {
        console.warn('getDevices failed:', error);
    }

    if (!allowRequestDevice) {
        return failClaim(
            new Error('Bootloader present but not claimable without a user gesture'),
            { needsPermission: true }
        );
    }

    // Known device already failed claim — skip requestDevice, use UF2
    if (hadKnownDevice) {
        return failClaim(new Error('Picoboot interface unavailable'));
    }

    try {
        updateProgress(0, true, 'Select the Pico bootloader in the browser popup...');
        const device = await navigator.usb.requestDevice({
            filters: [{ vendorId: VID, productId: PID }],
        });
        return await tryOpenAndClaim(device);
    } catch (error) {
        console.error('Picoboot claim failed:', error);
        await closePicoDevice();
        return failClaim(error, { cancelled: isUserCancelled(error) });
    }
}

/**
 * Write a UF2 image to the RPI-RP2 drive via the File System Access API.
 * Call this only after the UI has shown instructions — the OS picker covers the page.
 */
function isExpectedUf2EjectError(error) {
    const msg = String(error?.message || error).toLowerCase();
    const name = error?.name || '';
    // After a UF2 write the Pico reboots and unmounts RPI-RP2 mid-close.
    return (
        name === 'AbortError' ||
        name === 'NotFoundError' ||
        name === 'InvalidStateError' ||
        msg.includes('aborted') ||
        msg.includes('security policy') ||
        msg.includes('not found') ||
        msg.includes('no such file') ||
        msg.includes('the requesting window')
    );
}

export async function pico_write_uf2_via_picker(uf2Data) {
    if (!supportsDirectoryPicker()) {
        throw new Error('Folder picker is blocked here. Use https or http://localhost (not a raw IP).');
    }

    updateProgress(0, true, 'Waiting for folder selection...');

    let dirHandle;
    try {
        dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    } catch (error) {
        if (isUserCancelled(error)) throw error;
        const msg = String(error?.message || error);
        if (error?.name === 'SecurityError' || msg.toLowerCase().includes('security policy')) {
            throw new Error('Folder picker blocked by browser security policy. Use https or http://localhost.');
        }
        throw error;
    }

    // Confirm this looks like a Pico bootloader volume
    try {
        await dirHandle.getFileHandle('INFO_UF2.TXT');
    } catch (_) {
        throw new Error('That folder is not RPI-RP2. Look for INFO_UF2.TXT and try again.');
    }

    updateProgress(30, true, 'Writing UF2 to RPI-RP2...');

    const fileHandle = await dirHandle.getFileHandle('firmware.uf2', { create: true });
    const writable = await fileHandle.createWritable();

    try {
        await writable.write(uf2Data);
    } catch (error) {
        // Write can also abort if the volume ejects very quickly — treat as success.
        if (!isExpectedUf2EjectError(error)) {
            try { await writable.abort(); } catch (_) { /* ignore */ }
            throw error;
        }
        console.warn('UF2 write ended with expected eject error (device likely rebooted):', error);
    }

    try {
        await writable.close();
    } catch (error) {
        // Expected: Pico reboots as soon as the UF2 lands and the drive disappears.
        console.warn('UF2 close after write (expected if device rebooted):', error);
    }

    cachedUf2ForPicker = null;
    cachedUf2Url = null;

    updateProgress(100, true, 'UF2 written. Device should reboot.');
    return true;
}

/**
 * Complete a previously staged UF2 write (firmware already downloaded).
 */
export async function pico_complete_uf2_picker_flash() {
    if (!cachedUf2ForPicker) {
        throw new Error('No firmware ready. Click Update to prepare the file again.');
    }
    return pico_write_uf2_via_picker(cachedUf2ForPicker);
}

export function pico_has_cached_uf2() {
    return !!cachedUf2ForPicker;
}

export function pico_get_cached_uf2_url() {
    return cachedUf2Url;
}

function stageUf2Picker(uf2Data, uf2Url) {
    cachedUf2ForPicker = uf2Data;
    cachedUf2Url = uf2Url;
    updateProgress(100, false, 'Firmware ready — select the RPI-RP2 drive next.');
    return { needsUserAction: true, reason: 'directory-picker' };
}

/**
 * Flash firmware: try Picoboot/WebUSB first, fall back to UF2 directory picker,
 * then to a manual UF2 download.
 *
 * @param {string} url Firmware URL (.uf2 or .bin)
 * @param {string|null} checksum Optional SHA-256 of the .bin image
 * @param {{ allowRequestDevice?: boolean }} [options]
 * @returns {Promise<boolean|{ needsUserAction: true, reason: string }>}
 */
export async function pico_update_attempt_flash(url, checksum = null, options = {}) {
    const allowRequestDevice = options.allowRequestDevice !== false;
    const uf2Url = ensureUf2Url(url);
    const binUrl = convertUf2ToBinUrl(uf2Url);

    updateProgress(0, false, 'Preparing firmware...');

    // WebUSB + File System Access require a secure context.
    // If not secure, we can still provide the UF2 download link.
    if (window.isSecureContext !== true) {
        updateProgress(0, false, 'This page is not in a secure context. Falling back to UF2 download.');
        if (uf2Url) {
            return { needsUserAction: true, reason: 'manual-download', uf2Url };
        }
        return false;
    }

    let binData = null;
    let uf2Data = null;
    let binVerified = false;

    try {
        const [binResult, uf2Result] = await Promise.allSettled([
            downloadFirmware(binUrl, 'Downloading firmware...'),
            downloadFirmware(uf2Url, 'Downloading firmware...'),
        ]);

        if (binResult.status === 'fulfilled') {
            binData = binResult.value;
            if (checksum) {
                updateProgress(85, false, 'Verifying firmware...');
                const calculated = await sha256Hex(binData);
                binVerified = calculated.toLowerCase() === checksum.toLowerCase();
                if (!binVerified) {
                    console.error('BIN checksum failure');
                    binData = null;
                }
            } else {
                binVerified = true;
            }
        } else {
            console.warn('BIN download failed:', binResult.reason);
        }

        if (uf2Result.status === 'fulfilled') {
            uf2Data = uf2Result.value;
        } else {
            console.warn('UF2 download failed:', uf2Result.reason);
        }

        if (!binData && !uf2Data) {
            updateProgress(0, false, 'Failed to download firmware.');
            return false;
        }

        updateProgress(100, false, 'Firmware ready');
    } catch (error) {
        console.error('Error downloading firmware:', error);
        updateProgress(0, false, 'Failed to download firmware.');
        return false;
    }

    await new Promise((resolve) => setTimeout(resolve, 200));

    // Windows: Picoboot claim often hangs (no WinUSB). Prefer UF2 immediately when available.
    const preferUf2 =
        isWindowsHost() && uf2Data && supportsDirectoryPicker();

    // --- Try Picoboot / WebUSB ---
    if (binData && binVerified && !preferUf2) {
        updateProgress(0, true, 'Connecting to Pico bootloader...');
        const claim = await pico_try_claim_bootloader({
            allowRequestDevice,
            claimTimeoutMs: 2000,
        });

        if (claim.ok) {
            try {
                await markExclusive(true);
                await writeFlashWithProgress(binData, binData.byteLength);
                await rebootDevice();
                updateProgress(100, true, 'Firmware update complete!');
                console.log('Flashing complete. Device rebooted.');
                return true;
            } catch (error) {
                console.error('Picoboot flash failed:', error);
                await closePicoDevice();
                // Fall through to UF2 path
            }
        } else if (claim.needsPermission && !allowRequestDevice) {
            // May still stage UF2 below if we already have the file
            if (!(uf2Data && supportsDirectoryPicker())) {
                updateProgress(0, false, 'Click Update to authorize the bootloader device.');
                return { needsUserAction: true, reason: 'permission' };
            }
            setUpdateStatus('Direct update unavailable. Use RPI-RP2 next...');
        } else {
            // claimFailed, cancelled USB picker, timeout, etc.
            setUpdateStatus('Direct update unavailable. Use RPI-RP2 next...');
        }
    } else if (preferUf2) {
        setUpdateStatus('Preparing RPI-RP2 update method...');
    }

    // --- UF2 fallback: stage for a guided picker step (same for update + install) ---
    if (uf2Data && supportsDirectoryPicker()) {
        return stageUf2Picker(uf2Data, uf2Url);
    }

    // --- Manual download last resort (not treated as flash success) ---
    if (uf2Url) {
        updateProgress(0, false, 'Download the UF2 and copy it to the RPI-RP2 drive.');
        return { needsUserAction: true, reason: 'manual-download', uf2Url };
    }

    updateProgress(0, false, 'Update failed.');
    return false;
}

export async function pico_exit_bootloader_attempt() {
    console.log('Attempting pico bootloader exit.');
    updateProgress(0, true, 'Connecting to bootloader to restart...');

    const claim = await pico_try_claim_bootloader({ allowRequestDevice: true });
    if (!claim.ok) {
        if (claim.cancelled) {
            updateProgress(0, false, 'Device selection cancelled.');
        } else {
            updateProgress(0, false, 'Could not restart via Picoboot. Unplug/replug the device.');
        }
        return false;
    }

    try {
        updateProgress(50, true, 'Restarting device...');
        await rebootDevice();
        updateProgress(100, true, 'Device restarted.');
        return true;
    } catch (error) {
        console.error('Error:', error);
        await closePicoDevice();
        updateProgress(0, false, 'Restart failed.');
        return false;
    }
}

async function findAndClaimInterface(dev) {
    const configurations = await dev.configurations;

    for (const configuration of configurations) {
        for (const iface of configuration.interfaces) {
            if (iface.alternate.interfaceClass === INTERFACE_CLASS) {
                interfaceNumber = iface.interfaceNumber;
                endpointOut = iface.alternate.endpoints.find((e) => e.direction === 'out');
                endpointIn = iface.alternate.endpoints.find((e) => e.direction === 'in');

                await dev.selectConfiguration(configuration.configurationValue);
                await dev.claimInterface(interfaceNumber);

                console.log(
                    `Claimed interface ${interfaceNumber} with endpoints OUT: ${endpointOut.endpointNumber}, IN: ${endpointIn.endpointNumber}`
                );
                return;
            }
        }
    }
}

async function markExclusive(exclusive) {
    console.log('Marking device exclusive');
    const cmd = new PicobootCmd(EXCLUSIVE_CMD, 0);
    cmd.setExclusiveCmd(0x02);
    const output = cmd.toUint8Array();

    let result = await picoDevice.transferOut(endpointOut.endpointNumber, output);
    console.log('Cmd sent:', result);
    result = await picoDevice.transferIn(endpointIn.endpointNumber, 1);
    console.log('Cmd sent confirm:', result);

    await exitXip();
}

async function exitXip() {
    console.log('Exit XIP');
    var cmd = new PicobootCmd(EXIT_XIP_CMD, 0);
    var output = cmd.toUint8Array();

    let result = await picoDevice.transferOut(endpointOut.endpointNumber, output);
    console.log('Cmd sent:', result);
    result = await picoDevice.transferIn(endpointIn.endpointNumber, 1);
    console.log('Cmd sent exit XIP:', result);
}

async function writeFlashWithProgress(data, size) {
    console.log('Attempt write data with progress tracking');

    const pageSize = 4096;
    const totalPages = Math.ceil(size / pageSize);
    var addr = 0x10000000;

    const dataView = new Uint8Array(data);

    updateProgress(0, true, 'Flashing firmware...');

    for (let i = 0; i < totalPages; i++) {
        const progressPercent = (i / totalPages) * 100;
        updateProgress(progressPercent, true, 'Flashing firmware...');

        const ecmd = new PicobootCmd(FLASH_ERASE_CMD, 0);
        ecmd.setRangeCmd(addr, pageSize);
        const ecmdOutput = ecmd.toUint8Array();

        let eresult = await picoDevice.transferOut(endpointOut.endpointNumber, ecmdOutput);
        console.log('Data erased:', eresult);
        eresult = await picoDevice.transferIn(endpointIn.endpointNumber, 1);
        console.log('Confirm erase:', i);

        await exitXip();

        let chunk = dataView.subarray(i * pageSize, (i + 1) * pageSize);

        if (i === totalPages - 1 && chunk.length < pageSize) {
            const paddedChunk = new Uint8Array(pageSize);
            paddedChunk.set(chunk);
            chunk = paddedChunk;
        }

        const cmd = new PicobootCmd(FLASH_WRITE_CMD, pageSize);
        cmd.setRangeCmd(addr, pageSize);
        const cmdOutput = cmd.toUint8Array();

        let result = await picoDevice.transferOut(endpointOut.endpointNumber, cmdOutput);
        console.log('Data sent:', result);

        result = await picoDevice.transferOut(endpointOut.endpointNumber, chunk);
        result = await picoDevice.transferIn(endpointIn.endpointNumber, 1);
        console.log('Confirm write:', i);

        await exitXip();

        addr += pageSize;

        const finalProgressPercent = ((i + 1) / totalPages) * 100;
        updateProgress(finalProgressPercent, true, 'Flashing firmware...');
    }

    updateProgress(100, true, 'Firmware update complete!');
}

async function rebootDevice() {
    console.log('Reboot device');
    var cmd = new PicobootCmd(REBOOT_CMD, 0);
    cmd.setRebootCmd(0, 0x20042000, 500);
    var output = cmd.toUint8Array();

    let result = await picoDevice.transferOut(endpointOut.endpointNumber, output);
    console.log('Cmd sent:', result);
    result = await picoDevice.transferIn(endpointIn.endpointNumber, 1);
    console.log('Cmd reboot confirm:', result);
}
