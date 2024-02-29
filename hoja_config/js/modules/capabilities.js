var _capabilities = null;

async function capabilities_get_value() {
    var dataOut = new Uint8Array([WEBUSB_CMD_CAPABILITIES_GET]);
    await device.transferOut(2, dataOut);
}

function capabilities_parse(data) {
    console.log("Parsing capabilities.");
    var data_low = data.getUint8(1);

    var data_hi = data.getUint8(2);
    console.log(data_hi);
    var c = {
        analog_stick_left:      (data_low & 0x1) ? true : false,
        analog_stick_right:     (data_low & 0x2) ? true : false,
        analog_trigger_left:    (data_low & 0x4) ? true : false,
        analog_trigger_right:   (data_low & 0x8) ? true : false,
        gyroscope:          (data_low & 0x10) ? true : false,
        bluetooth:          (data_low & 0x20) ? true : false,
        rgb:                (data_low & 0x40) ? true : false,
        rumble_erm:         (data_low & 0x80) ? true : false,

        nintendo_serial:    (data_hi & 0x1) ? true : false,
        nintendo_joybus:    (data_hi & 0x2) ? true : false,
        battery:            (data_hi & 0x4) ? true : false,
        rumble_lra:         (data_hi & 0x8) ? true : false
    };

    console.log(c);

    _capabilities = c;

    enable_all_menus(true);
}

function capabilities_value_get()
{
    return _capabilities;
}