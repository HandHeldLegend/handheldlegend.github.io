import HojaGamepad from '../js/gamepad.js';

import InputMappingDisplay from '../components/input-mapping-display.js';
import InputConfigPanel from '../components/input-config-panel.js';
import ButtonGrid from '../components/button-grid.js';
import MultiPositionButton from '../components/multi-position-button.js';

import { enableTooltips } from '../js/tooltips.js';
import Inputinfoslot from '../factory/parsers/inputInfoSlot.js';
import Inputconfigslot from '../factory/parsers/inputConfigSlot.js';

/** @type {HojaGamepad} */
const gamepad = HojaGamepad.getInstance();
const inputCfgBlockNumber = 8;

let currentFocusedInput = 0;

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

let mappingDisplayIdx = [];

const CHANGE_CMD_SWITCH = 8;
const CHANGE_CMD_XINPUT = 9;
const CHANGE_CMD_SNES = 10;
const CHANGE_CMD_N64 = 11;
const CHANGE_CMD_GAMECUBE = 12;

const switchOutputCodeNames = [
    'A', 'B', 'X', 'Y',
    'D Up', 'D Down', 'D Left', 'D Right',
    'L', 'R', 'ZL', 'ZR',
    'Plus', 'Minus', 'Home', 'Capture',
    'LS', 'RS', 
    'LX+', 'LX-', 'LY+', 'LY-',
    'RX+', 'RX-', 'RY+', 'RY-'
];

