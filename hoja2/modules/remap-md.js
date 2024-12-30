import HojaGamepad from '../gamepad/gamepad.js';

import NumberSelector from '../components/number-selector.js';
import MultiPositionButton from '../components/multi-position-button.js';
import GroupRgbPicker from '../components/group-rgb-picker.js';
import AngleSelector from '../components/angle-selector.js';
import RemapSelector from '../components/remap-selector.js';

import TristateButton from '../components/tristate-button.js';
import SingleShotButton from '../components/single-shot-button.js';

import { enableTooltips } from '../tooltips.js';
import Buttonremap from '../factory/parsers/buttonRemap.js';
import Remapconfig from '../factory/parsers/remapConfig.js';

const MAPCODE_DUP     = 0;
const MAPCODE_DDOWN   = 1;
const MAPCODE_DLEFT   = 2;
const MAPCODE_DRIGHT  = 3;
const MAPCODE_B_A = 4;
const MAPCODE_B_B = 5;

const MAPCODE_B_X = 6;
const MAPCODE_CUP = 6;

const MAPCODE_B_Y    = 7;
const MAPCODE_CDOWN  = 7;

const MAPCODE_T_L    = 8;
const MAPCODE_CLEFT  = 8;

const MAPCODE_T_ZL    = 9;

const MAPCODE_T_R     = 10;
const MAPCODE_CRIGHT  = 10;

const MAPCODE_T_ZR    = 11;

const MAPCODE_B_PLUS      = 12;
const MAPCODE_B_MINUS     = 13;
const MAPCODE_B_STICKL    = 14;
const MAPCODE_B_STICKR    = 15;

const inputMapCodes = [
    "D-Pad Up",
    "D-Pad Down",
    "D-Pad Left",
    "D-Pad Right",
    "A", "B", "X", "Y",
    "L", "ZL", "R", "ZR",
    "Plus", "Minus", "SL", "SR"
];

const snesMapCodes = [
    "D-Pad Up",
    "D-Pad Down",
    "D-Pad Left",
    "D-Pad Right",
    "A", "B", "X", "Y",
    "L", "~", "R", "~",
    "Start", "Select", "~", "~"
];

const xboxMapCodes = [
    "D-Pad Up",
    "D-Pad Down",
    "D-Pad Left",
    "D-Pad Right",
    "A", "B", "X", "Y",
    "LB", "LT", "RB", "RT",
    "Start", "Back", "SL", "SR"
];

const n64MapCodes = [
    "D-Pad Up",
    "D-Pad Down",
    "D-Pad Left",
    "D-Pad Right",
    "A", "B", "C-Up", "C-Down",
    "C-Left", "Z", "C-Right", "R",
    "Start", "L", "~", "~"
];

const gamecubeMapCodes = [
    "D-Pad Up",
    "D-Pad Down",
    "D-Pad Left",
    "D-Pad Right",
    "A", "B", "X", "Y",
    "Special Function", "L", "Z", "R",
    "Start", "~", "~", "~"
];

/** @type {HojaGamepad} */
const gamepad = HojaGamepad.getInstance();
const remapCfgBlockNumber = 1;

let remapPickers = null;

let remapSelectorContainer = null;
let currentContainer = null;

let resolveButtonPress;
let waitingForButton = false;

let currentProfileMode = 0;

async function writeRemapMemBlock() {
    await gamepad.sendBlock(remapCfgBlockNumber);
}

