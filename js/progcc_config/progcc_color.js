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

async function onColorFinished(id, hexColor) {
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

    if (group > -1)
    {
        await set_rgb_color(group, hexColor);
    }
    else
    {
        console.log("Invalid group ID.");
    }

}

var currentColor = "#FFFFFF";
let activeButtonId = null;
let colorPickerEl = null;
let hexBoxEl = null;
let colorPicker = null;

function colorCopy() {
    currentColor = colorPicker.color.hexString;
    navigator.clipboard.writeText(currentColor);
}

function colorPaste() {
    colorPicker.color.hexString = currentColor;
}

function colorSelectButton(id) {
    console.log("Button picked: " + id);

    if (activeButtonId == null) {
        colorPickerEl.classList.add('enabled');
    }

    if (activeButtonId != null) {
        document.getElementById(activeButtonId).classList.remove('active');
    }

    activeButtonId = id;
    var buttonEl = document.getElementById(id);
    buttonEl.classList.add('active');

    if (buttonEl.style.fill != "") {
        var c = buttonEl.style.fill;
        colorPicker.color.rgbaString = c;
    }
    else {
        colorPicker.color.hexString = "#ffffff";
        buttonEl.style.fill = colorPicker.color.rgbaString;
    }
}

function onProgccColorLoad(element) {
    colorPickerEl = document.getElementById('colorPicker');

    var els = document.querySelectorAll('.svgButtonClickable');

    els.forEach(function (element) {
        element.addEventListener('click', function () {
            colorSelectButton(element.id);
        });
    });

    hexBoxEl = document.getElementById('lightHex');
    hexBoxEl.value = "#ffffff";

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

    colorPicker.on('color:change', (color) => {
        if (activeButtonId != null) {
            document.getElementById(activeButtonId).style.fill = color.rgbaString;
            hexBoxEl.value = color.hexString;
        }

    });

    colorPicker.on('input:end', (color) => {
        console.log("Color set: " + color.hexString);
        onColorFinished(activeButtonId, color.hexString).then(null);
    });

}