const switchOutputTypes = [
    1, 1, 1, 1,
    4, 4, 4, 4,
    1, 1, 1, 1,
    1, 1, 1, 1,
    1, 1,
    3, 3, 3, 3,
    3, 3, 3, 3
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

const xinputOutputTypes = [
    1, 1, 1, 1,
    4, 4, 4, 4,
    1, 1, 1, 1,
    1, 1, 1,
    2, 2,
    3, 3, 3, 3,
    3, 3, 3, 3
];

const snesOutputCodeNames = [
    'A', 'B', 'X', 'Y',
    'D Up', 'D Down', 'D Left', 'D Right',
    'L', 'R', 'Start', 'Select'
];

const snesOutputTypes = [
    1, 1, 1, 1,
    4, 4, 4, 4,
    1, 1, 1, 1
];

const n64OutputCodeNames = [
    'A', 'B', 'C Up', 'C Down', 'C Left', 'C Right',
    'D Up', 'D Down', 'D Left', 'D Right',
    'L', 'R',  'Z', 'Start', 
    'X+', 'X-', 'Y+', 'Y-'
];

const n64OutputTypes = [
    1, 1, 1, 1, 1, 1,
    4, 4, 4, 4,
    1, 1, 1, 1,
    3, 3, 3, 3
];

const gamecubeOutputCodeNames = [
    'A', 'B', 'X', 'Y',
    'D Up', 'D Down', 'D Left', 'D Right',
    'Start', 'Z', 'L', 'R',
    'LT', 'RT', 
    'X+', 'X-', 'Y+', 'Y-',
    'CX+', 'CX-', 'CY+', 'CY-'
];

const gamecubeOutputTypes = [
    1, 1, 1, 1,
    4, 4, 4, 4,
    1, 1, 1, 1,
    2, 2,
    3, 3, 3, 3,
    3, 3, 3, 3
];

function getGlyphUrlByName(name) {
    const normalizedName = name.toLowerCase().replace(/\s+/g, '');
    return `./images/glyphs/${normalizedName}.png`;
}

function inputReportHook(data) {

    if(!inputMappingDisplays || inputMappingDisplays.length == 0) {
        return;
    }

    if(!mappingDisplayIdx || !mappingDisplayIdx.length) return;

    let focusedInputAnalog = (data.getUint8(14) << 8 | data.getUint8(15)) & 0x7FFF;
    let focusedInputPress = ((data.getUint8(14) << 8 | data.getUint8(15)) & 0x8000) != 0;
    if(configPanelComponent) {
        configPanelComponent.setPressed(focusedInputPress);
        configPanelComponent.setValue(focusedInputAnalog);
    }

    for (let i = 16; i < (16 + 36); i++) {
        let idxOutput = i - 16;
        let mapDisplayIdx = mappingDisplayIdx[idxOutput];
        let inputValueAnalog = data.getUint8(i) & 0x7F;
        let inputValuePress = (data.getUint8(i) & 0x80) != 0;

        inputMappingDisplays[mapDisplayIdx].setValue(inputValueAnalog);
        inputMappingDisplays[mapDisplayIdx].setPressed(inputValuePress);
    }


}

async function writeInputMemBlock() {
    await gamepad.sendBlock(inputCfgBlockNumber);
}

async function writeMappingInfo(slotNum, outputCode, outputMode, thresholdDelta, staticOutput) {

    let currentSlot;

    switch(currentRemapProfileIndex)
    {
        default:
        // Switch
        case 0:
            currentSlot = gamepad.input_cfg.input_profile_switch;
            break;

        // XInput
        case 1:
            currentSlot = gamepad.input_cfg.input_profile_xinput;
            break;

        // SNES
        case 2:
            currentSlot = gamepad.input_cfg.input_profile_snes;
            break;

        // N64
        case 3:
            currentSlot = gamepad.input_cfg.input_profile_n64;
            break;

        // GameCube
        case 4:
            currentSlot = gamepad.input_cfg.input_profile_gamecube;
            break;
    }

    if(outputCode!=null)
        currentSlot[slotNum].output_code = outputCode;

    if(outputMode!=null)
        currentSlot[slotNum].output_mode = outputMode;

    if(staticOutput!=null)
        currentSlot[slotNum].static_output = staticOutput;

    if(thresholdDelta!=null)
        currentSlot[slotNum].threshold_delta = thresholdDelta;

    switch(currentRemapProfileIndex)
    {
        default:
        // Switch
        case 0:
            gamepad.input_cfg.input_profile_switch = currentSlot;

            console.log(gamepad.input_cfg.input_profile_switch);
            break;

        // XInput
        case 1:
            gamepad.input_cfg.input_profile_xinput = currentSlot;
            break;

        // SNES
        case 2:
            gamepad.input_cfg.input_profile_snes = currentSlot;
            break;

        // N64
        case 3:
            gamepad.input_cfg.input_profile_n64 = currentSlot;
            break;

        // GameCube
        case 4:
            gamepad.input_cfg.input_profile_gamecube = currentSlot;
            break;
    }

    await writeInputMemBlock();
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

function outputSelectionClicked(event) {
    console.log("Output selection clicked:", event);
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

function inputTypeToString(inputType) {
    switch(inputType) {
        default:
        case 0:
            return 'none';
        case 1:
            return 'digital';
        case 2:
            return 'analog';
        case 3:
            return 'joystick';
        case 4:
            return 'dpad';
    }
}

function getCurrentProfileData() {
    switch(currentRemapProfileIndex) {
        // Switch
        default:
        case 0:
            return {
                outputConfig: gamepad.input_cfg.input_profile_switch,
                outputNames: switchOutputCodeNames,
                outputTypes: switchOutputTypes,
            };

        // XInput
        case 1:
            return {
                outputConfig: gamepad.input_cfg.input_profile_xinput,
                outputNames: xinputOutputCodeNames,
                outputTypes: xinputOutputTypes,
            };

        // SNES
        case 2:
            return {
                outputConfig: gamepad.input_cfg.input_profile_snes,
                outputNames: snesOutputCodeNames,
                outputTypes: snesOutputTypes,
            };

        // N64
        case 3:
            return {
                outputConfig: gamepad.input_cfg.input_profile_n64,
                outputNames: n64OutputCodeNames,
                outputTypes: n64OutputTypes,
            };
        
        // GameCube
        case 4:
            return {
                outputConfig: gamepad.input_cfg.input_profile_gamecube,
                outputNames: gamecubeOutputCodeNames,
                outputTypes: gamecubeOutputTypes,
            };
    }
}

function inputPanelOpened(event) {
    console.log("Input Panel Opened:", event);

    let {outputConfig, outputNames, outputTypes} = getCurrentProfileData();

    let inputCode = event.inputCode;
    let inputType = gamepad.input_static.input_info[inputCode].input_type;
    let outputCode = outputConfig[inputCode].output_code;
    let outputType = outputTypes[outputCode];
    let outputLabel = outputNames[outputCode];
    let outputMode = outputConfig[inputCode].output_mode;
    let thresholdDelta = outputConfig[inputCode].threshold_delta;
    let staticOutput = outputConfig[inputCode].static_output;

    if (!configPanelElement) return;
    configPanelComponent.setInputLabelAndType(event.inputLabel, inputTypeToString(inputType));
    configPanelComponent.setOutputLabelAndType(outputLabel, inputTypeToString(outputType));
    configPanelComponent.setMode(outputMode);
    configPanelComponent.setDelta(thresholdDelta);
    configPanelComponent.setOutput(staticOutput)

    configPanelElement.classList.remove('hidden');

    if (!blurElement) return;
    blurElement.classList.remove('hidden');

    currentFocusedInput = inputCode;
    gamepad.setFocusedInput(inputCode);
}

function inputPanelParamChanged(detail) {
    console.log(detail);
    writeMappingInfo(currentFocusedInput, null, detail.mode, detail.delta, detail.output);
}

async function populateRemapInfoList(profileIndex, container) {
    const changeCmd = CHANGE_CMD_SWITCH + profileIndex;
    await gamepad.sendConfigCommand(inputCfgBlockNumber, changeCmd);

    let {outputConfig, outputNames, outputTypes} = getCurrentProfileData();
    
    let mapIdx = 0;

    // Clear existing list
    let remapInfoList = [];
    mappingDisplayIdx = [];

    outputConfig.forEach((outputInfo, index) => {
        let outputMode = outputInfo.output_mode;
        let outputCode = outputInfo.output_code;
        let outputName = outputNames[outputCode] || `Disabled`;
        let outputType = outputTypes[outputCode];
        let outputThresholdDelta = outputInfo.threshold_delta;
        let outputStaticOutput = outputInfo.static_output;
        let inputInfoList = gamepad.input_static.input_info;
        let inputMapIdx = mapIdx;

        if(inputInfoList[index].input_type != 0) {
            mapIdx++;
        }

        mappingDisplayIdx.push(inputMapIdx);

        remapInfoList.push({
            inputCode : index,
            inputName : decodeText(inputInfoList[index].input_name),
            inputType : inputInfoList[index].input_type,
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
        buttonGridComponent.setButtons(outputNames);
    }

    let moduleGridHTML = '';

    remapInfoList.forEach((info, index) => {
        // Make sure input is used
        if(info.inputType != 0) 
        {
            const inputGlyphUrl = getGlyphUrlByName(info.inputName);
            const outputGlyphUrl = getGlyphUrlByName(info.outputName);
            moduleGridHTML += `<input-mapping-display input-code="${info.inputCode}" input-icon="${inputGlyphUrl}" input-label="${info.inputName}" output-icon="${outputGlyphUrl}" output-label="${info.outputName}" value="0" pressed="false"></input-mapping-display>`;
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
        buttonGridComponent.setButtons(outputNames);
    }

    inputMappingDisplays = container.querySelectorAll('input-mapping-display');
    inputMappingDisplays.forEach((mapping) => {
        mapping._onClick = inputPanelOpened;
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

    buttonGridComponent._onClick = outputSelectionClicked;
    // The default option set is the Switch profile
    buttonGridComponent.setButtons(switchOutputCodeNames);

    blurElement = container.querySelector('#panel_blur');

    configPanelElement = container.querySelector('#config_panel');

    configPanelComponent._onClose = closeOverlays;

    configPanelComponent.addEventListener('config-change', (e) => {
        inputPanelParamChanged(e.detail);
    });

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