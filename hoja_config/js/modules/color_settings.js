// {[key: buttonId]: hexString}
const colors = {}

const RGB_GROUP_RS = 0;
const RGB_GROUP_LS = 1;
const RGB_GROUP_DPAD = 2;
const RGB_GROUP_MINUS = 3;
const RGB_GROUP_CAPTURE = 4;
const RGB_GROUP_HOME = 5;
const RGB_GROUP_PLUS = 6;
const RGB_GROUP_Y = 7;
const RGB_GROUP_X = 8;
const RGB_GROUP_A = 9;
const RGB_GROUP_B = 10;

var currentColor = "#FFFFFF";
let activeButtonId = null;

let colorPickerElement = document.getElementById('colorPicker');
let colorPicker = null;

let hexBoxElement = document.getElementById('colorHexBox');

function color_set_device(device_id)
{
    let device="procontroller";
    let sig_id = (device_id & 0xF000) >> 12;

    if( (sig_id == 0xB))
    {
        console.log("Loaded SNES svg");
        device="snescontroller";
    }
    else console.log("Loaded ProCon svg");

    let loader = document.getElementById("colorSvgLoader");

    if(device=="snescontroller")
    {
        loader.setAttribute('data-src', 'svg/snescontroller.svg');
    }
    else if(device=="procontroller")
    {
        loader.setAttribute('data-src', 'svg/procontroller.svg');
    }

    loader.setAttribute('oniconload', 'color_page_init()');

    //loader.reload();
}

function hexToRgb(hex) {
    // Ensure the hex color starts with '#'
    if (hex[0] !== '#') {
        hex = '#' + hex;
    }

    // Remove '#' if it's there
    let r = parseInt(hex.substr(1, 2), 16);
    let g = parseInt(hex.substr(3, 2), 16);
    let b = parseInt(hex.substr(5, 2), 16);

    // Return an object with r, g, b properties
    return {r: r, g: g, b: b};
}

function color_enable_menu(enable)
{
    var c = capabilities_value_get();

    if(c!=null)
    {
        enable_dropdown_element("color-collapsible", c.rgb && enable);
    }
    else enable_dropdown_element("color-collapsible", enable);
    
}

function rgbToHex(r, g, b) {
    return ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
}

function color_page_init() {
    var els = document.querySelectorAll('.svgButtonClickable');

    els.forEach(function (element) {
        element.addEventListener('click', function () {
            color_button_clicked(element.id);
        });
    });
}

function color_page_picker_init()
{
    colorPicker = new iro.ColorPicker('#colorPicker', {
        width: 200,
        layout: [
            {
                component: iro.ui.Box,
                options: {}
            },
            {
                component: iro.ui.Slider,
                options: {
                    sliderType: 'hue'
                }

            }
        ]
    });

    colorPicker.on('input:end', (color) => {
        color_picker_changed(color.hexString);
    });

    colorPicker.on('color:change', (color) => {
        svg_set_hex(activeButtonId, color.hexString);
        hexbox_set_hex(color.hexString);
    });
}

function hexbox_set_hex(hex) {
    hexBoxElement.value = hex;
}

function svg_set_rgb(id, r, g, b) {
    var hexString = "#" + rgbToHex(r, g, b);

    try
    {
        var el = document.getElementById(id);
        el.style.fill = hexString;
    }
    catch(err)
    {

    }
    
}

function svg_set_hex(id, hex) {
    var el = document.getElementById(id);
    el.style.fill = hex;
}

async function color_set_value(id, hexColor) {
    var group = 0;

    switch (id) {
        default:
            group = -1;
            break;

        case "rightStick":
            group = RGB_GROUP_RS;
            break;

        case "leftStick":
            group = RGB_GROUP_LS;
            break;

        case "dpad":
            group = RGB_GROUP_DPAD;
            break;

        case "minusButton":
            group = RGB_GROUP_MINUS;
            break;

        case "captureButton":
            group = RGB_GROUP_CAPTURE;
            break;

        case "homeButton":
            group = RGB_GROUP_HOME;
            break;

        case "plusButton":
            group = RGB_GROUP_PLUS;
            break;

        case "yButton":
            group = RGB_GROUP_Y;
            break;

        case "xButton":
            group = RGB_GROUP_X;
            break;

        case "aButton":
            group = RGB_GROUP_A;
            break;

        case "bButton":
            group = RGB_GROUP_B;
            break;
    }

    if (group > -1) {
        // Set SVG Element Color
        svg_set_hex(activeButtonId, hexColor);

        var rgb = hexToRgb(hexColor);

        if (device != null) {
            await sendReport(WEBUSB_CMD_RGB_SET, [group, rgb.r, rgb.g, rgb.b]);
        }
        else {
            console.log("Connect Controller first.");
        }
    }
    else {
        console.log("Invalid group ID.");
    }

}

function color_copy() {
    currentColor = colorPicker.color.hexString;
    navigator.clipboard.writeText(currentColor);
}

function color_paste() {
    colorPicker.color.hexString = currentColor;
    color_set_value(activeButtonId, currentColor).then(null);
}

function color_button_clicked(id) {
    console.log("Button picked: " + id);

    if(activeButtonId != null)
    document.getElementById(activeButtonId).classList.remove('active');

    activeButtonId = id;
    var buttonEl = document.getElementById(id);
    buttonEl.classList.add('active');

    colorPickerElement.classList.add('enabled');
    hexBoxElement.removeAttribute('disabled');


    if (buttonEl.style.fill != "") {
        var c = buttonEl.style.fill;
        colorPicker.color.rgbaString = c;
    }
    else {
        colorPicker.color.hexString = "#ffffff";
        buttonEl.style.fill = colorPicker.color.rgbaString;
    }
}

