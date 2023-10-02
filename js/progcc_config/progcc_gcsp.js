
let gc0 = document.getElementById("gc_sp_0");
let gc1 = document.getElementById("gc_sp_1");
let gc2 = document.getElementById("gc_sp_2");
let gc3 = document.getElementById("gc_sp_3");
let gc4 = document.getElementById("gc_sp_4");

function gcsp_place_value(val, light)
{
    gc0.checked = false;
    gc1.checked = false;
    gc2.checked = false;
    gc3.checked = false;
    gc4.checked = false;

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

        case 3:
            el=gc3;
            break;

        case 4:
            el=gc4;
            break;
    }

    el.checked = true;

    console.log("GC SP Mode: " + val);
    console.log("GC Light Value: " + light.toString());

    document.getElementById("lightValue").value = light;
    document.getElementById("lightTextValue").innerText = light.toString();
}

async function gcsp_set_value(val, light)
{
    var dataOut = new Uint8Array([WEBUSB_CMD_GCSP_SET, val, light]);
    await device.transferOut(2, dataOut);
}