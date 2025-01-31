let _vibrateStrengthSlider  = document.getElementById("vibration_strength");
let _vibrateStrengthText    = document.getElementById("vibration_strength_text");
var _vibrate_intensity = 0;
var _vibrate_mode = 0;

function _vibrate_set_radio(mode)
{
    const _vibrateModeButtons = document.getElementsByName("radio_erm_lra_profile");
    if (mode >= 0 && mode <= 1) {
        _vibrateModeButtons[mode].checked = true;
    }
}

function _vibrate_enable_type_radio(element, enable)
{
    var e = document.getElementById(element);
    e.style.display = (enable) ? "" : "none";
}

// Update vibrate text
function vibrate_update_text() {
    _vibrateStrengthText.innerText = String(_vibrateStrengthSlider.value);
}

async function vibrate_set_mode(mode)
{
    _vibrate_mode = mode;
    await vibrate_set_value(_vibrate_intensity, mode);
}

async function vibrate_set_intensity(intensity)
{
    _vibrate_intensity = intensity;
    await vibrate_set_value(intensity, _vibrate_mode);
}

// Retrieve vibrate config value
async function vibrate_get_value() {
    var dataOut = new Uint8Array([WEBUSB_CMD_VIBRATE_GET]);
    await device.transferOut(2, dataOut);
}

async function vibrate_set_value(value, mode) {
    var dataOut = new Uint8Array([WEBUSB_CMD_VIBRATE_SET, value]);
    await device.transferOut(2, dataOut);
}

function vibrate_place_value(data) {
    var rumble_intensity = data.getUint8(1);
    _vibrate_intensity = rumble_intensity;
    _vibrateStrengthSlider.value = rumble_intensity;
    vibrate_update_text();

    var mode = data.getUint8(2);
    if(mode > 1) mode = 0;
    _vibrate_set_radio(mode);
}

async function vibratefloor_get_value() {
    var dataOut = new Uint8Array([WEBUSB_CMD_VIBRATEFLOOR_GET]);
    await device.transferOut(2, dataOut);
}

async function vibratefloor_set_value(value) {
    var dataOut = new Uint8Array([WEBUSB_CMD_VIBRATEFLOOR_SET, value]);
    await device.transferOut(2, dataOut);
}

function vibrate_enable_menu(enable) {
    var c = capabilities_value_get();
    if(c != null)
    {
        var enable_dropdown = (c.rumble_erm | c.rumble_lra);

        _vibrate_enable_type_radio("erm_switch_label", c.rumble_erm);
        _vibrate_enable_type_radio("lra_switch_label", c.rumble_lra);
        
        enable_dropdown_element("vibrate-collapsible", enable_dropdown && enable);
    }
    else enable_dropdown_element("vibrate-collapsible", enable);
}

async function vibrate_test_start()
{
    var dataOut = new Uint8Array([WEBUSB_CMD_RUMBLETEST_GET]);
    await device.transferOut(2, dataOut);
}