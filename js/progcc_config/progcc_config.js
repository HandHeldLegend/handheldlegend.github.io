let device = null;
let connectButtonElement = document.getElementById("connectButton");
let disconnectButtonElement = document.getElementById("disconnectButton");

let menuToggles = document.getElementsByClassName("toggle");
let menuToggleLabels = document.getElementsByClassName("lbl-toggle");
let selectedToggle = null;

const FIRMWARE_VERSION = 0x0A08;

const WEBUSB_CMD_FW_SET = 0x0F;
const WEBUSB_CMD_FW_GET = 0xAF;

const WEBUSB_CMD_RGB_SET = 0x01;
const WEBUSB_CMD_RGB_GET = 0xA1;

const WEBUSB_CMD_SNAPBACK_SET = 0x02;
const WEBUSB_CMD_SNAPBACK_GET = 0xA2;

const WEBUSB_CMD_CALIBRATION_START = 0x03;
const WEBUSB_CMD_CALIBRATION_STOP = 0xA3;

const WEBUSB_CMD_ANALYZE_START = 0x05;
const WEBUSB_CMD_ANALYZE_STOP = 0xA5;

const WEBUSB_CMD_REMAP_SET = 0x06;
const WEBUSB_CMD_REMAP_GET = 0xA6;

const WEBUSB_CMD_REMAP_DEFAULT = 0x07;

const WEBUSB_CMD_GCSP_SET = 0x08;

const WEBUSB_CMD_IMU_CALIBRATION_START = 0x09;

const WEBUSB_CMD_OCTAGON_SET = 0x04;

const WEBUSB_CMD_INPUT_REPORT = 0xE0;

const WEBUSB_CMD_SAVEALL = 0xF1;

const INPUT_MODE_SWITCH = 0;
const INPUT_MODE_XINPUT = 1;
const INPUT_MODE_GAMECUBE = 2;
const INPUT_MODE_N64 = 3;
const INPUT_MODE_SNES = 4;

enableMenus(false);

/** This code works only on properly formatted PWAs **/
var beforeInstallPrompt = null;

window.addEventListener("beforeinstallprompt", eventHandler, errorHandler);

function eventHandler(event) {
    beforeInstallPrompt = event;
    document.getElementById("installButton").removeAttribute("disabled");
}

function errorHandler(event) {
    console.log("error: " + event);
}

function installButton() {
    if (beforeInstallPrompt) {
        beforeInstallPrompt.prompt();
    }
    else {
        console.log("Already installed.");
    }
}

async function sendReport(reportID, data) {
    var dataOut1 = [reportID];
    var dataOut = new Uint8Array(dataOut1.concat(data));

    await device.transferOut(2, dataOut);
}

