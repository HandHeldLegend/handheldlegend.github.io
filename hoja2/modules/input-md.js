import HojaGamepad from '../js/gamepad.js';

import InputMappingDisplay from '../components/input-mapping-display.js';
import InputConfigPanel from '../components/input-config-panel.js';
import ButtonGrid from '../components/button-grid.js';
import MultiPositionButton from '../components/multi-position-button.js';

import { enableTooltips } from '../js/tooltips.js';
import Inputinfoslot from '../factory/parsers/inputInfoSlot.js';

/** @type {HojaGamepad} */
const gamepad = HojaGamepad.getInstance();
const gamepadCfgBlockNumber = 0;

/** @type {InputMappingDisplay[]} */
let inputMappingDisplays = [];

let blurElement = null;
let configPanelElement = null;

/** @type {InputConfigPanel} */
let configPanelComponent = null;
let remapPanelElement = null;

/** @type {ButtonGrid} */
let buttonGridComponent = null;

let currentRemapProfileIndex = 0;

/** @type {MultiPositionButton} */
let multiPositionButtonComponent = null;

let containerElement = null;

// Store the currently loaded remap info
// for all 36 input/output slots
let remapInfoList = [];

const switchOutputCodeNames = [
    'A', 'B', 'X', 'Y',
    'D Up', 'D Down', 'D Left', 'D Right',
    'L', 'R', 'ZL', 'ZR',
    'Plus', 'Minus', 'Home', 'Capture',
    'LS', 'RS', 
    'LX+', 'LX-', 'LY+', 'LY-',
    'RX+', 'RX-', 'RY+', 'RY-'
];

const xinputOutputCodeNames = [
    'A', 'B', 'X', 'Y',
    'D Up', 'D Down', 'D Left', 'D Right',
    'LB', 'RB', 'Start', 'Back',
    'Guide', 'LS', 'RS',
    'LT', 'RT',
    'LX+', 'LX-', 'LY+', 'LY-',
    'RX+', 'RX-', 'RY+', 'RY-'
];

const snesOutputCodeNames = [
    'A', 'B', 'X', 'Y',
    'D Up', 'D Down', 'D Left', 'D Right',
    'L', 'R', 'Start', 'Select'
];

const n64OutputCodeNames = [
    'A', 'B', 'C Up', 'C Down', 'C Left', 'C Right',
    'D Up', 'D Down', 'D Left', 'D Right',
    'L', 'R',  'Z', 'Start', 
    'X+', 'X-', 'Y+', 'Y-'
];

const gamecubeOutputCodeNames = [
    'A', 'B', 'X', 'Y',
    'D Up', 'D Down', 'D Left', 'D Right',
    'Start', 'Z', 'L', 'R',
    'LT', 'RT', 
    'X+', 'X-', 'Y+', 'Y-',
    'CX+', 'CX-', 'CY+', 'CY-'
];

function getGlyphUrlByName(name) {
    const normalizedName = name.toLowerCase().replace(/\s+/g, '');
    return `./images/glyphs/${normalizedName}.png`;
}

function inputReportHook(data) {

    if(!inputMappingDisplays || inputMappingDisplays.length == 0) {
        return;
    }

    for (let i = 16; i < (16 + 36); i++) {
        let idxOutput = i - 16;
        let info = remapInfoList[idxOutput];
        let mappingDisplayIdx = info.inputMappingIdx;
        let inputValue = data.getUint8(i);

        switch(info.inputType) {
            case 1: // Button
            if(inputValue > 0) {
                inputMappingDisplays[mappingDisplayIdx].setValue(255);
                inputMappingDisplays[mappingDisplayIdx].setPressed(true);
            }
            else {
                inputMappingDisplays[mappingDisplayIdx].setValue(0);
                inputMappingDisplays[mappingDisplayIdx].setPressed(false);
            }
            break;

            case 2: // Hover
            inputMappingDisplays[mappingDisplayIdx].setValue(inputValue);
            inputMappingDisplays[mappingDisplayIdx].setPressed(inputValue > 0);
            break;

            case 3: // Joystick
            break;

            default: // Unused
            break;
        }
    }
}

async function writeGamepadMemBlock() {
    await gamepad.sendBlock(gamepadCfgBlockNumber);
}

function decodeText(buffer) {
    const decoder = new TextDecoder('utf-8');
    const str = decoder.decode(buffer);

    // Remove any null characters (0x00) from the string
    return str.replace(/\x00/g, '');
}

function closeOverlays() {
    if (!remapPanelElement) return;
    remapPanelElement.classList.add('hidden');

    if (!configPanelElement) return;
    configPanelElement.classList.add('hidden');

    if (!blurElement) return;
    blurElement.classList.add('hidden');
}

function openRemapPanel() {

    if (!blurElement) return;
    blurElement.classList.remove('hidden');

    if (!remapPanelElement) return;
    remapPanelElement.classList.remove('hidden');
}

function remapClickHandler(event) {
    console.log("Remap clicked:", event);
    switch (event.index) {
        case -2: // Cancel
            closeRemapPanel();
            return;
        case -1: // Unmap
            configPanelComponent.setOutputLabelAndType('Disabled', 'none');
            closeRemapPanel();
            break;

        default:
            configPanelComponent.setOutputLabelAndType(event.label, 'analog');
            closeRemapPanel();
            break;
    }
}

function closeRemapPanel() {
    if (!remapPanelElement) return;
    remapPanelElement.classList.add('hidden');
}

