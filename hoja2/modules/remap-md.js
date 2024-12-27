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
    "Z (Left)", "L", "Z", "R",
    "Start", "~", "~", "~"
];

/** @type {HojaGamepad} */
const gamepad = HojaGamepad.getInstance();

let currentContainer = null;

/** @param {Buttonremap} remapProfile */
function returnMappingValue(remapProfile, idx) {
    switch(idx)
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

function newRenderRemaps(inputMode) {

    let buttons = gamepad.button_static.main_buttons;

    /** @type {Buttonremap} */
    let remapProfile = gamepad.remap_cfg.profiles[inputMode];
    console.log(remapProfile);

    let unsetProfile = gamepad.remap_cfg.disabled[inputMode];
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
        let disabled = (unsetProfile & (1<<idx)) >> idx; // If the unset profile has this button disabled

        if(enabled && (codes[i]!="~")) {

            let remapValue = returnMappingValue(remapProfile, i);
            let inValue = (disabled) ? "⊘" : inputMapCodes[remapValue]

            remapItemsHTML += `
            <remap-selector
                remap-idx="${i}",
                in-value="${inValue}",
                out-value="${codes[i]}",
            ></remap-selector>
            `
        }
    }

    currentContainer.innerHTML = `
            <h1>Remap Settings</h1>
            ${remapItemsHTML}
    `;

    enableTooltips(currentContainer);
}

export function render(container) {
    currentContainer = container;
    newRenderRemaps(3);
}