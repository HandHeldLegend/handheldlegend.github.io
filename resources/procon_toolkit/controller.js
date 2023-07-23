let activeButton = null

// {[key: buttonId]: hexString}
const colors = {}

function onControllerLoad(element) {
    const colorPickerElem = document.getElementById('colorPicker')
    const colorPicker = new iro.ColorPicker('#colorPicker', {
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

    const lightHexElem = document.getElementById('lightHex')

    // mask the hex input
    lightHexElem.addEventListener('input', event => {
        const {value} = event.target
        const newValue = '#' + String(value).toLowerCase()
            .replaceAll(/[^0-9a-f]/g, '').slice(0, 6)

        if (newValue !== value) {
            lightHexElem.value = newValue
        }

        // only match 6 digit hex codes (7 after the #) to ensure we're not interpreting until it's done
        if (newValue.length === 7) {
            colorPicker.color.hexString = newValue
        }
    })

    document.getElementById('copyButton').addEventListener('click', () => {
        navigator.clipboard.writeText(colorPicker.color.hexString)
    })

    element.querySelectorAll('.clickable').forEach((el) => {
        const id = el.getAttribute('id')

        el.addEventListener('click', () => {
            if (activeButton === id) {
                activeButton = null
                colorPickerElem.classList.remove('enabled')
                lightHexElem.setAttribute('disabled', 'disabled')
            } else {
                if (activeButton) {
                    // deactivate
                    document.getElementById(activeButton).classList.remove('active')
                }

                activeButton = id
                el.classList.add('active')
                colorPickerElem.classList.add('enabled')
                lightHexElem.removeAttribute('disabled')
            }
        })
    })

    colorPicker.on('color:change', (color) => {
        if (!activeButton) {
            return
        }

        colors[activeButton] = color.hexString
        document.getElementById(activeButton).style.fill = color.rgbaString
        lightHexElem.value = color.hexString
    });
}
