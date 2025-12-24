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
const hoverCfgBlockNumber = 1;

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

const REMAP_PROFILE_SWITCH = 0;
const REMAP_PROFILE_XINPUT = 1;
const REMAP_PROFILE_SNES = 2;
const REMAP_PROFILE_N64 = 3;
const REMAP_PROFILE_GAMECUBE = 4;
const REMAP_PROFILE_SINPUT = 5;

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

const sinputOutputCodeNames = [
    'South', 'East', 'West', 'North',
    'D Up', 'D Down', 'D Left', 'D Right',
    'LS', 'RS', 'L1', 'R1',
    'L2', 'R2', 'L4', 'R4',
    'Start', 'Select', 'S Guide', 'Share', 'L5', 'R5',
    'TPL', 'TPR', '3', '4', '5', '6',
    'L2A', 'R2A', 
    'LX+', 'LX-', 'LY+', 'LY-',
    'RX+', 'RX-', 'RY+', 'RY-'
];

const sinputOutputTypes = [
    1, 1, 1, 1,
    4, 4, 4, 4,
    1, 1, 1, 1,
    1, 1, 1, 1,
    1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1,
    2, 2,
    3, 3, 3, 3,
    3, 3, 3, 3
];

async function startCalibration(channel) {
    const instruction = 1;

    let ch = 0;

    if(channel == 0xFF) {
        ch |= 0x3F;
    }
    else ch = channel;

    let outData = (instruction<<6) | ch;
    let { status, data } = await gamepad.sendConfigCommand(hoverCfgBlockNumber, outData);

    return status;
}

async function stopCalibration() {
    let { status, data } = await gamepad.sendConfigCommand(hoverCfgBlockNumber, 0);
    return status;
}

async function resetInputConfig(mode) {
    let command = mode + 2; // Switch is 2, XInput is 3, etc.
    let { status, data } = await gamepad.sendConfigCommand(inputCfgBlockNumber, command);
    return status;
}

function getGlyphUrlByName(name) {
    const normalizedName = name.toLowerCase().replace(/\s+/g, '');
    return `./images/glyphs/${normalizedName}.png`;
}

