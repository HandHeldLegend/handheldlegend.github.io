
function _system_enable_type_radio(element, enable)
{
    var e = document.getElementById(element);
    e.style.display = (enable) ? "" : "none";
}

function _system_set_radio(mode)
{
    const _vibrateModeButtons = document.getElementsByName("radio_default_mode");
    if (mode >= 0 && mode <= 5) {
        _vibrateModeButtons[mode].checked = true;
    }
}

function system_change_mode_radio(mode)
{
    _system_set_radio(mode);
    system_mode_set_value(mode);
}

function system_enable_menu(enable)
{
    var c = capabilities_value_get();
    if(c!=null)
    {
        _system_enable_type_radio("default_mode_n64_label", c.nintendo_joybus);
        _system_enable_type_radio("default_mode_gc_label", c.nintendo_joybus);
        _system_enable_type_radio("default_mode_snes_label", c.nintendo_serial);
    }
    
    enable_dropdown_element("system-collapsible", enable);
}

function system_mode_place(data)
{
    _system_set_radio(data.getUint8(1));
}

async function system_mode_get_value()
{
    var dataOut = new Uint8Array([WEBUSB_CMD_BOOTMODE_GET]);
    await device.transferOut(2, dataOut);
}

async function system_mode_set_value(mode)
{
    var dataOut = new Uint8Array([WEBUSB_CMD_BOOTMODE_SET, mode]);
    await device.transferOut(2, dataOut);
}