// This updates controller RGB
function color_picker_changed(value) {
    console.log("Color picker changed: " + value);
    hexBoxElement.value = value;

    // Update RGB
    color_set_value(activeButtonId, value);
}

// This updates controller RGB
function color_hexbox_changed(value) {
    console.log("Color hexbox changed: " + value);
    let hexRegex = /^[0-9A-Fa-f]{0,6}$/g;
    // Remove '#' if it's there
    if (value[0] === '#') {
        value = value.substr(1);
    }

    // Check if it's a valid hex color
    if (!hexRegex.test(value)) {
        alert("Invalid character, enter a valid hexadecimal color code");
        return;
    }

    // Add leading zeroes if the length is less than 6
    while (value.length < 6) {
        value = '0' + value;
    }

    // Add '#' at the beginning
    value = '#' + value;

    // Append value back to source
    hexBoxElement.value = value;

    // Apply color to color picker
    colorPicker.color.hexString = value;

    // Apply color to SVG
    svg_set_hex(activeButtonId, value);

    // Update RGB
    color_set_value(activeButtonId, value);
}

async function color_get_values() {
    var did = version_read_id();
    color_set_device(did);

    var dataOut = new Uint8Array([WEBUSB_CMD_RGB_GET]);
    await device.transferOut(2, dataOut);
}

function color_place_values(data) {
    var d = new Uint8Array(data.buffer);
    var i = 1;
    svg_set_rgb("rightStick", d[i], d[i + 1], d[i + 2]);
    i = i + 3;
    svg_set_rgb("leftStick", d[i], d[i + 1], d[i + 2]);
    i = i + 3;
    svg_set_rgb("dpad", d[i], d[i + 1], d[i + 2]);
    i = i + 3;
    svg_set_rgb("minusButton", d[i], d[i + 1], d[i + 2]);
    i = i + 3;
    svg_set_rgb("captureButton", d[i], d[i + 1], d[i + 2]);
    i = i + 3;
    svg_set_rgb("homeButton", d[i], d[i + 1], d[i + 2]);
    i = i + 3;
    svg_set_rgb("plusButton", d[i], d[i + 1], d[i + 2]);
    i = i + 3;
    svg_set_rgb("yButton", d[i], d[i + 1], d[i + 2]);
    i = i + 3;
    svg_set_rgb("xButton", d[i], d[i + 1], d[i + 2]);
    i = i + 3;
    svg_set_rgb("aButton", d[i], d[i + 1], d[i + 2]);
    i = i + 3;
    svg_set_rgb("bButton", d[i], d[i + 1], d[i + 2]);
}

async function rgb_get_mode()
{
    if (device != null) {
        await sendReport(WEBUSB_CMD_RGBMODE_GET);
    }
}

// A javascript function that either sets an elements style 'display' as 'none' or it removes that element
// entirely from the DOM. This is used to hide/show the color picker and hex box. Takes in parameter 'hide' and 'id'
// where 'hide' is a boolean and 'id' is the id of the element to hide/show.
function hideElement(enable, id) {
    if (!enable) {
        document.getElementById(id).setAttribute("disabled", "true");
    } else {
        document.getElementById(id).removeAttribute("disabled");
    }
}

function _rgb_enable_mode_type(mode)
{
    hideElement( (mode == 0) , "user-color-div");
    hideElement( (mode>2) , "cycle-color-div");
    hideElement((mode>0), "speed-color-div");
}

async function rgb_set_mode(mode)
{
    
    _rgb_enable_mode_type(mode);
    if (device != null) {
        await sendReport(WEBUSB_CMD_RGBMODE_SET, mode);
    }
}

async function rgb_get_usercycle()
{
    if (device != null) {
        await sendReport(WEBUSB_CMD_USERCYCLE_GET);
    }
}

async function rgb_set_usercycle(idx, hexColor)
{
    var rgb = hexToRgb(hexColor);
    if (device != null) {
        await sendReport(WEBUSB_CMD_USERCYCLE_SET, [idx, rgb.r, rgb.g, rgb.b]);
    }
}

function _updatecolorpicker(id, r, g, b)
{
    console.log("Updating color picker: " + id + " to " + r + ", " + g + ", " + b);
    var el = document.getElementById(id);
    el.value = "#" + rgbToHex(r, g, b);
}

function rgb_update_speed_text(value)
{
    document.getElementById("speed-color-text").innerText = value.toString();
}

async function rgb_set_speed(value)
{
    console.log("Setting speed to: " + value);
    if (device != null) {
        await sendReport(WEBUSB_CMD_USERCYCLE_SET, [6, value]);
    }
}

function rgb_usercycle_place_values(data)
{
    var d = new Uint8Array(data.buffer);
    var speed = d[19];

    console.log("Speed: " + speed);

    _updatecolorpicker("color-picker-1", d[1], d[2], d[3]);
    _updatecolorpicker("color-picker-2", d[4], d[5], d[6]);
    _updatecolorpicker("color-picker-3", d[7], d[8], d[9]);
    _updatecolorpicker("color-picker-4", d[10], d[11], d[12]);
    _updatecolorpicker("color-picker-5", d[13], d[14], d[15]);
    _updatecolorpicker("color-picker-6", d[16], d[17], d[18]);

    document.getElementById("speed-color-value").value = speed;
    rgb_update_speed_text(speed);

}

function rgb_mode_place_value(data) {
    var number = data.getUint8(1);
    const radioButtons = document.getElementsByName("radio_color_mode");
    if (number >= 0 && number <= 4) {
        radioButtons[number].checked = true;
    }

    _rgb_enable_mode_type(number);
}

// Enable default
_rgb_enable_mode_type(0);