const listen = async () => {
    if (device != null) {
        try {
            const result = await device.transferIn(2, 64);

            switch (result.data.getUint8(0)) {

                case WEBUSB_CMD_CALIBRATION_START:
                    analog_start_calibration_confirm();
                    break;

                case WEBUSB_CMD_CALIBRATION_STOP:
                    analog_stop_calibration_confirm();
                    break;

                case WEBUSB_CMD_ANALYZE_STOP:
                    console.log("Got waveform for analysis.");
                    let nu = new Uint8Array(result.data.buffer, result.data.byteOffset, result.data.byteLength);
                    snapback_visualizer_plot(nu);
                    break;

                case WEBUSB_CMD_SNAPBACK_GET:
                    snapback_place_values(result.data);
                    break;

                case WEBUSB_CMD_SAVEALL:
                    console.log("Got Settings Saved OK.");
                    window.alert("Saved Settings.");
                    break;

                case WEBUSB_CMD_RGB_GET:
                    console.log("Got RGB Values.");
                    color_place_values(result.data);
                    break;

                case WEBUSB_CMD_REMAP_GET:
                    console.log("Got remap values.");
                    remap_place_values(result.data);
                    break;

                case WEBUSB_CMD_FW_GET:
                    console.log("Got FW version.");
                    fw_check_value(result.data);
                    break;

                case WEBUSB_CMD_INPUT_REPORT:
                    input_process_data(result.data);
                    break;
            }
        }
        catch (err) {

        }
    };}

    // Set connect and disconnect listeners
    navigator.usb.addEventListener("connect", (event) => {
        console.log("Device plugged.");

    });

    navigator.usb.addEventListener("disconnect", (event) => {
        console.log("Device unplugged.");
        if (event.device == device) {
            device = null;
            enableDisconnect(false);
            enableMenus(false);
        }
    });

    async function disconnectButton() {
        if (device != null) {
            clearInterval(listen_id);
            await device.close();
        }
        enableDisconnect(false);
        enableMenus(false);
    }

    var listen_id = null;

    async function connectButton() {

        var devices = await navigator.usb.getDevices({ filters: [{ vendorId: 0x057E, productId: 0x2009 }] });

        if (devices[0]) {
            console.log("Already got device.");
            device = devices[0];
        }
        else {
            console.log("Need device permission or not found.");
            // Request permission to access the ProGCC
            device = await navigator.usb.requestDevice({ filters: [{ vendorId: 0x057E, productId: 0x2009 }] });
        }

        if (device != null) {

            try {
                await device.open();
                await device.selectConfiguration(1);
                await device.claimInterface(1);
 
                await fw_get_value();
                enableDisconnect(true);

                listen_id = setInterval(() => {

                    try {
                        listen();
                    }
                    catch (err) {

                    }
                }, 8);
            }
            catch (error) {
                window.alert("Please connect a valid ProGCC device.");
            }



        }
    }

    async function saveButton() {
        var dataOut = new Uint8Array([WEBUSB_CMD_SAVEALL]);
        await device.transferOut(2, dataOut);
    }

    async function fwButton() {
        var dataOut = new Uint8Array([WEBUSB_CMD_FW_SET]);
        await device.transferOut(2, dataOut);
    }

    async function fw_get_value()
    {
        var dataOut = new Uint8Array([WEBUSB_CMD_FW_GET]);
        await device.transferOut(2, dataOut);
    }

    function fw_display_box(enable)
    {
        if(enable)
        {
            document.getElementById("ood").removeAttribute("disabled");
        }
        else 
        {
            document.getElementById("ood").setAttribute("disabled", "true");
        }
    }

    function fw_check_value(data)
    {
        var fw = (data.getUint8(1) << 8) | (data.getUint8(2));

        // REMOVE LATER
        if (fw == FIRMWARE_VERSION-1)
        {
            fw_display_box(true);
            enableMenus(true);
            remap_get_values();
            color_get_values();
        }
        // REMOVE LATER END
        else if (fw != FIRMWARE_VERSION)
        {
            console.log("Version mismatch. Current: " + FIRMWARE_VERSION + " | Rec: " + fw);
            fw_display_box(true)
        }
        else
        {
            try {
                fw_display_box(false)
                enableMenus(true);
                remap_get_values();
                color_get_values();
            }
            catch(err)
            {

            }
        }
    }

    function setActiveMenu(id) {
        if (id == selectedToggle) {
            return;
        }
        if (selectedToggle != null) {
            document.getElementById(selectedToggle).checked = false;
        }
        selectedToggle = id;
    }

    function enableDisconnect(enable)
    {
        if(enable)
        {
            // Disable connect button
            connectButtonElement.setAttribute('disabled', 'true');

            // Enable disconnect button
            disconnectButtonElement.removeAttribute('disabled');
        }
        else
        {
            // Disable disconnect button
            disconnectButtonElement.setAttribute('disabled', 'true');

            // Enable connect button
            connectButtonElement.removeAttribute('disabled');
        }
    }

    function enableMenus(enable) {
        if (enable) {
            Array.from(menuToggles).forEach(element => {
                element.removeAttribute('disabled');
                element.setAttribute('onclick', "setActiveMenu(this.id)");
            });

            Array.from(menuToggleLabels).forEach(element => {
                element.removeAttribute('disabled');
            });
        }
        else {
            Array.from(menuToggles).forEach(element => {
                if (element.id == "socials-qr") return;
                element.setAttribute('disabled', 'true');
                element.checked = false;
            });

            Array.from(menuToggleLabels).forEach(element => {
                if (element.id == "socials-toggle") return;
                element.setAttribute('disabled', 'true');
            });
        }

        analog_stop_calibration_confirm();
    }