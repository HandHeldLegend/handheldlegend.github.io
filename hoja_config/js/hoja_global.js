function enable_dropdown_element(toggleElementId, labelElementId, enable) {
    var toggleElement = document.getElementById(toggleElementId);
    var labelElement = document.getElementById(labelElementId);

    if (enable) {
        toggleElement.removeAttribute('disabled');
        toggleElement.setAttribute('onclick', "setActiveMenu(this.id)");

        labelElement.removeAttribute('disabled');
    }
    else {
        toggleElement.setAttribute('disabled', 'true');
        toggleElement.checked = false;

        labelElement.setAttribute('disabled', 'true');
    }
}

function enable_all_menus(enable) {

    vibrate_enable_menu(enable);
    analog_enable_menu(enable);
    color_enable_menu(enable);
    imu_enable_menu(enable);
    remap_enable_menu(enable);
    gcspecial_enable_menu(enable);
    analog_stop_calibration_confirm();

    if(!enable)
    {
        baseband_enable_button(false);
        analog_subangle_enable_update(false);
        analog_octoangle_enable_update(false);
    }
}