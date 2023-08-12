
let gc0 = document.getElementById("gc_sp_0");
let gc1 = document.getElementById("gc_sp_1");
let gc2 = document.getElementById("gc_sp_2");

function gcsp_place_value(val)
{
    gc0.checked = false;
    gc1.checked = false;
    gc2.checked = false;
    var el = null;
    switch(val)
    {
        default:
        case 0:
            el=gc0;
            break;

        case 1:
            el=gc1;
            break;

        case 2:
            el=gc2;
            break;
    }

    el.checked = true;
}

async function gcsp_set_value(val)
{
    var dataOut = new Uint8Array([WEBUSB_CMD_GCSP_SET, val]);
    await device.transferOut(2, dataOut);
}