import HojaGamepad from '../js/gamepad.js';

import InputMappingDisplay from '../components/input-mapping-display.js';
import InputConfigPanel from '../components/input-config-panel.js';
import ButtonGrid from '../components/button-grid.js';

import { enableTooltips } from '../js/tooltips.js';
import Inputinfoslot from '../factory/parsers/inputInfoSlot.js';

/** @type {HojaGamepad} */
const gamepad = HojaGamepad.getInstance();
const gamepadCfgBlockNumber = 0;

/** @type {InputMappingDisplay[]} */
let inputMappingDisplays = [];

let blurElement = null;
let configPanelElement = null;
let configPanelComponent = null;
let remapPanelElement = null;
let buttonGridComponent = null;

let currentRemapProfileIndex = 0;
let inputInfoList = [];
let outputInfoList = [];

const switchOutputCodeNames = [
    'A', 'B', 'X', 'Y',
    'Up', 'Down', 'Left', 'Right',
    'L', 'R', 'ZL', 'ZR',
    'Plus', 'Minus', 'Home', 'Capture',
    'LS', 'RS', 
    'LX+', 'LX-', 'LY+', 'LY-',
    'RX+', 'RX-', 'RY+', 'RY-'
];

const xinputOutputCodeNames = [
    'A', 'B', 'X', 'Y',
    'Up', 'Down', 'Left', 'Right',
    'LB', 'RB', 'Start', 'Back',
    'Guide', 'LS', 'RS',
    'LT', 'RT',
    'LX+', 'LX-', 'LY+', 'LY-',
    'RX+', 'RX-', 'RY+', 'RY-'
];

const snesOutputCodeNames = [
    'A', 'B', 'X', 'Y',
    'Up', 'Down', 'Left', 'Right',
    'L', 'R', 'Start', 'Select'
];

const n64OutputCodeNames = [
    'A', 'B', 'C Up', 'C Down', 'C Left', 'C Right',
    'Up', 'Down', 'Left', 'Right',
    'L', 'R',  'Z', 'Start', 
    'LX+', 'LX-', 'LY+', 'LY-'
];

const gamecubeOutputCodeNames = [
    'A', 'B', 'X', 'Y',
    'Up', 'Down', 'Left', 'Right',
    'Start', 'Z', 'L', 'R',
    'L+', 'R+', 
    'LX+', 'LX-', 'LY+', 'LY-',
    'RX+', 'RX-', 'RY+', 'RY-'
];

function inputReportHook(data) {
    for (let i = 16; i < (16 + 36); i++) {
        let idxOutput = i - 16;
        let inputType = inputInfoList[idxOutput].type;
        let mappingIdx = inputInfoList[idxOutput].mappingIndex;
        let inputValue = data.getUint8(i);

        switch(inputType) {
            case 1: // Button
            if(inputValue > 0) {
                inputMappingDisplays[mappingIdx].setValue(255);
                inputMappingDisplays[mappingIdx].setPressed(true);
            }
            else {
                inputMappingDisplays[mappingIdx].setValue(0);
                inputMappingDisplays[mappingIdx].setPressed(false);
            }
            break;

            case 2: // Hover
            inputMappingDisplays[mappingIdx].setValue(inputValue);
            inputMappingDisplays[mappingIdx].setPressed(inputValue > 0);
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


function stringToArray(input) {
    return input.split(',');
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

function populateOutputInfoList(profileIndex) {
    outputInfoList = [];
    
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

    tmpProfile.forEach((outputInfo, index) => {
        let outputMode = outputInfo.output_mode;
        let outputCode = outputInfo.output_code;
        let outputName = tmpNames[outputCode] || `${outputCode}`;
        let outputType = outputInfo.output_type;
        let outputThresholdDelta = outputInfo.threshold_delta;
        let outputStaticOutput = outputInfo.static_output;

        outputInfoList.push({
            name: outputName,
            code: outputCode,
            mode: outputMode,
            type: outputType,
            thresholdDelta: outputThresholdDelta,
            staticOutput: outputStaticOutput
        });
    });
}

export function render(container) {

    let moduleGridHTML = '';
    let mappingDisplayIndex = 0;
    let mappingIndex = 0;

    // Clear inputInfoList
    inputInfoList = [];

    // Load output info list from default profile (switch)
    populateOutputInfoList(0);

    console.log(outputInfoList);

    gamepad.input_static.input_info.forEach((inputInfo, index) => {

        let inputName = decodeText(inputInfo.input_name);
        
        let inputType = inputInfo.input_type;

        if(inputType != 0) 
        {
            mappingIndex = mappingDisplayIndex;
            mappingDisplayIndex++;
            moduleGridHTML += `<input-mapping-display input-label="${inputName}" output-label="${outputInfoList[index].name}" value="0" pressed="false"></input-mapping-display>`;
        }

        // Push info to list
        inputInfoList.push({
            mappingIndex: mappingIndex,
            name: inputName,
            type: inputType
        });
    });

    console.log(inputInfoList)  ;

    container.innerHTML = `
            <h2>Input Mode</h2>
            
            <div id="panel_blur" class="popup-blur hidden" style="z-index: 199;"></div>

            <div id="config_panel" class="popup hidden" style="z-index: 200;">
                <input-config-panel></input-config-panel>
            </div>

            <div id="remap_panel" class="popup hidden" style="z-index: 201;">
                <button-grid id="gamepad_grid"></button-grid>
            </div>

            <h2>Input Setup</h2>
            <div class="module-grid">
            ${moduleGridHTML}
            </div>
    `;

    configPanelComponent = container.querySelector('input-config-panel');

    remapPanelElement = container.querySelector('#remap_panel');
    buttonGridComponent = container.querySelector('button-grid[id="gamepad_grid"]');

    buttonGridComponent._onClick = remapClickHandler;

    blurElement = container.querySelector('#panel_blur');

    inputMappingDisplays = container.querySelectorAll('input-mapping-display');
    inputMappingDisplays.forEach((mapping) => {
        mapping._onClick = inputMapClicked;
    });

    console.log(inputMappingDisplays);

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