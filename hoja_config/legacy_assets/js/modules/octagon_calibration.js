function octagon_enable_menu(enable)
{
    var c = capabilities_value_get();
    var left_enable = false;
    var right_enable = false;

    var lose = document.getElementById("leftocto-stick-ui");
    var rose = document.getElementById("rightocto-stick-ui");

    if(c!=null)
    {
        left_enable = c.analog_stick_left;
        right_enable = c.analog_stick_right;
    }

    if(!left_enable)
    {
        lose.setAttribute("hidden", "true");
    }
    else
    {
        lose.removeAttribute("hidden");
    }

    if(!right_enable)
    {
        rose.setAttribute("hidden", "true");
    }
    else
    {
        rose.removeAttribute("hidden");
    }

    enable_dropdown_element( "octagon-collapsible", enable && (left_enable || right_enable));
}

var octagon_menu_open = false;

function octagon_enable_spacebar(enable)
{
    if(enable)
    {
        octagon_menu_open = true;
    }
    else octagon_menu_open = false;
}

async function analog_update_octagon()
{
    var dataOut = new Uint8Array([WEBUSB_CMD_OCTAGON_SET]);
    await device.transferOut(2, dataOut);
}

function analog_subangle_enable_update(enable)
{
    var el = document.getElementById("set_subangle_button");
    var el2 = document.getElementById("floatingInput");
    if(enable)
    {
        el2.removeAttribute("disabled");
        el.removeAttribute("disabled");
    }
    else
    {
        el2.setAttribute("disabled", "true");
        el.setAttribute("disabled", "true");
    }
}

var current_octoangle_axis = -1;
var current_octoangle_idx = -1;

async function analog_update_octoangle(angle)
{
    var f32 = parseFloat(angle);
    console.log("Sending float : " + angle);
    var dataOut = new Uint8Array([WEBUSB_CMD_OCTOANGLE_SET, current_octoangle_axis, current_octoangle_idx]);
    const floatArrayBuffer = new Float32Array([f32]).buffer;
    const floatUint8Array = new Uint8Array(floatArrayBuffer);

    // Combine the two Uint8Arrays
    const combinedUint8Array = new Uint8Array(dataOut.length + floatUint8Array.length);
    combinedUint8Array.set(dataOut, 0); // Copy the first array
    combinedUint8Array.set(floatUint8Array, dataOut.length); // Copy the second array after the first one


    await device.transferOut(2, combinedUint8Array);
}

function analog_octoangle_place_value(data)
{
    current_octoangle_axis = data.getUint8(1);
    current_octoangle_idx = data.getUint8(2);
    console.log("Axis: " + current_octoangle_axis.toString());
    console.log("Subangle Idx: " + current_octoangle_idx.toString());

    let float = data.getFloat32(3, true);

    document.getElementById("floatingInputOcto").value = parseFloat(float.toFixed(3));

    analog_octoangle_enable_update(true);
}

function analog_octoangle_enable_update(enable)
{
    var el = document.getElementById("set_octoangle_button");
    var el2 = document.getElementById("floatingInputOcto");
    if(enable)
    {
        el2.removeAttribute("disabled");
        el.removeAttribute("disabled");
    }
    else
    {
        el2.setAttribute("disabled", "true");
        el.setAttribute("disabled", "true");
    }
}

async function analog_get_octoangle_value()
{
    var dataOut = new Uint8Array([WEBUSB_CMD_OCTOANGLE_GET]);
    await device.transferOut(2, dataOut);
}

var current_subangle_axis = -1;
var current_subangle_idx = -1;

async function analog_update_subangle(angle)
{
    var f32 = parseFloat(angle);
    console.log("Sending float : " + angle);
    var dataOut = new Uint8Array([WEBUSB_CMD_SUBANGLE_SET, current_subangle_axis, current_subangle_idx]);
    const floatArrayBuffer = new Float32Array([f32]).buffer;
    const floatUint8Array = new Uint8Array(floatArrayBuffer);

    // Combine the two Uint8Arrays
    const combinedUint8Array = new Uint8Array(dataOut.length + floatUint8Array.length);
    combinedUint8Array.set(dataOut, 0); // Copy the first array
    combinedUint8Array.set(floatUint8Array, dataOut.length); // Copy the second array after the first one


    await device.transferOut(2, combinedUint8Array);
}

function analog_subangle_place_value(data)
{
    current_subangle_axis = data.getUint8(1);
    current_subangle_idx = data.getUint8(2);
    console.log("Axis: " + current_subangle_axis.toString());
    console.log("Subangle Idx: " + current_subangle_idx.toString());

    let float = data.getFloat32(3, true);

    document.getElementById("floatingInput").value = parseFloat(float.toFixed(3));

    analog_subangle_enable_update(true);
}

async function analog_get_subangle_value()
{
    var dataOut = new Uint8Array([WEBUSB_CMD_SUBANGLE_GET]);
    await device.transferOut(2, dataOut);
}