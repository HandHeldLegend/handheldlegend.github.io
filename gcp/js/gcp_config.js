let device = null;
let connectButtonElement = document.getElementById("connectButton");
let disconnectButtonElement = document.getElementById("disconnectButton");

const WEBUSB_CMD_FW_SET = 0x0F;
const WEBUSB_CMD_FW_GET = 0xAF;

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

navigator.usb.addEventListener("disconnect", (event) => {
    console.log("Device unplugged.");
    if (event.device == device) {
        device = null;
        //enableDisconnect(false);
        //enable_all_menus(false);
    }
});

async function disconnectButton() {
    if (device != null) {
        //clearInterval(listen_id);
        await device.close();
    }
    device = null;
    //enableDisconnect(false);
    //enable_all_menus(false);
}

async function connectButton() {

    var devices = await navigator.usb.getDevices({
        filters: [
            { vendorId: 0x057E, productId: 0x2009, serialNumber: "GCP+" },
            { vendorId: 0x057E, productId: 0x2009, serialNumber: "GCPE" }
        ]
    });

    if (devices[0]) {
        console.log("Already got device.");
        device = devices[0];
    }
    else {
        console.log("Need device permission or not found.");
        // Request permission to access the GCP
        device = await navigator.usb.requestDevice({
            filters: [
                { vendorId: 0x057E, productId: 0x2009, serialNumber: "GCP+" },
                { vendorId: 0x057E, productId: 0x2009, serialNumber: "GCPE" }
            ]
        });
    }

    try {

        switch (device.serialNumber) {
            case 'GCPE':
                console.log("GCP ESP32-S3 Detected.");
                break;
            case 'GCP+':
                console.log("GCP+ RP2040 Detected.");
                break;
            default:
                window.alert("Please connect a valid GCP device.");
                return;
                break;
        }

        await device.open();
        await device.selectConfiguration(1);
        await device.claimInterface(1);

        //await fw_get_value();
        //enableDisconnect(true);

        //listen_id = setInterval(() => {
        //
        //    try {
        //        listen();
        //    }
        //    catch (err) {
        //
        //    }
        //}, 8);
    }
    catch (error) {
        window.alert("Please connect a valid GCP device.");
    }
}