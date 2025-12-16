import HojaGamepad from '../js/gamepad.js';

import MultiPositionButton from '../components/multi-position-button.js';
import SingleShotButton from '../components/single-shot-button.js';
import TristateButton from '../components/tristate-button.js';
import MacAddressSelector from '../components/mac-address-selector.js';
import NumberSelector from '../components/number-selector.js';
import GroupRgbPicker from '../components/group-rgb-picker.js';
import TextEntry from '../components/text-entry.js';

/** @type {HojaGamepad} */
let gamepad = HojaGamepad.getInstance();
const userCfgBlockNumber = 7;

/** @type {MultiPositionButton} */
let multiButton;

/** @type {SingleShotButton} */
let singleShot;

/** @type {TristateButton} */
let tristateButton;

/** @type {MacAddressSelector} */
let macSelector;

/** @type {NumberSelector} */
let numberSelector;

/** @type {GroupRgbPicker} */
let rgbPicker;

/** @type {TextEntry} */
let textEntry;

async function singleShotDemo() {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return true;
}

async function tristateOnDemo() {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return true;
}

async function tristateOffDemo() {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return true;
}

export function render(container) {
    container.innerHTML = `
            <h3>MultiPositionButton</h3>
            <multi-position-button 
                id="multi-button"
                options="Left, Right"
                width="100"
            ></multi-position-button>

            <h3>Single Shot Button</h3>
            <single-shot-button
                id="single-shot"
                width="60"
            ></single-shot-button>

            <h3>Tristate Button</h3>
            <tristate-button
                id="tristate"
                width="80"
            ></tristate-button>

            <h3>MAC Address Editor</h3>
            <mac-address-selector
            ></mac-address-selector>

            <h3>Number Selector</h3>
            <number-selector
                type="float"
                min="2.0"
                max="10.5"
                step="0.5"
                width="325"
            ></number-selector>

            <h3>RGB Picker</h3>
            <group-rgb-picker
                color="AABBCC"
            ></group-rgb-picker>

            <h3>Text Entry</h3>
            <text-entry
                placeholder="placeholder"
            ></text-entry

    `;

    // Multi Button Demo
    multiButton = container.querySelector('multi-position-button[id="multi-button"]');
    multiButton.addEventListener('change', (e) => {
        console.log(e.detail);
    });

    // Single Shot Button Demo
    singleShot = container.querySelector('single-shot-button[id="single-shot"]');
    singleShot.setOnClick(singleShotDemo);

    // Tristate Button Demo
    tristateButton = container.querySelector('tristate-button[id="tristate"]');
    tristateButton.setOnHandler(tristateOnDemo);
    tristateButton.setOffHandler(tristateOffDemo);

    // MAC Editor Demo
    macSelector = container.querySelector('mac-address-selector');
    macSelector.addEventListener('change', (e) => {
        console.log(e.detail);
    });

    // Number Selector Demo
    numberSelector = container.querySelector('number-selector');
    numberSelector.addEventListener('change', (e) => {
        console.log(e.detail);
    });
}