let device = null;

const WEBUSB_CMD_RGB = 1;

async function sendReport(reportID, data)
{
  var dataOut1 = [reportID];
  var dataOut = new Uint8Array(dataOut1.concat(data));

  await device.transferOut(2, dataOut);
}

async function connectButton() {
    // Request permission to access the ProGCC
    device = await navigator.usb.requestDevice({ filters: [{ vendorId: 0x057E, productId: 0x2009 }] });
    await device.open();
    await device.selectConfiguration(1);
    await device.claimInterface(1);
}

function rgbToHex(r, g, b) {
    return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
}

function hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

async function set_rgb_color(ledGroup, hexColor) {

    var rgb = hexToRgb(hexColor);

    if (device != null) {
        await sendReport(WEBUSB_CMD_RGB, [ledGroup, rgb.r, rgb.g, rgb.b]);
    }
    else
    {
        console.log("Connect ProGCC first.");
    }
}


// Analog stick calibration
function start_analog_calibration() {

}

function stop_analog_calibration() {

}

function save_analog_calibration() {

}

// Snapback viewer functions
function get_snapback_axis(axis) {

}
