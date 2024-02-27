
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