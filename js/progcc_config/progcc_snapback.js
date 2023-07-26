function snapback_place_values(data)
{
    var lxe = document.getElementById("lx_snapback");
    var lye = document.getElementById("ly_snapback");
    var rxe = document.getElementById("rx_snapback");
    var rye = document.getElementById("ry_snapback");

    var lx = data.getUint8(1);
    var ly = data.getUint8(2);
    var rx = data.getUint8(3);
    var ry = data.getUint8(4);

    console.log("Got snapback values.");
    console.log(data);

    lxe.value = lx;
    lye.value = ly;
    rxe.value = rx;
    rye.value = ry;

    document.getElementById("lx_snapbackText").innerText = String(lx);
    document.getElementById("ly_snapbackText").innerText = String(ly);
    document.getElementById("rx_snapbackText").innerText = String(rx);
    document.getElementById("ry_snapbackText").innerText = String(ry);
}

async function snapback_get_values()
{
    var dataOut = new Uint8Array([WEBUSB_CMD_SNAPBACK_GET]);
    await device.transferOut(2, dataOut);
}

async function snapback_set_value(axis, value)
{
    var dataOut = new Uint8Array([WEBUSB_CMD_SNAPBACK, axis, value]);
    await device.transferOut(2, dataOut);
}