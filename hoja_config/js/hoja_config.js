let device = null;
let connectButtonElement = document.getElementById("connectButton");
let disconnectButtonElement = document.getElementById("disconnectButton");

let menuToggles = document.getElementsByClassName("toggle");
let menuToggleLabels = document.getElementsByClassName("lbl-toggle");
let selectedToggle = null;

const WEBUSB_CMD_FW_SET = 0x0F;
const WEBUSB_CMD_FW_GET = 0xAF;

const WEBUSB_CMD_CAPABILITIES_GET = 0xBE;

const WEBUSB_CMD_RGB_SET = 0x01;
const WEBUSB_CMD_RGB_GET = 0xA1;

const WEBUSB_CMD_SNAPBACK_SET = 0x02;
const WEBUSB_CMD_SNAPBACK_GET = 0xA2;

const WEBUSB_CMD_CALIBRATION_START = 0x03;
const WEBUSB_CMD_CALIBRATION_STOP = 0xA3;

const WEBUSB_CMD_OCTAGON_SET = 0x04;

const WEBUSB_CMD_ANALYZE_START = 0x05;
const WEBUSB_CMD_ANALYZE_STOP = 0xA5;

const WEBUSB_CMD_REMAP_SET = 0x06;
const WEBUSB_CMD_REMAP_GET = 0xA6;

const WEBUSB_CMD_REMAP_DEFAULT = 0x07;

const WEBUSB_CMD_GCSP_SET = 0x08;

const WEBUSB_CMD_IMU_CALIBRATION_START = 0x09;

const WEBUSB_CMD_VIBRATE_SET = 0x0A;
const WEBUSB_CMD_VIBRATE_GET = 0xAA;

const WEBUSB_CMD_VIBRATEFLOOR_SET = 0x0B;
const WEBUSB_CMD_VIBRATEFLOOR_GET = 0xAB;

const WEBUSB_CMD_INPUT_REPORT = 0xE0;

const WEBUSB_CMD_SAVEALL = 0xF1;

const INPUT_MODE_SWITCH = 0;
const INPUT_MODE_XINPUT = 1;
const INPUT_MODE_GAMECUBE = 2;
const INPUT_MODE_N64 = 3;
const INPUT_MODE_SNES = 4;

async function config_get_chain(cmd)
{   
    if(cmd==WEBUSB_CMD_FW_GET)
    {
        await remap_get_values();
    }
    else if(cmd==WEBUSB_CMD_REMAP_GET)
    {
        await color_get_values();
    }
    else if (cmd==WEBUSB_CMD_RGB_GET)
    {
        await vibrate_get_value();
    }
    else if (cmd==WEBUSB_CMD_VIBRATE_GET)
    {
        await vibratefloor_get_value();
    }
    else if (cmd==WEBUSB_CMD_VIBRATEFLOOR_GET)
    {
        await capabilities_get_value();
    }
}

//enableMenus(false);

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

