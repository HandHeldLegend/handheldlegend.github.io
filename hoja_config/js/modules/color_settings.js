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
const RGB_GROUP_L = 11;
const RGB_GROUP_ZL = 12;
const RGB_GROUP_R = 13;
const RGB_GROUP_ZR = 14;
const RGB_GROUP_PLAYER = 15;
const RGB_GROUP_MAX = 16;

var currentColor = "#FFFFFF";
let activeButtonId = null;

let colorPickerElement = document.getElementById('colorPicker');
let colorPicker = null;

let hexBoxElement = document.getElementById('colorHexBox');

var colorValueStore = null;

function color_set_device(device_id)
{
    let device="procontroller";
    let sig_id = (device_id & 0xF000) >> 12;

    // Hide trigger picker
    let trigEl = document.getElementById("triggerLedPicker");
    trigEl.classList.add("disabled");

    if( (sig_id == 0xB))
    {
        console.log("Loaded SNES svg");
        device="snescontroller";
    }
    else if(sig_id == 0xC)
    {
        console.log("Loaded GC svg");
        device="gccontroller";
    }
    else 
    {
        console.log("Loaded ProCon svg");
        trigEl.classList.remove("disabled");
    }

    let loader = document.getElementById("colorSvgLoader");

    if(device=="snescontroller")
    {
        loader.setAttribute('data-src', 'svg/snescontroller.svg');
    }
    else if(device=="gccontroller")
    {
        loader.setAttribute('data-src', 'svg/gctypecontroller.svg');
    }
    else if(device=="procontroller")
    {
        loader.setAttribute('data-src', 'svg/procontroller.svg');
    }

    loader.setAttribute('oniconload', 'color_reload_values()');
}

// Debug
//color_set_device(0xF000);

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
        //console.log(element.id);
        
        element.addEventListener('click', function () {
            color_button_clicked(element.id);
        });
    });

    var els = document.querySelectorAll('.triggerColorBtn');

    els.forEach(function (element) {
        //console.log(element.id);
        
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
        el.style.background = hexString;
    }
    catch(err)
    {
        
    }
    
}

function svg_set_hex(id, hex) {
    var el = document.getElementById(id);
    el.style.fill = hex;
    el.style.background = hex;
}

function isNumber(value) {
    return typeof value === 'number';
}

async function color_set_value(id, hexColor) {
    var group = 0;
    var textId = "";
    
    switch (id) {
        default:
            group = -1;
            break;
    
        case 0:
        case "rightStick":
            textId = "rightStick";
            group = RGB_GROUP_RS;
            break;
    
        case 1:
        case "leftStick":
            textId = "leftStick";
            group = RGB_GROUP_LS;
            break;
    
        case 2:
        case "dpad":
            textId = "dpad";
            group = RGB_GROUP_DPAD;
            break;
    
        case 3:
        case "minusButton":
            textId = "minusButton";
            group = RGB_GROUP_MINUS;
            break;
    
        case 4:
        case "captureButton":
            textId = "captureButton";
            group = RGB_GROUP_CAPTURE;
            break;
    
        case 5:
        case "homeButton":
            textId = "homeButton";
            group = RGB_GROUP_HOME;
            break;
    
        case 6:
        case "plusButton":
            textId = "plusButton";
            group = RGB_GROUP_PLUS;
            break;
    
        case 7:
        case "yButton":
            textId = "yButton";
            group = RGB_GROUP_Y;
            break;
    
        case 8:
        case "xButton":
            textId = "xButton";
            group = RGB_GROUP_X;
            break;
    
        case 9:
        case "aButton":
            textId = "aButton";
            group = RGB_GROUP_A;
            break;
    
        case 10:
        case "bButton":
            textId = "bButton";
            group = RGB_GROUP_B;
            break;
    
        case 11:
        case "lButton":
            textId = "lButton";
            group = RGB_GROUP_L;
            break;
    
        case 12:
        case "zlButton":
            textId = "zlButton";
            group = RGB_GROUP_ZL;
            break;
    
        case 13:
        case "rButton":
            textId = "rButton";
            group = RGB_GROUP_R;
            break;
    
        case 14:
        case "zrButton":
            textId = "zrButton";
            group = RGB_GROUP_ZR;
            break;
    
        case 15:
        case "playerButton":
            textId = "playerButton";
            group = RGB_GROUP_PLAYER;
            break;
    }

    if (group > -1) {
        // Set SVG Element Color
        svg_set_hex(textId, hexColor);

        var rgb = hexToRgb(hexColor);

        if (device != null) {
            console.log(group);
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

function color_paste_all() {
    colorPicker.color.hexString = currentColor;

    for(var i = 0; i<RGB_GROUP_MAX; i++)
    {
        color_set_value(i, currentColor).then(null);
    }

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
        //c |= buttonEl.style.background;
        colorPicker.color.rgbaString = c;
    }
    else {
        colorPicker.color.hexString = "#ffffff";
        buttonEl.style.fill = colorPicker.color.rgbaString;
        buttonEl.style.background = "#ffffff";
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

function color_reload_values()
{
    if(colorValueStore != null)
    {
        color_place_values(colorValueStore);
    }

    color_page_init();
}

function color_place_values(data) {
    colorValueStore = data;
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

    i = i + 3;
    svg_set_rgb("lButton", d[i], d[i + 1], d[i + 2]);
    i = i + 3;
    svg_set_rgb("zlButton", d[i], d[i + 1], d[i + 2]);
    i = i + 3;
    svg_set_rgb("rButton", d[i], d[i + 1], d[i + 2]);
    i = i + 3;
    svg_set_rgb("zrButton", d[i], d[i + 1], d[i + 2]);
    i = i + 3;
    svg_set_rgb("playerButton", d[i], d[i + 1], d[i + 2]);
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
