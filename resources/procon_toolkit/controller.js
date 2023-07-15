let activeButton = null

// {[key: buttonId]: hexString}
const colors = {}

function onControllerLoad(element) {
    const colorPickerElem = document.getElementById('colorPicker')
    const colorPicker = new iro.ColorPicker('#colorPicker', {
        width: 150,
        layout: [
            {
                component: iro.ui.Wheel,
                options: {}
            },
            {
                component: iro.ui.Slider,
                options: {
                    // can also be 'saturation', 'value', 'red', 'green', 'blue', 'alpha' or 'kelvin'
                    sliderType: 'alpha'
                }

            }
        ]
    });

    element.querySelectorAll('.clickable').forEach((el) => {
        const id = el.getAttribute('id')

        el.addEventListener('click', event => {
            if (activeButton === id) {
                activeButton = null
                colorPickerElem.classList.remove('enabled')
            } else {
                if (activeButton) {
                    // deactivate
                    document.getElementById(activeButton).classList.remove('active')
                }

                activeButton = id
                el.classList.add('active')
                colorPickerElem.classList.add('enabled')
            }
        })
    })

    colorPicker.on('color:change', (color) => {
        if (!activeButton) {
            return
        }

        colors[activeButton] = color.hexString
        document.getElementById(activeButton).style.fill = color.rgbaString
        console.log(color)
    });
}