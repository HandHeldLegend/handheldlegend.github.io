function imu_enable_menu(enable)
{
    enable_dropdown_element("gyro-collapsible", enable);
}

async function imu_start_calibration()
{
    var dataOut = new Uint8Array([WEBUSB_CMD_IMU_CALIBRATION_START]);
    await device.transferOut(2, dataOut);
}