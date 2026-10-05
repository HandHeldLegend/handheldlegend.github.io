/**
 * picoboot.js — Flash RP2040/RP2350 controllers from the browser.
 *
 * Ported from hoja2/js/pico_update.js with the protocol logic unchanged; the only change is that
 * progress is reported through onFlashProgress() instead of writing to page elements.
 *
 * Strategy (pico_update_attempt_flash):
 *   1. download .bin (+ verify SHA-256 against the build manifest) and .uf2 in parallel;
 *   2. try PICOBOOT over WebUSB (vendor interface on the BOOTSEL device) — fastest, no file dialogs;
 *   3. fall back to writing the UF2 onto the RPI-RP2 / RP2350 mass-storage drive via the
 *      File System Access folder picker (needs a user click → returned as needsUserAction);
 *   4. last resort: manual UF2 download.
 *
 * Status messages are translated (t); errors that the wizard displays keep English text marked with
 * N_() so updater.js can still match on them and translates them when shown.
 *
 * PICOBOOT protocol reference: Raspberry Pi pico-bootrom (picoboot.h) — commands below.
 */
import { t, N_ } from '../i18n/index.js';

const VID = 0x2e8a;
const BOOTLOADER_PIDS = [0x0003, 0x000f];
const INTERFACE_CLASS = 255; // Vendor-specific interface class

const FLASH_ERASE_CMD = 0x03;
const FLASH_WRITE_CMD = 0x05;
const EXIT_XIP_CMD = 0x06;
const EXCLUSIVE_CMD = 0x01;
const REBOOT_CMD = 0x02;
const REBOOT2_CMD = 0x0a;
const MAGIC_NUM = 0x431fd10b;

let picoDevice;
let interfaceNumber = null;
let endpointOut = null;
let endpointIn = null;
let activeBootloaderIs2350 = false;

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

function isRp2350Bootloader(device) {
    return device?.vendorId === VID && device?.productId === 0x000f;
}

async function usbTransferOut(endpointNumber, data, timeoutMs = 1500, label = 'USB OUT') {
    if (timeoutMs == null) {
        return picoDevice.transferOut(endpointNumber, data);
    }
    return withTimeout(
        picoDevice.transferOut(endpointNumber, data),
        timeoutMs,
        label
    );
}

async function usbTransferIn(endpointNumber, length, timeoutMs = 1500, label = 'USB IN') {
    if (timeoutMs == null) {
        return picoDevice.transferIn(endpointNumber, length);
    }
    return withTimeout(
        picoDevice.transferIn(endpointNumber, length),
        timeoutMs,
        label
    );
}

/** Progress listener: fn({ percent, message, flashing }). Set by the firmware wizard. */
let progressListener = null;
export function onFlashProgress(fn) {
    progressListener = fn;
}

function updateProgress(percent, isFlashing = false, message = null) {
    percent = Math.max(0, Math.min(100, percent));
    if (!message) {
        message = isFlashing
            ? (percent === 100 ? t('Firmware update complete!') : t('Flashing firmware...'))
            : (percent === 100 ? t('Download complete') : t('Downloading firmware...'));
    }
    if (progressListener) progressListener({ percent, message, flashing: isFlashing });
    else console.log(`[picoboot] ${Math.round(percent)}% ${message}`);
}

