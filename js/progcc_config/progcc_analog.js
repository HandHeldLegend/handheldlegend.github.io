let analog_start_button = document.getElementById("start_calibration_button");
let analog_stop_button  = document.getElementById("stop_calibration_button");

async function analog_update_octagon()
{
    var dataOut = new Uint8Array([WEBUSB_CMD_OCTAGON_SET]);
    await device.transferOut(2, dataOut);
}

function analog_start_calibration_confirm()
{
    analog_stop_button.removeAttribute("disabled");
    analog_start_button.setAttribute("disabled", "true");
}

function analog_stop_calibration_confirm()
{
    analog_start_button.removeAttribute("disabled");
    analog_stop_button.setAttribute("disabled", "true");
}

async function analog_start_calibration()
{
    var dataOut = new Uint8Array([WEBUSB_CMD_CALIBRATION_START]);
    await device.transferOut(2, dataOut);
}

async function analog_stop_calibration()
{
    var dataOut = new Uint8Array([WEBUSB_CMD_CALIBRATION_STOP]);
    await device.transferOut(2, dataOut);
}

async function imu_start_calibration()
{
    var dataOut = new Uint8Array([WEBUSB_CMD_IMU_CALIBRATION_START]);
    await device.transferOut(2, dataOut);
}