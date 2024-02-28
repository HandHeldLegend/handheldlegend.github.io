function enable_dropdown_element(toggleElementId, enable) {
    var toggleElement = document.getElementById(toggleElementId);

    if (enable) {
        toggleElement.setAttribute('enabled', 'true');
        var toggleCheck = toggleElement.querySelector('.toggle')
        toggleCheck.setAttribute('onclick', "setActiveMenu(this.id)");

        //labelElement.removeAttribute('disabled');
    }
    else {
        if (toggleElement.hasAttribute('enabled'))
        toggleElement.removeAttribute('enabled');
    
        toggleElement.checked = false;

        //labelElement.setAttribute('disabled', 'true');
    }
}

function enable_all_menus(enable) {

    vibrate_enable_menu(enable);
    analog_enable_menu(enable);
    octagon_enable_menu(enable);
    color_enable_menu(enable);
    imu_enable_menu(enable);
    remap_enable_menu(enable);
    remapping_sp_enable_menu(enable);
    fwtest_enable_menu(enable);
    system_enable_menu(enable);

    analog_stop_calibration_confirm();

    if(!enable)
    {
        analog_subangle_enable_update(false);
        analog_octoangle_enable_update(false);
    }

    fwtest_reset_button();
}