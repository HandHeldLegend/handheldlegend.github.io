let _analog_start_button = document.getElementById("start_calibration_button");
let _analog_stop_button  = document.getElementById("stop_calibration_button");

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

function analog_enable_menu(enable)
{
    var c = capabilities_value_get();
    var left_enable = false;
    var right_enable = false;

    if(c!=null)
    {
        left_enable = c.analog_stick_left;
        right_enable = c.analog_stick_right;
    }

    var lse = document.getElementById("left-stick-ui");
    var rse = document.getElementById("right-stick-ui");
    

    if(!left_enable)
    {
        lse.setAttribute("hidden", "true");
    }
    else
    {
        lse.removeAttribute("hidden");
    }

    if(!right_enable)
    {
        rse.setAttribute("hidden", "true");
    }
    else
    {
        rse.removeAttribute("hidden");
    }

    enable_dropdown_element("analog-collapsible", enable && (left_enable || right_enable));
    enable_dropdown_element("snapback-collapsible", enable && (left_enable || right_enable));
}

function analog_start_calibration_confirm()
{
    _analog_stop_button.removeAttribute("disabled");
    _analog_start_button.setAttribute("disabled", "true");
}

function analog_stop_calibration_confirm()
{
    _analog_start_button.removeAttribute("disabled");
    _analog_stop_button.setAttribute("disabled", "true");
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