const VID = 0x2e8a;
const PID = 0x0003;
const INTERFACE_CLASS = 255; // Vendor-specific interface class

const FLASH_ERASE_CMD = 0x03;
const FLASH_WRITE_CMD = 0x05;
const ENTER_XIP_CMD = 0x07;
const EXIT_XIP_CMD = 0x06;
const EXCLUSIVE_CMD = 0x01;
const REBOOT_CMD = 0x02;
const USER_TOKEN = 0xFEFE;
const MAGIC_NUM = 0x431fd10b;

let picoDevice;
let interfaceNumber = null;
let endpointOut = null;
let endpointIn = null;

var userToken = 1;
function getUserToken() {
    var ret = userToken;
    userToken += 1;
    userToken %= 0xFFFFFFFF;
    return ret;
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

    setAddressOnlyCmd(dAddr) {
        const view = new DataView(this.args);
        view.setUint32(0, dAddr, true);
        this.bCmdSize = 4;
    }

    // Used for write/read
    setRangeCmd(dAddr, dSize) {
        const view = new DataView(this.args);
        view.setUint32(0, dAddr, true);
        view.setUint32(4, dSize, true);
        this.bCmdSize = 8;
    }

    setExec2Cmd(imageBase, imageSize, workareaBase, workareaSize) {
        const view = new DataView(this.args);
        view.setUint32(0, imageBase, true);
        view.setUint32(4, imageSize, true);
        view.setUint32(8, workareaBase, true);
        view.setUint32(12, workareaSize, true);
        this.bCmdSize = 16;
    }

    setExclusiveCmd(bExclusive) {
        const view = new DataView(this.args);
        view.setUint8(0, bExclusive);
        this.bCmdSize = 1;
    }

    setOtpCmd(wRow, wRowCount, bEcc) {
        const view = new DataView(this.args);
        view.setUint16(0, wRow, true);
        view.setUint16(2, wRowCount, true);
        view.setUint8(4, bEcc);
        this.bCmdSize = 5;
    }

    setGetInfoCmd(bType, bParam, wParam, dParams) {
        const view = new DataView(this.args);
        view.setUint8(0, bType);
        view.setUint8(1, bParam);
        view.setUint16(2, wParam, true);
        view.setUint32(4, dParams[0], true);
        view.setUint32(8, dParams[1], true);
        view.setUint32(12, dParams[2], true);
        this.bCmdSize = 16;
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

async function pico_exit_bootloader_attempt()
{
    console.log("Attempting pico bootloader exit.");

    try {
        picoDevice = await navigator.usb.requestDevice({ filters: [{ vendorId: VID, productId: PID }] });
        await picoDevice.open();

        // Find and claim the specific interface
        await findAndClaimInterface(picoDevice);

        // Reboot the device
        await rebootDevice();

        document.getElementById('status').innerText = 'Flashing complete. Device rebooted.';

        return true;
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('status').innerText = `Error: ${error.message}`;
    }
}

// Pass through our file data
// BIN format only!
async function pico_update_attempt_flash(url, checksum)
{
    let binData = null;
    // First, try to download the appropriate file
    let gotBinOK = false;

    let furl = url + ".bin";

    try {
        // Fetch the binary file
        const response = await fetch(furl);
        if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        binData = await response.arrayBuffer();
    
        // Calculate SHA-256 checksum
        const hashBuffer = await crypto.subtle.digest('SHA-256', binData);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const calculatedChecksum = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
        // Compare checksums
        if(calculatedChecksum.toLowerCase() === checksum.toLowerCase())
        {
            console.log("Bin retrieved and file verified...");
            gotBinOK = true;
        }
        else
        {
            console.error("BIN checksum failure");
            gotBinOK = false;
        }
    } catch (error) {
        console.error('Error verifying checksum:', error);
        gotBinOK = false;
    }


    try {
        picoDevice = await navigator.usb.requestDevice({ filters: [{ vendorId: VID, productId: PID }] });
        await picoDevice.open();

        // Find and claim the specific interface
        await findAndClaimInterface(picoDevice);

        if (interfaceNumber === null) {
            document.getElementById('status').innerText = 'Failed to find the correct interface.';
            return false;
        }

        if(gotBinOK)
        {
            await markExclusive(true);

            showToast("Updating...");

            // Flash the firmware
            await writeFlash(binData, binData.byteLength);
        }
        else
        {
            showToast("Failed to get FW file. Continue to reboot.");
        }

        // Reboot the device
        await rebootDevice();

        document.getElementById('status').innerText = 'Flashing complete. Device rebooted.';

        return true;
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('status').innerText = `Error: ${error.message}`;
    }
}

async function findAndClaimInterface(dev) {
    const configurations = await dev.configurations;

    for (const configuration of configurations) {
        for (const iface of configuration.interfaces) {
            if (iface.alternate.interfaceClass === INTERFACE_CLASS) {
                interfaceNumber = iface.interfaceNumber;
                endpointOut = iface.alternate.endpoints.find(e => e.direction === 'out');
                endpointIn = iface.alternate.endpoints.find(e => e.direction === 'in');

                await dev.selectConfiguration(configuration.configurationValue);
                await dev.claimInterface(interfaceNumber);

                console.log(`Claimed interface ${interfaceNumber} with endpoints OUT: ${endpointOut.endpointNumber}, IN: ${endpointIn.endpointNumber}`);
                return;
            }
        }
    }
}

async function markExclusive(exclusive) {
    console.log("Marking device exclusive");
    const cmd = new PicobootCmd(EXCLUSIVE_CMD, 0);
    cmd.setExclusiveCmd(0x02);
    const output = cmd.toUint8Array();

    let result = await picoDevice.transferOut(endpointOut.endpointNumber, output);
    console.log("Cmd sent:", result);
    result = await picoDevice.transferIn(endpointIn.endpointNumber, 1);
    console.log("Cmd sent confirm:", result);

    await exitXip();
}

async function eraseFlash(address, size) {
    const sectorSize = 4096;
    let eraseSize = 512 * sectorSize;
    let token = getUserToken();

    const eraseCommand = new ArrayBuffer(32);
    const view = new DataView(eraseCommand);
    view.setUint32(0x00, MAGIC_NUM, true);  // Magic number
    view.setUint32(0x04, token, true);       // User Token
    view.setUint8(0x08, FLASH_ERASE_CMD);    // Command ID
    view.setUint8(0x09, 0x08);               // Cmd size
    view.setUint16(0x0A, 0, true);           // Reserved
    view.setUint32(0x0C, 0, true);           // Transfer length
    view.setUint32(0x10, 0x10000000, true);  // Flash address to erase
    view.setUint32(0x14, eraseSize, true);   // Size to erase

    console.log("Sending erase...");

    let result = await picoDevice.transferOut(endpointOut.endpointNumber, eraseCommand);
    if (result.status == 'ok') {
        console.log("eraseFlash SENT");
    }

    result = await picoDevice.transferIn(endpointIn.endpointNumber, 0);  // Read empty IN packet to confirm erase
    if (result.status == 'ok') {
        console.log("eraseFlash CONFIRMED");
    }
}

async function exitXip() {
    console.log("Exit XIP");
    var cmd = new PicobootCmd(EXIT_XIP_CMD, 0);
    var output = cmd.toUint8Array();

    let result = await picoDevice.transferOut(endpointOut.endpointNumber, output);
    console.log("Cmd sent:", result);
    result = await picoDevice.transferIn(endpointIn.endpointNumber, 1);
    console.log("Cmd sent exit XIP:", result);
}

async function writeFlash(data, size) {
    console.log("Attempt write data");

    const pageSize = 4096;
    const totalPages = Math.ceil(size / pageSize);
    var addr = 0x10000000;

    const dataView = new Uint8Array(data);

    for (let i = 0; i < totalPages; i++) {
        console.log("Chunk erasing ", i);

        const ecmd = new PicobootCmd(FLASH_ERASE_CMD, 0);
        ecmd.setRangeCmd(addr, pageSize);
        const ecmdOutput = ecmd.toUint8Array();

        let eresult = await picoDevice.transferOut(endpointOut.endpointNumber, ecmdOutput);
        console.log("Data erased:", eresult);
        eresult = await picoDevice.transferIn(endpointIn.endpointNumber, 1);  // Read empty IN packet to confirm write
        console.log("Confirm erase:", i);

        await exitXip();

        console.log("Chunk sending ", i);

        let chunk = dataView.subarray(i * pageSize, (i + 1) * pageSize);

        // If this is the last chunk and it's not full, pad it with zeros
        if (i === totalPages - 1 && chunk.length < pageSize) {
            const paddedChunk = new Uint8Array(pageSize);
            paddedChunk.set(chunk);
            // The rest of paddedChunk will be filled with zeros by default
            chunk = paddedChunk;
        }

        const cmd = new PicobootCmd(FLASH_WRITE_CMD, pageSize);
        cmd.setRangeCmd(addr, pageSize);
        const cmdOutput = cmd.toUint8Array();

        let result = await picoDevice.transferOut(endpointOut.endpointNumber, cmdOutput);
        console.log("Data sent:", result);

        result = await picoDevice.transferOut(endpointOut.endpointNumber, chunk);
        result = await picoDevice.transferIn(endpointIn.endpointNumber, 1);  // Read empty IN packet to confirm write
        console.log("Confirm write:", i);

        await exitXip();

        addr += pageSize;
    }
}

async function rebootDevice() {

    console.log("Exit XIP");
    var cmd = new PicobootCmd(REBOOT_CMD, 0);
    cmd.setRebootCmd(0, 0x20042000, 500);
    var output = cmd.toUint8Array();

    let result = await picoDevice.transferOut(endpointOut.endpointNumber, output);
    console.log("Cmd sent:", result);
    result = await picoDevice.transferIn(endpointIn.endpointNumber, 1);
    console.log("Cmd sent exit XIP:", result);
}
