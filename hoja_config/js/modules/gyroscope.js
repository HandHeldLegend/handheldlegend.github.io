function imu_enable_menu(enable)
{
    var c = capabilities_value_get();
    if(c != null)
    {
        var enable_dropdown = (c.gyroscope);

        _vibrate_enable_type_radio("erm_switch_label", c.rumble_erm);
        _vibrate_enable_type_radio("lra_switch_label", c.rumble_lra);
        
        enable_dropdown_element("gyro-collapsible", enable_dropdown && enable);
    }
    else enable_dropdown_element("gyro-collapsible", enable);
}

async function imu_start_calibration()
{
    var dataOut = new Uint8Array([WEBUSB_CMD_IMU_CALIBRATION_START]);
    await device.transferOut(2, dataOut);
}