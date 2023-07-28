let device = null;
let connectButtonElement = document.getElementById("connectButton");
let disconnectButtonElement = document.getElementById("disconnectButton");

let menuToggles = document.getElementsByClassName("toggle");
let menuToggleLabels = document.getElementsByClassName("lbl-toggle");
let selectedToggle = null;

const WEBUSB_CMD_RGB_SET = 0x01;
const WEBUSB_CMD_RGB_GET = 0xA1;

const WEBUSB_CMD_SNAPBACK_SET = 0x02;
const WEBUSB_CMD_SNAPBACK_GET = 0xA2;

const WEBUSB_CMD_CALIBRATION_START = 0x03;
const WEBUSB_CMD_CALIBRATION_STOP = 0xA3;

const WEBUSB_CMD_OCTAGON_SET = 0x04;

const WEBUSB_CMD_SAVEALL = 0xF1;

enableMenus(false);

async function sendReport(reportID, data) {
    var dataOut1 = [reportID];
    var dataOut = new Uint8Array(dataOut1.concat(data));

    await device.transferOut(2, dataOut);
}

const listen = async () => {
    if (device != null) {
        const result = await device.transferIn(2, 64);
        switch (result.data.getUint8(0)) {
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
        }
        listen();
    }
};

// Set connect and disconnect listeners
navigator.usb.addEventListener("connect", (event) => {
    console.log("Device plugged.");

});

navigator.usb.addEventListener("disconnect", (event) => {
    console.log("Device unplugged.");
    if (event.device == device) {
        device = null;
        enableMenus(false);
    }
});

async function disconnectButton() {
    if (device != null) {
        await device.close();
    }
    enableMenus(false);
}

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
        await device.open();
        await device.selectConfiguration(1);
        await device.claimInterface(1);
        // Get data
        listen();
        await snapback_get_values();
        await color_get_values();
        enableMenus(true);
    }
}

async function saveButton() {
    var dataOut = new Uint8Array([WEBUSB_CMD_SAVEALL]);
    await device.transferOut(2, dataOut);
}

function setActiveMenu(id) {
    if (id == selectedToggle)
    {
        return;
    }
    if (selectedToggle != null)
    {
        document.getElementById(selectedToggle).checked = false;
    }
    selectedToggle = id;
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

        // Disable connect button
        connectButtonElement.setAttribute('disabled', 'true');

        // Enable disconnect button
        disconnectButtonElement.removeAttribute('disabled');

    }
    else {
        Array.from(menuToggles).forEach(element => {
            element.setAttribute('disabled', 'true');
            element.checked = false;
        });

        Array.from(menuToggleLabels).forEach(element => {
            element.setAttribute('disabled', 'true');
        });

        // Disable disconnect button
        disconnectButtonElement.setAttribute('disabled', 'true');

        // Enable connect button
        connectButtonElement.removeAttribute('disabled');
    }
}