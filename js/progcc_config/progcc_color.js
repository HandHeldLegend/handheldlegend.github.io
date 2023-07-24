// {[key: buttonId]: hexString}
const colors = {}

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
        console.log("Color set");
    });

}
