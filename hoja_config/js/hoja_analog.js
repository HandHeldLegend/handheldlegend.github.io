let analog_start_button = document.getElementById("start_calibration_button");
let analog_stop_button  = document.getElementById("stop_calibration_button");

async function analog_set_invert(axis, inverted)
{
    var dataOut = new Uint8Array([WEBUSB_CMD_ANALOG_INVERT_SET, axis, inverted]);
    await device.transferOut(2, dataOut);
}

async function analog_get_invert_value()
{
    var dataOut = new Uint8Array([WEBUSB_CMD_ANALOG_INVERT_GET]);
    await device.transferOut(2, dataOut);
}

function analog_invert_place_values(data)
{
    var lx = data.getUint8(1);
    var ly = data.getUint8(2);
    var rx = data.getUint8(3);
    var ry = data.getUint8(4);

    document.getElementById("lx_invert").checked = lx;
    document.getElementById("ly_invert").checked = ly;
    document.getElementById("rx_invert").checked = rx;
    document.getElementById("ry_invert").checked = ry;
}

function analog_enable_menu(enable, leftStick, rightStick)
{
    enable_dropdown_element( "octagon_collapsible", "octagon_collapsible_toggle", enable);
    enable_dropdown_element("analog_collapsible", "analog_collapsible_toggle", enable);
    enable_dropdown_element("snapback-settings", "snapback-settings-toggle", enable);

    var lse = document.getElementById("left-stick-ui");
    var rse = document.getElementById("right-stick-ui");
    var lose = document.getElementById("leftocto-stick-ui");
    var rose = document.getElementById("rightocto-stick-ui");

    if(!leftStick)
    {
        lse.setAttribute("hidden", "true");
        lose.setAttribute("hidden", "true");
    }
    else
    {
        lse.removeAttribute("hidden");
        lose.removeAttribute("hidden");
    }

    if(!rightStick)
    {
        rse.setAttribute("hidden", "true");
        rose.setAttribute("hidden", "true");
    }
    else
    {
        rse.removeAttribute("hidden");
        rose.removeAttribute("hidden");
    }
}

function imu_enable_menu(enable)
{
    enable_dropdown_element("gyro_collapsible", "gyro_collapsible_toggle", enable);
}

async function analog_update_octagon()
{
    var dataOut = new Uint8Array([WEBUSB_CMD_OCTAGON_SET]);
    await device.transferOut(2, dataOut);
}

function analog_subangle_enable_update(enable)
{
    var el = document.getElementById("set_subangle_button");
    var el2 = document.getElementById("floatingInput");
    if(enable)
    {
        el2.removeAttribute("disabled");
        el.removeAttribute("disabled");
    }
    else
    {
        el2.setAttribute("disabled", "true");
        el.setAttribute("disabled", "true");
    }
}

var current_subangle_axis = -1;
var current_subangle_idx = -1;

async function analog_update_subangle(angle)
{
    var f32 = parseFloat(angle);
    console.log("Sending float : " + angle);
    var dataOut = new Uint8Array([WEBUSB_CMD_SUBANGLE_SET, current_subangle_axis, current_subangle_idx]);
    const floatArrayBuffer = new Float32Array([f32]).buffer;
    const floatUint8Array = new Uint8Array(floatArrayBuffer);

    // Combine the two Uint8Arrays
    const combinedUint8Array = new Uint8Array(dataOut.length + floatUint8Array.length);
    combinedUint8Array.set(dataOut, 0); // Copy the first array
    combinedUint8Array.set(floatUint8Array, dataOut.length); // Copy the second array after the first one


    await device.transferOut(2, combinedUint8Array);
}

function analog_subangle_place_value(data)
{
    current_subangle_axis = data.getUint8(1);
    current_subangle_idx = data.getUint8(2);
    console.log("Axis: " + current_subangle_axis.toString());
    console.log("Subangle Idx: " + current_subangle_idx.toString());

    let float = data.getFloat32(3, true);

    document.getElementById("floatingInput").value = parseFloat(float.toFixed(3));

    analog_subangle_enable_update(true);
}

async function analog_get_subangle_value()
{
    var dataOut = new Uint8Array([WEBUSB_CMD_SUBANGLE_GET]);
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