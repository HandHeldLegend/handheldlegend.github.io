
async function analog_update_octagon()
{
    var dataOut = new Uint8Array([WEBUSB_CMD_OCTAGON_SET]);
    await device.transferOut(2, dataOut);
}

async function analog_start_calibration()
{
    
}

async function analog_stop_calibration()
{

}