function inputMapClicked(event) {
    console.log("Input mapping clicked:", event.inputLabel);

    configPanelComponent.setInputLabelAndType(event.inputLabel, 'analog');
    configPanelComponent.setOutputLabelAndType(event.outputLabel, 'analog');

    if (!configPanelElement) return;
    configPanelElement.classList.remove('hidden');

    if (!blurElement) return;
    blurElement.classList.remove('hidden');
}

function populateRemapInfoList(profileIndex, container) {
    
    let tmpProfile;
    let tmpNames;

    switch(profileIndex) {
        // Switch
        default:
        case 0:
            tmpProfile = gamepad.input_cfg.input_profile_switch;
            tmpNames = switchOutputCodeNames;
            break;

        // XInput
        case 1:
            tmpProfile = gamepad.input_cfg.input_profile_xinput;
            tmpNames = xinputOutputCodeNames;
            break;

        // SNES
        case 2:
            tmpProfile = gamepad.input_cfg.input_profile_snes;
            tmpNames = snesOutputCodeNames;
            break;

        // N64
        case 3:
            tmpProfile = gamepad.input_cfg.input_profile_n64;
            tmpNames = n64OutputCodeNames;
            break;
        
        // GameCube
        case 4:
            tmpProfile = gamepad.input_cfg.input_profile_gamecube;
            tmpNames = gamecubeOutputCodeNames;
            break;
    }

    let mapIdx = 0;

    // Clear existing list
    remapInfoList = [];

    tmpProfile.forEach((outputInfo, index) => {
        let outputMode = outputInfo.output_mode;
        let outputCode = outputInfo.output_code;
        let outputName = tmpNames[outputCode] || `Disabled`;
        let outputType = outputInfo.output_type;
        let outputThresholdDelta = outputInfo.threshold_delta;
        let outputStaticOutput = outputInfo.static_output;
        let inputInfoList = gamepad.input_static.input_info;
        let inputMapIdx = mapIdx;
        if(inputInfoList[index].input_type != 0) {
            mapIdx++;
        }

        remapInfoList.push({
            inputName : decodeText(inputInfoList[index].input_name),
            inputType : inputInfoList[index].input_type,
            inputMappingIdx : inputMapIdx,
            outputName: outputName,
            outputCode: outputCode,
            outputMode: outputMode,
            outputType: outputType,
            thresholdDelta: outputThresholdDelta,
            staticOutput: outputStaticOutput
        });
    });

    // Set input remap picker names
    if(buttonGridComponent) {
        buttonGridComponent.setButtons(tmpNames);
    }

    let moduleGridHTML = '';

    remapInfoList.forEach((info, index) => {
        // Make sure input is used
        if(info.inputType != 0) 
        {
            const inputGlyphUrl = getGlyphUrlByName(info.inputName);
            const outputGlyphUrl = getGlyphUrlByName(info.outputName);
            moduleGridHTML += `<input-mapping-display input-icon="${inputGlyphUrl}" input-label="${info.inputName}" output-icon="${outputGlyphUrl}" output-label="${info.outputName}" value="0" pressed="false"></input-mapping-display>`;
        }
    });

    if(container) {
        // Replace div id 'module-grid-placeholder' with the generated HTML
        const placeholderDiv = container.querySelector('#module-grid-placeholder');
        if(placeholderDiv) {
            placeholderDiv.innerHTML = moduleGridHTML;
        }
    }

    if(buttonGridComponent) {
        buttonGridComponent.setButtons(tmpNames);
    }

    inputMappingDisplays = container.querySelectorAll('input-mapping-display');
    inputMappingDisplays.forEach((mapping) => {
        mapping._onClick = inputMapClicked;
    });
}

export function render(container) {
    containerElement = container;

    container.innerHTML = `
            <h2>Input Mode</h2>
            <multi-position-button 
                id="input-mode-select" 
                labels="SW, XI, SNES, N64, GC"
                default-selected="0"
            ></multi-position-button>
            <div id="panel_blur" class="popup-blur hidden" style="z-index: 199;"></div>

            <div id="config_panel" class="popup hidden" style="z-index: 200;">
                <input-config-panel></input-config-panel>
            </div>

            <div id="remap_panel" class="popup hidden" style="z-index: 201;">
                <button-grid id="gamepad_grid"></button-grid>
            </div>

            <h2>Input Setup</h2>
            <div id="module-grid-placeholder" class="module-grid">
            </div>
    `;

    // Load output info list from default profile (switch)
    populateRemapInfoList(currentRemapProfileIndex, containerElement);

    multiPositionButtonComponent = container.querySelector('multi-position-button[id="input-mode-select"]');
    multiPositionButtonComponent.addEventListener('change', (e) => {
        const selectedIndex = e.detail.selectedIndex;
        console.log("Input mode changed to index:", selectedIndex);
        currentRemapProfileIndex = selectedIndex;
        populateRemapInfoList(currentRemapProfileIndex, containerElement);
    });

    configPanelComponent = container.querySelector('input-config-panel');

    remapPanelElement = container.querySelector('#remap_panel');
    buttonGridComponent = container.querySelector('button-grid[id="gamepad_grid"]');

    buttonGridComponent._onClick = remapClickHandler;
    // The default option set is the Switch profile
    buttonGridComponent.setButtons(switchOutputCodeNames);

    blurElement = container.querySelector('#panel_blur');

    configPanelElement = container.querySelector('#config_panel');

    configPanelComponent._onClose = closeOverlays;

    blurElement.addEventListener('click', (e) => {
        if (e.target === blurElement) {
            closeOverlays();
        }
    });

    configPanelComponent.setOutputSelectorHandler(() => {
        openRemapPanel();
    });

    // Populate the button grid with input labels
    //buttonGridComponent.setButtons(inputList);

    // Set report hook
    gamepad.setReportHook(inputReportHook);
}