// Used for color stuff :)
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

                case WEBUSB_CMD_VIBRATE_GET:
                    console.log("Got vibrate value.");
                    vibrate_place_value(result.data);
                    break;

                case WEBUSB_CMD_VIBRATEFLOOR_GET:
                    console.log("Got vibrate floor value.");
                    vibratefloor_place_value(result.data);
                    break;

                case WEBUSB_CMD_CAPABILITIES_GET:
                    console.log("Got capabilities value.");
                    capabilities_parse(result.data);
                    break;
            }
            
            if(result.data.getUint8(0)!=WEBUSB_CMD_FW_GET)
            {
                await config_get_chain(result.data.getUint8(0));
            }
            
        }
        catch (err) {

        }
    };
}

    // Set connect and disconnect listeners
    navigator.usb.addEventListener("connect", (event) => {
        console.log("Device plugged.");
    });

    navigator.usb.addEventListener("disconnect", (event) => {
        console.log("Device unplugged.");
        if (event.device == device) {
            device = null;
            enableDisconnect(false);
            enable_all_menus(false);
        }
    });

    async function disconnectButton() {
        if (device != null) {
            clearInterval(listen_id);
            await device.close();
        }
        device=null;
        enableDisconnect(false);
        enable_all_menus(false);
    }

    var listen_id = null;
    var listen_command = 0x00;
    var received_command = 0x00;

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
        var id = (data.getUint8(3) << 8) | (data.getUint8(4));

        console.log("Device ID: " + id.toString());

        const vendor_enable = new URLSearchParams(window.location.search).get('vendor');

        if(vendor_enable!=null)
        {
            console.log("Vendor Enable.");

            try {
                fw_display_box(false);
                config_get_chain(WEBUSB_CMD_FW_GET);
            }
            catch(err)
            {

            }
        }
        else if(DEVICE_FW_VERSIONS[id] == undefined)
        {
            console.log("Device mismatch.");
            fw_display_box(true);
        }
        // REMOVE LATER END
        else if (DEVICE_FW_VERSIONS[id] != fw)
        {
            console.log("Version mismatch. Current: " + fw + " | New: " + DEVICE_FW_VERSIONS[id]);
            replace_firmware_strings(id);
            fw_display_box(true);
        }
        else
        {
            try {
                color_set_device(id);
                fw_display_box(false);
                config_get_chain(WEBUSB_CMD_FW_GET);
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

    async function vibrate_get_value()
    {
        var dataOut = new Uint8Array([WEBUSB_CMD_VIBRATE_GET]);
        await device.transferOut(2, dataOut);
    }

    async function vibrate_set_value(value)
    {
        var dataOut = new Uint8Array([WEBUSB_CMD_VIBRATE_SET, value]);
        await device.transferOut(2, dataOut);
    }

    function vibrate_place_value(data)
    {
        document.getElementById("vibeTextValue").innerText = String(data.getUint8(1));
        document.getElementById("vibeValue").value = data.getUint8(1);
    }

    async function vibratefloor_get_value()
    {
        var dataOut = new Uint8Array([WEBUSB_CMD_VIBRATEFLOOR_GET]);
        await device.transferOut(2, dataOut);
    }

    async function vibratefloor_set_value(value)
    {
        var dataOut = new Uint8Array([WEBUSB_CMD_VIBRATEFLOOR_SET, value]);
        await device.transferOut(2, dataOut);
    }

    function vibratefloor_place_value(data)
    {
        document.getElementById("vibeFloorTextValue").innerText = String(data.getUint8(1));
        document.getElementById("vibeFloorValue").value = data.getUint8(1);
    }

    function vibrate_enable_menu(enable)
    {
        enable_dropdown_element("vibration_collapsible", "vibration_collapsible_toggle", enable);
    }

    function gcspecial_enable_menu(enable)
    {
        enable_dropdown_element("gamecube_collapsible", "gamecube_collapsible_toggle", enable);
    }

    async function capabilities_get_value()
    {
        var dataOut = new Uint8Array([WEBUSB_CMD_CAPABILITIES_GET]);
        await device.transferOut(2, dataOut);
    }

    function capabilities_parse(data)
    {
        var data_low = data.getUint8(1);
        console.log(data_low);
        var data_hi = data.getUint8(2);
        var c = {
            analog_stick_left:      (data_low & 0x1) ? true : false,
            analog_stick_right:     (data_low & 0x2) ? true : false,
            analog_trigger_left:    (data_low & 0x4) ? true : false,
            analog_trigger_right:   (data_low & 0x8) ? true : false,
            gyroscope:              (data_low & 0x10) ? true : false,
            bluetooth:              (data_low & 0x20) ? true : false,
            rgb:                    (data_low & 0x40) ? true : false,
            rumble:                 (data_low & 0x80) ? true : false,
            nintendo_serial:        (data_hi & 0x1) ? true : false,
            nintendo_joybus:        (data_hi & 0x2) ? true : false
        };

        analog_enable_menu((c.analog_stick_left | c.analog_stick_right), c.analog_stick_left, c.analog_stick_right);
        imu_enable_menu(c.gyroscope);
        color_enable_menu(c.rgb);
        vibrate_enable_menu(c.rumble);
        remap_enable_menu(true, c.nintendo_joybus, c.nintendo_serial);
        gcspecial_enable_menu(c.nintendo_joybus);
    }

    color_page_picker_init();
    enable_all_menus(false);

    // Register service worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('hoja_sw.js')
          .then(registration => {
            console.log('Service Worker registered with scope:', registration.scope);
          })
          .catch(err => {
            console.log('Service Worker registration failed:', err);
          });
      }
      