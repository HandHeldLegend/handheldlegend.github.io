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
    "D-Up", "D-Down", "D-Left", "D-Right",
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
    "D-Up", "D-Down", "D-Left", "D-Right",
    "L", "R", "ZL", "ZR",
    "Plus", "Minus", "Home", "Capture",
    "LS", "RS",
    "LX+", "LX-", "LY+", "LY-",
    "RX+", "RX-", "RY+", "RY-"
];

const snesMapCodes = [
    "A", "B", "X", "Y",
    "D-Up", "D-Down", "D-Left", "D-Right",
    "L", "R",
    "Start", "Select"
];

const xboxMapCodes = [
    "A", "B", "X", "Y",
    "D-Up", "D-Down", "D-Left", "D-Right",
    "LB", "RB",
    "Start", "Back", "Guide",
    "LS", "RS",
    "LT Full", "RT Full",
    "LT Analog", "RT Analog",
    "LX+", "LX-", "LY+", "LY-",
    "RX+", "RX-", "RY+", "RY-"
];

const n64MapCodes = [
    "A", "B",
    "C-Up", "C-Down", "C-Left", "C-Right",
    "D-Up", "D-Down", "D-Left", "D-Right",
    "L", "R", "Z",
    "Start", "X+", "X-", "Y+", "Y-"
];

const gamecubeMapCodes = [
    "A", "B", "X", "Y",
    "D-Up", "D-Down", "D-Left", "D-Right",
    "Start",
    "Z", "L", "R",
    "L Analog", "R Analog",
    "LX+", "LX-", "LY+", "LY-",
    "RX+", "RX-", "RY+", "RY-"
];

/** @type {HojaGamepad} */
const gamepad = HojaGamepad.getInstance();
const remapCfgBlockNumber = 1;

/** @type {RemapBox} */
let remapBox = null;

let currentContainer = null;
let currentMode = 0;

async function writeRemapMemBlock() {
    await gamepad.sendBlock(remapCfgBlockNumber);
}

function inputReportHook(data) {
    if(remapBox==null) return;

    const lt = data.getUint8(13) << 8 | data.getUint8(14);
    const rt = data.getUint8(15) << 8 | data.getUint8(16);
    let lx = (data.getUint8(29) << 8) | (data.getUint8(30));
    let ly = ( (data.getUint8(31) << 8) | (data.getUint8(32)) );
    lx -= 2048;
    ly -= 2048;

    let rx = (data.getUint8(33) << 8) | (data.getUint8(34));
    let ry = ( (data.getUint8(35) << 8) | (data.getUint8(36)) );
    rx -= 2048;
    ry -= 2048;

    if(lx > 0) {
        remapBox.setInputValue(24, lx);
    }
    else if (lx < 0) {
        remapBox.setInputValue(25, -lx);
    }
    else {
        remapBox.setInputValue(24, 0);
        remapBox.setInputValue(25, 0);
    }

    if(ly > 0) {
        remapBox.setInputValue(26, ly);
    }
    else if (ly < 0) {
        remapBox.setInputValue(27, -ly);
    }
    else {
        remapBox.setInputValue(26, 0);
        remapBox.setInputValue(27, 0);
    }

    if(rx > 0) {
        remapBox.setInputValue(28, rx);
    }
    else if (rx < 0) {
        remapBox.setInputValue(29, -rx);
    }
    else {
        remapBox.setInputValue(28, 0);
        remapBox.setInputValue(29, 0);
    }

    if(ry > 0) {
        remapBox.setInputValue(30, ry);
    }
    else if (ry < 0) {
        remapBox.setInputValue(31, -ry);
    }
    else {
        remapBox.setInputValue(30, 0);
        remapBox.setInputValue(31, 0);
    }

    const buttons0 = data.getUint8(12);
    const buttons1 = data.getUint8(11);
    const buttons2 = data.getUint8(10);

    // Buttons
    for(let i = 0; i < 8; i++) {
        remapBox.setInputValue(i, (1<<i)&buttons0);
        remapBox.setInputValue(i+8, (1<<i)&buttons1);
    }

    remapBox.setInputValue(16, (1 & buttons2));
    remapBox.setInputValue(17, (1<<1) & buttons2);
    remapBox.setInputValue(18, (1<<2) & buttons2);
    remapBox.setInputValue(19, (1<<3) & buttons2);

    remapBox.setInputValue(22, lt);
    remapBox.setInputValue(23, rt);

}