function inputReportHook(data) {

    if(!inputMappingDisplays || inputMappingDisplays.length == 0) {
        return;
    }

    if(!mappingDisplayIdx || !mappingDisplayIdx.length) return;

    let focusedInputAnalog = (data.getUint8(15) << 8 | data.getUint8(16)) & 0x7FFF;
    let focusedInputPress = ((data.getUint8(15) << 8 | data.getUint8(16)) & 0x8000) != 0;
    if(configPanelComponent) {
        configPanelComponent.setPressed(focusedInputPress);
        configPanelComponent.setValue(focusedInputAnalog);
    }

    for (let i = 17; i < (17 + 36); i++) {
        let idxOutput = i - 17;
        let mapDisplayIdx = mappingDisplayIdx[idxOutput];
        let inputValueAnalog = data.getUint8(i) & 0x7F;
        let inputValuePress = (data.getUint8(i) & 0x80) != 0;
        
        try {
            inputMappingDisplays[mapDisplayIdx].setValue(inputValueAnalog);
            inputMappingDisplays[mapDisplayIdx].setPressed(inputValuePress);
        }
        catch(e) {
        }
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

        // SInput
        case 5:
            currentSlot = gamepad.input_cfg.input_profile_sinput;
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

        // SInput
        case 5:
            gamepad.input_cfg.input_profile_sinput = currentSlot;
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

    // Stop calibrations
    stopCalibration();
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
            // Update the mapping display
            let mapDisplayIdxUnmap = mappingDisplayIdx[currentFocusedInput];
            if (inputMappingDisplays[mapDisplayIdxUnmap]) {
                const outputGlyphUrl = getGlyphUrlByName('Disabled');
                inputMappingDisplays[mapDisplayIdxUnmap].setOutputIcon(outputGlyphUrl);
            }
            closeRemapPanel();
            break;

        default:
            let {outputConfig, outputNames, outputTypes} = getCurrentProfileData();
            let newOutputCode = event.index;
            let newOutputType = outputTypes[newOutputCode];
            let newOutputName = outputNames[newOutputCode];
            const outputGlyphUrl = getGlyphUrlByName(newOutputName);

            writeMappingInfo(currentFocusedInput, newOutputCode, null, null, null);
            configPanelComponent.setOutputLabelAndType(newOutputName, inputTypeToString(newOutputType));
            
            // Update the mapping display
            let mapDisplayIdx = mappingDisplayIdx[currentFocusedInput];
            if (inputMappingDisplays[mapDisplayIdx]) {
                inputMappingDisplays[mapDisplayIdx].setOutputIcon(outputGlyphUrl);
            }
            
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

        // SInput
        case 5:
            return {
                outputConfig: gamepad.input_cfg.input_profile_sinput,
                outputNames: sinputOutputCodeNames,
                outputTypes: sinputOutputTypes,
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

    configPanelComponent.setCalibrating(false);

    configPanelComponent.setOnCalibrate(async () => {
        console.log("Calibrating input code:", inputCode);
        await startCalibration(inputCode);
    });

    configPanelComponent.setOnCalibrateFinish(async () => {
        console.log("Stopping calibration for input code:", inputCode);
        await stopCalibration();
    });

    configPanelComponent.setRemapsDisabled(currentRemapProfileIndex==5);

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
    currentRemapProfileIndex = 0;

    containerElement = container;

    container.innerHTML = `
            <h2>Input Mode</h2>
            <multi-position-button 
                id="input-mode-select" 
                options="SW, XI, SNES, N64, GC, SI"
                width="300"
                default-selected="0"
            ></multi-position-button>
            <div id="panel_blur" class="popup-blur hidden" style="z-index: 199;"></div>

            <div id="config_panel" class="popup hidden" style="z-index: 200;">
                <input-config-panel remaps-disabled="false"></input-config-panel>
            </div>

            <div id="remap_panel" class="popup hidden" style="z-index: 201;">
                <button-grid id="gamepad_grid"></button-grid>
            </div>

            <h2>Input Setup</h2>
            <div id="module-grid-placeholder" class="module-grid">
            </div>

            <div class="separator"></div>

            <div class="app-text-container">
                To calibrate analog inputs (including triggers), press <strong>Start</strong>.<br>
                Fully press and release all analog inputs.<br><br>
                Press <strong>Stop</strong> once you have done this 3 to 4 times.
                <br><br>
                Verify the output of your analog inputs and that they reach the full output range. Click <strong>Save</strong>!
            </div>

            <div class="app-row">
                <h3>Calibrate All</h3>
                <tristate-button 
                    id="calibrate-button" 
                    off-text="Start" 
                    on-text="Stop"
                    off-to-on-text="Start"
                    on-to-off-text="Stop"
                    width="70"
                ></tristate-button>
            </div>

            <div class="separator"></div>

            <div class="app-row">
                <h3>Defaults</h3>
                <single-shot-button 
                    id="global-angle-button" 
                    state="ready" 
                    ready-text="Reset" 
                    disabled-text="Reset"
                    pending-text="Resetting..."
                    success-text="Success"
                    failure-text="Error"
                    tooltip="Quickly reset this mode to its default."
                ></single-shot-button>
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

    // Calibrate button
    /** @type {TristateButton} */
    const calibrateButton = container.querySelector('tristate-button[id="calibrate-button"]');
    calibrateButton.setOnHandler(async (state) => {
            return await startCalibration(0xFF);
    });

    calibrateButton.setOffHandler(async (state) => {
        return await stopCalibration();
    });

    // Input Reset button
    const resetButton = container.querySelector('single-shot-button[id="global-angle-button"]');
    resetButton.setOnClick(async () => {
        let result = await resetInputConfig(currentRemapProfileIndex);

        if(!result) return false;

        // Reload info from gamepad
        await gamepad.requestBlock(inputCfgBlockNumber);
        populateRemapInfoList(currentRemapProfileIndex, containerElement);
        return true;
    });

    // Set gamepad input mode
    gamepad.setInputMode(false);

    // Set report hook
    gamepad.setReportHook(inputReportHook);

    enableTooltips(container);
}