// Reload our remap values (not changing profiles only)
function softReloadRemapValues() {
    if(remapPickers) {
        remapPickers.forEach((e) => {
            let idxNum = parseInt( e.getAttribute("idx") );
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

    switch(inputNum)
    {
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
    for(let i = 0; i < 16; i++) {
        let outputValue = getOutputForInput(i);
        if(outputValue == targetOutput) {
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
    for(let i = 0; i < 16; i++) {
        let outputVal = getOutputForInput(i);
        if(outputVal == outputNum) return i;
    }

    return -1;
}

// In use, OK
function getOutputForInput(inputNum) {
    // Retrieve remapProfile copy for viewing data
    /** @type {Buttonremap} */
    let remapProfile = gamepad.remap_cfg.profiles[currentProfileMode];

    switch(inputNum)
    {
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

// In use, OK
function reportHook(data) {
    let buttonsAll = (data.getUint8(9) << 8) | (data.getUint8(10));

    if(waitingForButton) {
        let buttonIdxGot = -1;
        // Scan buttons
        for(let i = 0; i < 16; i++) {
            let found = (buttonsAll & (1<<(15-i))) ? true : false;
            if(found)
            {
                buttonIdxGot = 15-i;
                waitingForButton = false;
                resolveButtonPress(buttonIdxGot);
                break;
            }
        }
    }

    if(remapPickers) {
        remapPickers.forEach((e) => {
            let idx = parseInt(e.getAttribute('idx'));
            let matchingInput = getInputForOutput(idx);
            let masked = ((1<<matchingInput) & buttonsAll) ? true : false;
            if(masked) {
                
                e.setPressed(true);
            }
            else e.setPressed(false);
        });
    }
}

// In use, OK
function getCurrentMapCodeText(code) {
    let codes = inputMapCodes;

    switch(currentProfileMode)
    {
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
    }

    return codes[code];
}

// In use, OK
async function startListening(remapButtonElement) {
    // Output index really
    let idxText = remapButtonElement.getAttribute('idx');
    let idx = parseInt(idxText);

    if(remapPickers) {
        remapPickers.forEach(element => {
            let compidx = element.getAttribute('idx');

            if(compidx==idxText)
            {
                element.disableCaptureButton(true);
            }
            else 
                element.disableCaptureButton(false);
        });
    }
    else return;

    // Create a promise that resolves when a button is pressed
    const buttonPressed = new Promise((resolve) => {
        resolveButtonPress = resolve; // Assign the resolver function
        waitingForButton = true; // Set the flag to true
    });

    console.log(`Listening for press for ${getCurrentMapCodeText(idx)}`);
    const buttonPressedValue = await buttonPressed;
    console.log(`Button pressed: ${inputMapCodes[buttonPressedValue]}`);

    assignInputToOutput(buttonPressedValue, idx);

    console.log(`Assigned to: ${getCurrentMapCodeText(idx)}`);

    // Soft reload
    softReloadRemapValues();

    remapPickers.forEach(element => {
        element.enableCaptureButton();
    });
}

// Call to render the appropriate render mode
async function newRenderRemaps(inputMode) {
    currentProfileMode = inputMode;
    let buttons = gamepad.button_static.main_buttons;

    /** @type {Buttonremap} */
    let remapProfile = gamepad.remap_cfg.profiles[inputMode];
    let remapItemsHTML = "";
    let codes = null;

    switch(inputMode)
    {
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
    }

    for(let i = 0; i < 16; i++)
    {
        let idx = 15-i; // Inverted index for bit shifting
        let enabled = (buttons & ( 1<<idx) ) >> idx; // If this controller supports this specific button

        if(enabled && (codes[i]!="~")) {

            // Get input value for output
            let inputMatching = getInputForOutput(i);
            let inValue = (inputMatching < 0) ? "⊘" : inputMapCodes[inputMatching];

            remapItemsHTML += `
            <remap-selector
                idx="${i}",
                in-value="${inValue}",
                out-value="${codes[i]}",
            ></remap-selector>
            `
        }
    }

    //remapSelectorContainer.innerHTML = remapItemsHTML;

    remapSelectorContainer.setAttribute("hidden", "true"); // Fade out
    setTimeout(() => {
        remapSelectorContainer.innerHTML = remapItemsHTML;
        remapSelectorContainer.setAttribute("hidden", "false"); // Fade in
        // Get all remap Pickers
        remapPickers = remapSelectorContainer.querySelectorAll('remap-selector');

        remapPickers.forEach(element => {
            element.addEventListener('remap-change', async (e) => {
                if(e.detail.action == 'capture') {
                    startListening(element).then(() => {
                        console.log("Done listening");
                        writeRemapMemBlock();
                    });
                }
                else if(e.detail.action == 'clear') {
                    let idx = element.getAttribute('idx');
                    let idxNum = parseInt(idx);
                    // Just clear our output setting for this 
                    assignInputToOutput(-1, idxNum)
                    softReloadRemapValues();
                }
            });
        });

        enableTooltips(currentContainer);
    }, 300); // Match the transition duration
}

function resetProfileToDefault() {
    for(let i = 0; i<16; i++) {
        assignInputToOutput(i, i);
    }
    softReloadRemapValues();
    writeRemapMemBlock();
}

export function render(container) {
    currentContainer = container;

    container.innerHTML = `
            <h1>Remap Settings</h1>
            <div class="app-row">
                <single-shot-button 
                    id="reset-remap-button" 
                    state="ready" 
                    ready-text="Reset Profile" 
                    disabled-text="Reset Profile"
                    pending-text="Reset Profile"
                    tooltip="Reset this input profile to defaults."
                ></single-shot-button>
            </div>
            <multi-position-button 
                id="remap-mode-select" 
                labels="Switch, XInput, SNES, N64, GC"
                default-selected="0"
            ></multi-position-button>
            <remap-selector-container hidden="true"></remap-selector-container>
    `;

    remapSelectorContainer = container.querySelector('remap-selector-container');

    newRenderRemaps(0);

    const modeSelector = container.querySelector('multi-position-button[id="remap-mode-select"]');
    modeSelector.addEventListener('change', (e) => {
        console.log("Remap profile change");
        newRenderRemaps(e.detail.selectedIndex);
    });

    gamepad.setReportHook((data) => {
        reportHook(data);
    });

    const resetButton = container.querySelector('single-shot-button[id="reset-remap-button"]');
    resetButton.setOnClick(resetProfileToDefault);

    
}