async function resetProfileToDefault() {
    let {status, data} = await gamepad.sendConfigCommand(remapCfgBlockNumber, 1);

    if(status) {
        // reload blocks
        await gamepad.requestBlock(remapCfgBlockNumber);
        updateRemapBox(currentMode);
        return true;
    }

    return false;
}

async function updateRemapOutput(inputMode, input, output) {
    let mappings = [];
    switch(inputMode) {
        default:
        case 0: // Switch
        mappings = gamepad.remap_cfg.remap_profile_switch;
        mappings[input] = output;
        gamepad.remap_cfg.remap_profile_switch = mappings;
        break;

        case 1: // XInput
        mappings = gamepad.remap_cfg.remap_profile_xinput;
        mappings[input] = output;
        gamepad.remap_cfg.remap_profile_xinput = mappings;
        break;

        case 2: // SNES
        mappings = gamepad.remap_cfg.remap_profile_snes;
        mappings[input] = output;
        gamepad.remap_cfg.remap_profile_snes = mappings;
        break;

        case 3: // N64
        mappings = gamepad.remap_cfg.remap_profile_n64;
        mappings[input] = output;
        gamepad.remap_cfg.remap_profile_n64 = mappings;
        break;

        case 4: // GameCube
        mappings = gamepad.remap_cfg.remap_profile_gamecube;
        mappings[input] = output;
        gamepad.remap_cfg.remap_profile_gamecube = mappings;
        break;
    }

    await writeRemapMemBlock();
}

function updateRemapBox(inputMode) {
    // Setup inputs based on gamepad
    let mask = gamepad.button_static.remap_mask;
    remapBox.setInputs(inputMapCodes, mask);

    let mappings = [];

    switch(inputMode) {
        default:
        case 0: // Switch
        remapBox.setOutputs(switchMapCodes);
        mappings = gamepad.remap_cfg.remap_profile_switch;
        break;

        case 1: // XInput
        remapBox.setOutputs(xboxMapCodes);
        mappings = gamepad.remap_cfg.remap_profile_xinput;
        break;

        case 2: // SNES
        remapBox.setOutputs(snesMapCodes);
        mappings = gamepad.remap_cfg.remap_profile_snes;
        break;

        case 3: // N64
        remapBox.setOutputs(n64MapCodes);
        mappings = gamepad.remap_cfg.remap_profile_n64;
        break;

        case 4: // GameCube
        remapBox.setOutputs(gamecubeMapCodes);
        mappings = gamepad.remap_cfg.remap_profile_gamecube;
        break;
    }

    for(let i = 0; i < inputMapCodes.length; i++) {
        remapBox.selectOutput(i, mappings[i]);
    }

    remapBox.render();
}

export function render(container) {
    currentContainer = container;

    container.innerHTML = `
    <multi-position-button 
        id="remap-mode" 
        labels="SW, XI, SNES, N64, GC"
        default-selected="0"
    ></multi-position-button>
    <remap-box></remap-box> 
    <single-shot-button 
        tooltip="Reset all remaps to default."
        id="remap-default-btn" 
        state="ready"
        ready-text="Reset" 
        pending-text="Resetting..."
    ></single-shot-button>
    `;

    /** @type {RemapBox} */
    const box = container.querySelector('remap-box');
    remapBox = box;

    box.addEventListener('mapping-changed', async (e) => {
            console.log("Changed output. Input: " + e.detail.inputIndex + " Output: " + e.detail.outputIndex);
            await updateRemapOutput(currentMode, e.detail.inputIndex, e.detail.outputIndex);
    });

    const resetButton = container.querySelector('single-shot-button[id="remap-default-btn"]');
    resetButton.setOnClick(resetProfileToDefault);

    const modeSwitch = container.querySelector('multi-position-button[id="remap-mode"]');

    modeSwitch.addEventListener('change', (e) => {
            console.log("Input profile change");
            currentMode = e.detail.selectedIndex;
            updateRemapBox(currentMode);
        });

    gamepad.setReportHook(inputReportHook);

    updateRemapBox(0);

    enableTooltips(container);
} 