export function setUpdateStatus(message, percent = null, isFlashing = false) {
    if (percent == null) {
        if (progressListener) progressListener({ percent: null, message, flashing: isFlashing });
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

    setReboot2Cmd(dFlags, dDelayMS, dParam0, dParam1) {
        const view = new DataView(this.args);
        view.setUint32(0, dFlags, true);
        view.setUint32(4, dDelayMS, true);
        view.setUint32(8, dParam0, true);
        view.setUint32(12, dParam1, true);
        this.bCmdSize = 16;
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

async function downloadFirmware(url, label = t('Downloading firmware...')) {
    updateProgress(10, false, label);
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    updateProgress(40, false, label);
    const data = await response.arrayBuffer();
    updateProgress(70, false, t('Download complete'));
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
    activeBootloaderIs2350 = false;
}

/**
 * Request the Pico bootloader and claim the Picoboot vendor interface.
 * Prefers an already-authorized device from getDevices() so no picker is needed.
 * @param {{ allowRequestDevice?: boolean }} [options]
 * @returns {{ ok: true } | { ok: false, canceled: boolean, needsPermission: boolean, claimFailed?: boolean, error?: Error }}
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
        activeBootloaderIs2350 = isRp2350Bootloader(picoDevice);
        if (!picoDevice.opened) {
            await withTimeout(picoDevice.open(), claimTimeoutMs, 'USB open');
        }
        await withTimeout(findAndClaimInterface(picoDevice), claimTimeoutMs, 'USB claim');
        if (interfaceNumber === null) {
            throw new Error('Vendor interface not found');
        }
        return { ok: true };
    };

    const failClaim = (error, { canceled = false, needsPermission = false } = {}) => ({
        ok: false,
        canceled,
        needsPermission,
        claimFailed: true,
        error,
    });

    // Already-permitted Pico (e.g. after a connect event) — no user gesture required
    let hadKnownDevice = false;
    try {
        const existing = await navigator.usb.getDevices();
        const known = existing.find((d) =>
            d.vendorId === VID && BOOTLOADER_PIDS.includes(d.productId)
        );
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

    // Known device already failed claim — only skip requestDevice on auto-flow (no user gesture)
    if (hadKnownDevice && !allowRequestDevice) {
        return failClaim(new Error('Picoboot interface unavailable'));
    }

    try {
        updateProgress(0, true, t('Select the Pico bootloader in the browser popup...'));
        const device = await navigator.usb.requestDevice({
            filters: BOOTLOADER_PIDS.map((productId) => ({ vendorId: VID, productId })),
        });
        return await tryOpenAndClaim(device);
    } catch (error) {
        console.error('Picoboot claim failed:', error);
        await closePicoDevice();
        return failClaim(error, { canceled: isUserCancelled(error) });
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
        throw new Error(N_('Folder picker is blocked here. Use https or http://localhost (not a raw IP).'));
    }

    updateProgress(0, true, t('Waiting for folder selection...'));

    let dirHandle;
    try {
        dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    } catch (error) {
        if (isUserCancelled(error)) throw error;
        const msg = String(error?.message || error);
        if (error?.name === 'SecurityError' || msg.toLowerCase().includes('security policy')) {
            throw new Error(N_('Folder picker blocked by browser security policy. Use https or http://localhost.'));
        }
        throw error;
    }

    // Confirm this looks like a Pico bootloader volume
    try {
        await dirHandle.getFileHandle('INFO_UF2.TXT');
    } catch (_) {
        throw new Error(N_('That folder is not a Pico boot drive. Look for INFO_UF2.TXT on RPI-RP2 or RP2350 and try again.'));
    }

    updateProgress(30, true, t('Writing UF2 to RPI-RP2...'));

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

    updateProgress(100, true, t('UF2 written. Device should reboot.'));
    return true;
}

/**
 * Complete a previously staged UF2 write (firmware already downloaded).
 */
export async function pico_complete_uf2_picker_flash() {
    if (!cachedUf2ForPicker) {
        throw new Error(N_('No firmware ready. Click Update to prepare the file again.'));
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
    updateProgress(100, false, t('Firmware ready - select the RPI-RP2 or RP2350 drive next.'));
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

    updateProgress(0, false, t('Preparing firmware...'));

    // WebUSB + File System Access require a secure context.
    // If not secure, we can still provide the UF2 download link.
    if (window.isSecureContext !== true) {
        updateProgress(0, false, t('This page is not in a secure context. Falling back to UF2 download.'));
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
            downloadFirmware(binUrl, t('Downloading firmware...')),
            downloadFirmware(uf2Url, t('Downloading firmware...')),
        ]);

        if (binResult.status === 'fulfilled') {
            binData = binResult.value;
            if (checksum) {
                updateProgress(85, false, t('Verifying firmware...'));
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
            updateProgress(0, false, t('Failed to download firmware.'));
            return false;
        }

        updateProgress(100, false, t('Firmware ready'));
    } catch (error) {
        console.error('Error downloading firmware:', error);
        updateProgress(0, false, t('Failed to download firmware.'));
        return false;
    }

    await new Promise((resolve) => setTimeout(resolve, 200));

    // --- Try Picoboot / WebUSB first (falls back to UF2 if claim fails or times out) ---
    if (binData && binVerified) {
        updateProgress(0, true, t('Connecting to Pico bootloader...'));
        const claimTimeoutMs = isWindowsHost() ? 1000 : 5000;
        const claim = await pico_try_claim_bootloader({
            allowRequestDevice,
            claimTimeoutMs,
        });

        if (claim.ok) {
            let flashSucceeded = false;
            try {
                await markExclusive(true);
                await writeFlashWithProgress(binData, binData.byteLength);
                flashSucceeded = true;
            } catch (error) {
                console.error('Picoboot flash failed:', error);
                await closePicoDevice();
                // Fall through to UF2 path only when flash itself failed
            }

            if (flashSucceeded) {
                try {
                    await rebootDevice();
                } catch (rebootError) {
                    // Device often disconnects before the reboot ack arrives.
                    console.warn('Reboot ack missed (device likely rebooted):', rebootError);
                }
                updateProgress(100, true, t('Firmware update complete!'));
                console.log('Flashing complete. Device rebooted.');
                return true;
            }
        } else if (claim.needsPermission && !allowRequestDevice) {
            // May still stage UF2 below if we already have the file
            if (!(uf2Data && supportsDirectoryPicker())) {
                updateProgress(0, false, t('Click Update to authorize the bootloader device.'));
                return { needsUserAction: true, reason: 'permission' };
            }
            setUpdateStatus(t('Direct update unavailable. Use RPI-RP2 next...'));
        } else if (!claim.canceled) {
            setUpdateStatus(t('Direct update unavailable. Use RPI-RP2 next...'));
        } else {
            updateProgress(0, false, t('Device selection canceled.'));
            return false;
        }
    }

    // --- UF2 fallback: stage for a guided picker step (same for update + install) ---
    if (uf2Data && supportsDirectoryPicker()) {
        return stageUf2Picker(uf2Data, uf2Url);
    }

    // --- Manual download last resort (not treated as flash success) ---
    if (uf2Url) {
        updateProgress(0, false, t('Download the UF2 and copy it to the RPI-RP2 drive.'));
        return { needsUserAction: true, reason: 'manual-download', uf2Url };
    }

    updateProgress(0, false, t('Update failed.'));
    return false;
}

export async function pico_exit_bootloader_attempt() {
    console.log('Attempting pico bootloader exit.');
    updateProgress(0, true, t('Connecting to bootloader to restart...'));

    const claimTimeoutMs = isWindowsHost() ? 1000 : 5000;
    const claim = await pico_try_claim_bootloader({
        allowRequestDevice: true,
        claimTimeoutMs,
    });
    if (!claim.ok) {
        if (claim.canceled) {
            updateProgress(0, false, t('Device selection canceled.'));
        } else {
            updateProgress(0, false, t('Could not restart via Picoboot. Unplug/replug the device.'));
        }
        return false;
    }

    try {
        updateProgress(50, true, t('Restarting device...'));
        try {
            await rebootDevice();
        } catch (rebootError) {
            console.warn('Reboot ack missed (device likely rebooted):', rebootError);
        }
        updateProgress(100, true, t('Device restarted.'));
        return true;
    } catch (error) {
        console.error('Error:', error);
        await closePicoDevice();
        updateProgress(0, false, t('Restart failed.'));
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

    let result = await usbTransferOut(endpointOut.endpointNumber, output, 1500, 'exclusive access');
    console.log('Cmd sent:', result);
    result = await usbTransferIn(endpointIn.endpointNumber, 1, 1500, 'exclusive access ack');
    console.log('Cmd sent confirm:', result);

    await exitXip();
}

async function exitXip() {
    // EXIT_XIP is documented as a no-op on RP2350.
    if (activeBootloaderIs2350) {
        return;
    }
    console.log('Exit XIP');
    var cmd = new PicobootCmd(EXIT_XIP_CMD, 0);
    var output = cmd.toUint8Array();

    let result = await usbTransferOut(endpointOut.endpointNumber, output, 1500, 'exit xip');
    console.log('Cmd sent:', result);
    result = await usbTransferIn(endpointIn.endpointNumber, 1, 1500, 'exit xip ack');
    console.log('Cmd sent exit XIP:', result);
}

const FLASH_TRANSFER_TIMEOUT_MS = 30000;

async function writeFlashWithProgress(data, size) {
    console.log('Attempt write data with progress tracking');

    const pageSize = 4096;
    const totalPages = Math.ceil(size / pageSize);
    var addr = 0x10000000;

    const dataView = new Uint8Array(data);

    updateProgress(0, true, t('Flashing firmware...'));

    for (let i = 0; i < totalPages; i++) {
        const progressPercent = (i / totalPages) * 100;
        updateProgress(progressPercent, true, t('Flashing firmware...'));

        const ecmd = new PicobootCmd(FLASH_ERASE_CMD, 0);
        ecmd.setRangeCmd(addr, pageSize);
        const ecmdOutput = ecmd.toUint8Array();

        let eresult = await usbTransferOut(endpointOut.endpointNumber, ecmdOutput, FLASH_TRANSFER_TIMEOUT_MS, `erase ${i}`);
        console.log('Data erased:', eresult);
        eresult = await usbTransferIn(endpointIn.endpointNumber, 1, FLASH_TRANSFER_TIMEOUT_MS, `erase ${i} ack`);
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

        let result = await usbTransferOut(endpointOut.endpointNumber, cmdOutput, FLASH_TRANSFER_TIMEOUT_MS, `write cmd ${i}`);
        console.log('Data sent:', result);

        result = await usbTransferOut(endpointOut.endpointNumber, chunk, FLASH_TRANSFER_TIMEOUT_MS, `write data ${i}`);
        result = await usbTransferIn(endpointIn.endpointNumber, 1, FLASH_TRANSFER_TIMEOUT_MS, `write ${i} ack`);
        console.log('Confirm write:', i);

        await exitXip();

        addr += pageSize;

        const finalProgressPercent = ((i + 1) / totalPages) * 100;
        updateProgress(finalProgressPercent, true, t('Flashing firmware...'));
    }

    updateProgress(100, true, t('Firmware update complete!'));
}

async function rebootDevice() {
    console.log('Reboot device');
    const is2350 = activeBootloaderIs2350 || isRp2350Bootloader(picoDevice);
    var cmd = new PicobootCmd(is2350 ? REBOOT2_CMD : REBOOT_CMD, 0);
    if (is2350) {
        // RP2350 normal reboot uses REBOOT2 with flags=0
        cmd.setReboot2Cmd(0, 500, 0, 0);
    } else {
        cmd.setRebootCmd(0, 0x20042000, 500);
    }
    var output = cmd.toUint8Array();

    await usbTransferOut(endpointOut.endpointNumber, output, 3000, 'reboot');
    try {
        await usbTransferIn(endpointIn.endpointNumber, 1, 2000, 'reboot ack');
    } catch (error) {
        // Expected when the device reboots and disconnects before the ack is read.
        console.warn('Reboot ack not received:', error);
    }
}
