import HojaGamepad from '../js/gamepad.js';

import NumberSelector from '../components/number-selector.js';
import MultiPositionButton from '../components/multi-position-button.js';

import TristateButton from '../components/tristate-button.js';
import SingleShotButton from '../components/single-shot-button.js';

import { enableTooltips } from '../js/tooltips.js';
import Buttonremap from '../factory/parsers/buttonRemap.js';
import RemapBox from '../components/remap-box.js';

const inputMapCodes = [
    "South", "East", "West", "North",
    "Up", "Down", "Left", "Right",
    "L1", "R1", "L2", "R2",
    "Start", "Select", "Home", "Capture",
    "L3", "R3",
    "L4", "R4",
    "L5", "R5",
    "L2 Analog", "R2 Analog",
    "LX+", "LX-", "LY+", "LY-",
    "RX+", "RX-", "RY+", "RY-"
];

const switchMapCodes = [
    "A", "B", "X", "Y",
    "Up", "Down", "Left", "Right",
    "L", "R", "ZL", "ZR",
    "Plus", "Minus", "Home", "Capture",
    "LS", "RS",
    "LX+", "LX-", "LY+", "LY-",
    "RX+", "RX-", "RY+", "RY-"
];

const snesMapCodes = [
    "A", "B", "X", "Y",
    "Up", "Down", "Left", "Right",
    "L", "R",
    "Start", "Select"
];

const xboxMapCodes = [
    "A", "B", "X", "Y",
    "Up", "Down", "Left", "Right",
    "LB", "RB",
    "Start", "Back", "Guide",
    "LS", "RS",
    "LT Analog", "RT Analog",
    "LX+", "LX-", "LY+", "LY-",
    "RX+", "RX-", "RY+", "RY-"
];

const n64MapCodes = [
    "A", "B",
    "C-Up", "C-Down", "C-Left", "C-Right",
    "L", "R", "Z",
    "Start", "X+", "X-", "Y+", "Y-"
];

const gamecubeMapCodes = [
    "A", "B", "X", "Y",
    "Up", "Down", "Left", "Right",
    "Start",
    "Z", "L", "R",
    "L Analog", "R Analog",
    "LX+", "LX-", "LY+", "LY-",
    "RX+", "RX-", "RY+", "RY-"
];

/** @type {HojaGamepad} */
const gamepad = HojaGamepad.getInstance();
const remapCfgBlockNumber = 1;


let buttonListener = null;
let remapPickers = null;

let remapSelectorContainer = null;
let currentContainer = null;

let currentProfileMode = 0;

async function writeRemapMemBlock() {
    await gamepad.sendBlock(remapCfgBlockNumber);
}

// Reload our remap values (not changing profiles only)
function softReloadRemapValues() {
    if (remapPickers) {
        remapPickers.forEach((e) => {
            let idxNum = parseInt(e.getAttribute("idx"));
            let inputNum = getInputForOutput(idxNum);

            let writeValue = (inputNum < 0) ? "⊘" : inputMapCodes[inputNum];

            // Update the input value
            e.setInValue(writeValue);
        });
    }
}

// Set the actual gamepad config data
function setOutputForInput(inputNum, targetOutput) {
    // Retrieve remapProfile copy for viewing data
    /** @type {Buttonremap} */
    let remapProfiles = gamepad.remap_cfg.profiles;
    let remapProfile = remapProfiles[currentProfileMode];

    switch (inputNum) {
        case 0:
            remapProfile.dpad_up = targetOutput;
            break;

        case 1:
            remapProfile.dpad_down = targetOutput;
            break;

        case 2:
            remapProfile.dpad_left = targetOutput;
            break;

        case 3:
            remapProfile.dpad_right = targetOutput;
            break;

        case 4:
            remapProfile.button_a = targetOutput;
            break;

        case 5:
            remapProfile.button_b = targetOutput;
            break;

        case 6:
            remapProfile.button_x = targetOutput;
            break;

        case 7:
            remapProfile.button_y = targetOutput;
            break;

        case 8:
            remapProfile.trigger_l = targetOutput;
            break;

        case 9:
            remapProfile.trigger_zl = targetOutput;
            break;

        case 10:
            remapProfile.trigger_r = targetOutput;
            break;

        case 11:
            remapProfile.trigger_zr = targetOutput;
            break;

        case 12:
            remapProfile.button_plus = targetOutput;
            break;

        case 13:
            remapProfile.button_minus = targetOutput;
            break;

        case 14:
            remapProfile.button_stick_left = targetOutput;
            break;

        case 15:
            remapProfile.button_stick_right = targetOutput;
            break;
    }

    remapProfiles[currentProfileMode] = remapProfile;
    gamepad.remap_cfg.profiles = remapProfiles;
}

