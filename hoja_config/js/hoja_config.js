let device = null;
let connectButtonElement = document.getElementById("connectButton");
let disconnectButtonElement = document.getElementById("disconnectButton");

let menuToggles = document.getElementsByClassName("toggle");
let menuToggleLabels = document.getElementsByClassName("lbl-toggle");
let selectedToggle = null;

const INPUT_MODE_SWITCH = 0;
const INPUT_MODE_XINPUT = 1;
const INPUT_MODE_GAMECUBE = 2;
const INPUT_MODE_N64 = 3;
const INPUT_MODE_SNES = 4;

// Gets the config items in a set order
async function config_get_chain(cmd) {
    if (cmd == WEBUSB_CMD_FW_GET) {
        await capabilities_get_value(); 
    }
    else if (cmd == WEBUSB_CMD_CAPABILITIES_GET ) {
        await color_get_values();
    }
    else if (cmd == WEBUSB_CMD_RGB_GET) {
        await vibrate_get_value();
    }
    else if (cmd == WEBUSB_CMD_VIBRATE_GET) {
        await remap_get_values();
    }
    else if (cmd == WEBUSB_CMD_REMAP_GET) {
        await analog_get_invert_value();
    }
    else if (cmd == WEBUSB_CMD_ANALOG_INVERT_GET) {
        await rgb_get_usercycle();
    }
    else if (cmd== WEBUSB_CMD_USERCYCLE_GET) {
        await rgb_get_mode();
    }
    else if (cmd== WEBUSB_CMD_RGBMODE_GET) {
        await analog_get_deadzones();
    }
    else if (cmd== WEBUSB_CMD_DEADZONE_GET) {
        await system_mode_get_value();
    }
}

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

function showToast(message, duration = 2000) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.style.display = 'block';
    toast.style.opacity = 1;

    setTimeout(function () {
        toast.style.opacity = 0;
        setTimeout(function () {
            toast.style.display = 'none';
        }, 500); // Wait for the transition to complete (500ms)
    }, duration);
}

async function handle_input_report(result) {
    switch (result.data.getUint8(0)) {

        case WEBUSB_CMD_DEBUG_REPORT:
            for(i = 0; i < result.data.getUint8(1); i++)
            {
                console.log("Dbg: " + result.data.getUint8(2+i));
            }
            showToast("Got debug dump data. (See console).");
            break;

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
            // Example usage:
            showToast("Settings saved OK.");
            console.log("JavaScript operations continue...");
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
            console.log("Got FW Datas.");
            version_interpret_values_data(result.data);
            break;

        case WEBUSB_CMD_INPUT_REPORT:
            input_process_data(result.data);
            break;

        case WEBUSB_CMD_VIBRATE_GET:
            console.log("Got vibrate value.");
            vibrate_place_value(result.data);
            break;

        case WEBUSB_CMD_CAPABILITIES_GET:
            console.log("Got capabilities value.");
            capabilities_parse(result.data);
            break;

        case WEBUSB_CMD_ANALOG_INVERT_GET:
            console.log("Got analog inversion value.");
            analog_invert_place_values(result.data);
            break;

        case WEBUSB_CMD_SUBANGLE_GET:
            console.log("Got subangle value.");
            analog_subangle_place_value(result.data);
            break;

        case WEBUSB_CMD_OCTOANGLE_GET:
            console.log("Got cardinal value.");
            analog_octoangle_place_value(result.data);
            break;

        case WEBUSB_CMD_HWTEST_GET:
            console.log("Got fw test values.");
            fwtest_place_data(result.data);
            break;

        case WEBUSB_CMD_RGBMODE_GET:
            console.log("Got rgb mode value.");
            rgb_mode_place_value(result.data);
            break;

        case WEBUSB_CMD_USERCYCLE_GET:
            console.log("Got user cycle RGB values.");
            rgb_usercycle_place_values(result.data);
            break;

        case WEBUSB_CMD_DEADZONE_GET:
            console.log("Got user deadzone values.");
            analog_deadzones_place_values(result.data);
            break;

        case WEBUSB_CMD_BOOTMODE_GET:
            console.log("Got user boot mode.");
            system_mode_place(result.data);
            break;
    }

    if (result.data.getUint8(0) != WEBUSB_CMD_FW_GET) {
        try {
            await config_get_chain(result.data.getUint8(0));
        } catch (error) {
            console.error('Error in async function:', error);
        }

    }

    //listen();
}

function stop_listen() {
    const result = device.transferIn(2, 0); // Unsubscribe from datain event.
    result.removeEventListener('datain', () => { });
}

function listen() {

    if (device == null) {
        return;
    }

    device.transferIn(2, 64)
        .then(result => {
            handle_input_report(result);
            listen();
        });
}

// Set connect and disconnect listeners
navigator.usb.addEventListener("connect", (event) => {
    console.log("Device plugged.");
});

function doDisconnect()
{
    device = null;
    setActiveMenu(null);
    enableDisconnect(false);
    version_disable_notifications();
    enable_all_menus(false);
}

navigator.usb.addEventListener("disconnect", (event) => {
    console.log("Device unplugged.");
    console.log(event);

    if (event.device == device) {
        device = null;
        doDisconnect();
    }

});

async function disconnectButton() {
    if (device != null) {
        await device.close();
    }
    doDisconnect();
    console.log("Device disconnected by button.");
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

        await version_get_value();
        enableDisconnect(true);
        listen();
    }
    catch (error) {
        window.alert("Please connect a valid HOJA gamepad device.");
        console.log(error);
    }

}

// Saves all settings
async function saveButton() {
    var dataOut = new Uint8Array([WEBUSB_CMD_SAVEALL]);
    await device.transferOut(2, dataOut);
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

function enableDisconnect(enable) {
    if (enable) {
        // Disable connect button
        connectButtonElement.setAttribute('disabled', 'true');

        // Enable disconnect button
        disconnectButtonElement.removeAttribute('disabled');
    }
    else {
        // Disable disconnect button
        disconnectButtonElement.setAttribute('disabled', 'true');

        // Enable connect button
        connectButtonElement.removeAttribute('disabled');
    }
}

color_page_picker_init();
//enable_all_menus(false);

function notifyUserToUpdate() {
    console.log("Update notif sent.");
    // This could be more fancy, like displaying a modal or a toast
    const updateBanner = document.createElement('div');
    updateBanner.style.zIndex = '5';
    updateBanner.style.position = 'fixed';
    updateBanner.style.bottom = '0';
    updateBanner.style.width = '100%';
    updateBanner.style.backgroundColor = '#ffcc00';
    updateBanner.style.padding = '1em';
    updateBanner.style.textAlign = 'center';
    updateBanner.textContent = 'A new version is available. Please refresh to update.';
    document.body.appendChild(updateBanner);
}

// Register service worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('hoja_sw.js')
        .then(registration => {
            console.log('Service Worker registered with scope:', registration.scope);

            // Listen for a message from the service worker
            registration.addEventListener('updatefound', function () {
                // If there's an updated service worker waiting
                if (registration.installing) {
                    registration.installing.addEventListener('statechange', function () {
                        if (this.state === 'installed' && navigator.serviceWorker.controller) {
                            // Notify the user to refresh
                            notifyUserToUpdate();
                        }
                    });
                }
            });

        })
        .catch(err => {
            console.log('Service Worker registration failed:', err);
        });
}

