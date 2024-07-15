let _analogtrigger_start_button = document.getElementById("start_triggercalibration_button");
let _analogtrigger_stop_button = document.getElementById("stop_triggercalibration_button");

const leftTrigger = document.getElementById('left-trigger');
const rightTrigger = document.getElementById('right-trigger');
const leftBar = document.getElementById('left-bar');
const rightBar = document.getElementById('right-bar');

const leftTriggerDisabled   = document.getElementById('lt_disable');
const rightTriggerDisabled  = document.getElementById('rt_disable');


function updateLeftBar(value) {
    const height = (value / 255) * 100; // Convert value to percentage
    leftBar.style.height = `${height}%`;
}

function updateRightBar(value) {
    const height = (value / 255) * 100; // Convert value to percentage
    rightBar.style.height = `${height}%`;
}

async function triggers_start_calibration()
{
    console.log("Start analog trigger calibration...");
    _analogtrigger_start_button.setAttribute("disabled", "true");
    _analogtrigger_stop_button.removeAttribute("disabled");
    var dataOut = new Uint8Array([WEBUSB_CMD_TRIGGER_CALIBRATION_START]);
    await device.transferOut(2, dataOut);
}

async function triggers_stop_calibration()
{
    _analogtrigger_stop_button.setAttribute("disabled", "true");
    _analogtrigger_start_button.removeAttribute("disabled");
    var dataOut = new Uint8Array([WEBUSB_CMD_TRIGGER_CALIBRATION_STOP]);
    await device.transferOut(2, dataOut);
}

function triggers_enable_menu(enable) {
    var c = capabilities_value_get();

    var en = (c.analog_trigger_left | c.analog_trigger_right);

    try {
        _analogtrigger_stop_button.setAttribute("disabled", "true");
        _analogtrigger_start_button.removeAttribute("disabled");
    } catch (error) {
        
    }

    enable_dropdown_element("trigger-collapsible", enable && en);
}

function triggers_place_disabled(data)
{
    leftTriggerDisabled.checked     = data.getUint8(1);
    rightTriggerDisabled.checked    = data.getUint8(2);
}

async function triggers_get_disabled()
{
    console.log("Get analog trigger axis disabled...");
    
    var dataOut = new Uint8Array([WEBUSB_CMD_TRIGGER_CALIBRATION_GET]);
    await device.transferOut(2, dataOut);
}

async function triggers_set_disabled(axis, disabled)
{
    console.log("Set analog trigger axis disabled...");
    
    var dataOut = new Uint8Array([WEBUSB_CMD_TRIGGER_CALIBRATION_SET, axis, disabled]);
    await device.transferOut(2, dataOut);
}