// The function we call to assign
function assignInputToOutput(buttonInput, targetOutput) {
    // First, we must unset any button that has the same output
    // as our targetOutput
    for (let i = 0; i < 16; i++) {
        let outputValue = getOutputForInput(i);
        if (outputValue == targetOutput) {
            console.log("Unassigned a button.");
            setOutputForInput(i, -1);
        }
    }

    // FInally, set our output according to our input
    setOutputForInput(buttonInput, targetOutput);

    // We have ensured that we only have one button doing 
    // the same output action!
}

// In use, OK
// Get input number assigned to this output.
// -1 indicates nothing is mapped to this
function getInputForOutput(outputNum) {
    for (let i = 0; i < 16; i++) {
        let outputVal = getOutputForInput(i);
        if (outputVal == outputNum) return i;
    }

    return -1;
}

// In use, OK
function getOutputForInput(inputNum) {
    // Retrieve remapProfile copy for viewing data
    /** @type {Buttonremap} */
    let remapProfile = gamepad.remap_cfg.profiles[currentProfileMode];

    switch (inputNum) {
        case 0:
            return remapProfile.dpad_up;
            break;

        case 1:
            return remapProfile.dpad_down;
            break;

        case 2:
            return remapProfile.dpad_left;
            break;

        case 3:
            return remapProfile.dpad_right;
            break;

        case 4:
            return remapProfile.button_a;
            break;

        case 5:
            return remapProfile.button_b;
            break;

        case 6:
            return remapProfile.button_x;
            break;

        case 7:
            return remapProfile.button_y;
            break;

        case 8:
            return remapProfile.trigger_l;
            break;

        case 9:
            return remapProfile.trigger_zl;
            break;

        case 10:
            return remapProfile.trigger_r;
            break;

        case 11:
            return remapProfile.trigger_zr;
            break;

        case 12:
            return remapProfile.button_plus;
            break;

        case 13:
            return remapProfile.button_minus;
            break;

        case 14:
            return remapProfile.button_stick_left;
            break;

        case 15:
            return remapProfile.button_stick_right;
            break;
    }
}

function reportHook(data) {
    let buttonsAll = (data.getUint8(9) << 8) | (data.getUint8(10));

    if (buttonListener) {
        if (buttonListener.isListening()) {
            // Scan buttons
            for (let i = 0; i < 16; i++) {
                if (buttonsAll & (1 << i) ? true : false) {
                    buttonListener.handleButtonPress(i);
                    break;
                }
            }
        }
    }

    if (remapPickers) {
        remapPickers.forEach((e) => {
            let idx = parseInt(e.getAttribute('idx'));
            let matchingInput = getInputForOutput(idx);
            let masked = ((1 << matchingInput) & buttonsAll) ? true : false;
            e.setPressed(masked);
        });
    }
}

// In use, OK
function getCurrentMapCodeText(code) {
    let codes = inputMapCodes;

    switch (currentProfileMode) {
        case 0:
            codes = inputMapCodes;
            break;

        case 1:
            codes = xboxMapCodes;
            break;

        case 2:
            codes = snesMapCodes;
            break;

        case 3:
            codes = n64MapCodes;
            break;

        case 4:
            codes = gamecubeMapCodes;
            break;

        case 5:
            codes = steamMapCodes;
            break;
    }

    return codes[code];
}

async function startListening(remapButtonElement) {
    // Initialize the singleton instance if it doesn't exist
    if (!buttonListener) {
        buttonListener = new ButtonListener();
    }

    if (remapPickers) {
        remapPickers.forEach(element => {
            let compidx = element.getAttribute('idx');
            if (compidx === remapButtonElement.getAttribute('idx')) {
                element.disableCaptureButton(true);
            } else {
                element.disableCaptureButton(false);
            }
        });
    } else return;

    try {
        const idx = parseInt(remapButtonElement.getAttribute('idx'));
        console.log(`Listening for press for ${getCurrentMapCodeText(idx)}`);

        const buttonPressedValue = await buttonListener.startListening();
        console.log(`Button pressed: ${inputMapCodes[buttonPressedValue]}`);

        assignInputToOutput(buttonPressedValue, idx);
        console.log(`Assigned to: ${getCurrentMapCodeText(idx)}`);

        softReloadRemapValues();
    } catch (error) {
        console.warn('Button listening cancelled:', error);
    } finally {
        remapPickers.forEach(element => {
            element.enableCaptureButton();
        });
    }
}

export function render(container) {
    currentContainer = container;

    container.innerHTML = `
    <remap-box></remap-box> 
    `;

    /** @type {RemapBox} */
    const box = container.querySelector('remap-box');

    box.setInputs(inputMapCodes);
    box.setOutputs(snesMapCodes);

    box.setInputType(22, true);
    box.setInputValue(22, 2000);

    const resetButton = container.querySelector('single-shot-button[id="reset-remap-button"]');
    //resetButton.setOnClick(resetProfileToDefault);
} 