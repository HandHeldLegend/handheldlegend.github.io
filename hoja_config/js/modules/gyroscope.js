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

let _gax_bar = document.getElementById("gax-bar");
let _gay_bar = document.getElementById("gay-bar");
let _gaz_bar = document.getElementById("gaz-bar");

let _ggx_bar = document.getElementById("ggx-bar");
let _ggy_bar = document.getElementById("ggy-bar");
let _ggz_bar = document.getElementById("ggz-bar");

function imu_set_input_data(data)
{
    imu_updateBar(_gax_bar, data.getUint8(10));
    imu_updateBar(_gay_bar, data.getUint8(11));
    imu_updateBar(_gaz_bar, data.getUint8(12));

    imu_updateBar(_ggx_bar, data.getUint8(13));
    imu_updateBar(_ggy_bar, data.getUint8(14));
    imu_updateBar(_ggz_bar, data.getUint8(15));
}

function imu_updateBar(barEl, value)
{
    const width = (value/255) * 100;
    barEl.style.width = `${width}%`;
}

imu_updateBar(_gax_bar, 128);
imu_updateBar(_gay_bar, 128);
imu_updateBar(_gaz_bar, 128);

imu_updateBar(_ggx_bar, 128);
imu_updateBar(_ggy_bar, 128);
imu_updateBar(_ggz_bar, 128);