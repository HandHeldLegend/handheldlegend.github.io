import HojaGamepad from '../js/gamepad.js';

import InputMappingDisplay from '../components/input-mapping-display.js';
import InputConfigPanel from '../components/input-config-panel.js';
import ButtonGrid from '../components/button-grid.js';

import { enableTooltips } from '../js/tooltips.js';

/** @type {HojaGamepad} */
const gamepad = HojaGamepad.getInstance();
const gamepadCfgBlockNumber = 0;

let blurElement = null;
let configPanelElement = null;
let configPanelComponent = null;
let remapPanelElement = null;
let buttonGridComponent = null;

async function writeGamepadMemBlock() {
    await gamepad.sendBlock(gamepadCfgBlockNumber);
}


function stringToArray(input) {
    return input.split(',');
}



function closeOverlays() {
    if(!remapPanelElement) return;
    remapPanelElement.classList.add('hidden');

    if(!configPanelElement) return;
    configPanelElement.classList.add('hidden');

    if(!blurElement) return;
    blurElement.classList.add('hidden');
}

function openRemapPanel() {

    if(!blurElement) return;
    blurElement.classList.remove('hidden');

    if(!remapPanelElement) return;
    remapPanelElement.classList.remove('hidden');

    
}

function remapClickHandler(event) {
    console.log("Remap clicked:", event);
    switch(event.index) {
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
    if(!remapPanelElement) return;
    remapPanelElement.classList.add('hidden');
}

function inputMapClicked(event) { 
    console.log("Input mapping clicked:", event.inputLabel);

    configPanelComponent.setInputLabelAndType(event.inputLabel, 'analog');
    configPanelComponent.setOutputLabelAndType(event.outputLabel, 'analog');

    if(!configPanelElement) return;
    configPanelElement.classList.remove('hidden');

    if(!blurElement) return;
    blurElement.classList.remove('hidden');
}

const inputList = [
    "A", "B", "X", "Y",
    "L", "R", "ZL", "ZR",];

export function render(container) {

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
            <input-mapping-display input-label="B" output-label="X" value="200" pressed="true"></input-mapping-display>
            <input-mapping-display input-label="B" output-label="X" value="200" pressed="false"></input-mapping-display>
            <input-mapping-display input-label="B" output-label="X" value="200" pressed="true"></input-mapping-display>
            <input-mapping-display input-label="B" output-label="X" value="200" pressed="true"></input-mapping-display>
            <input-mapping-display input-label="B" output-label="X" value="200" pressed="true"></input-mapping-display>
            <input-mapping-display input-label="B" output-label="X" value="200" pressed="true"></input-mapping-display>

            <input-mapping-display input-label="B" output-label="X" value="200" pressed="true"></input-mapping-display>
            <input-mapping-display input-label="B" output-label="X" value="200" pressed="true"></input-mapping-display>
            <input-mapping-display input-label="B" output-label="X" value="200" pressed="true"></input-mapping-display>
            <input-mapping-display input-label="B" output-label="X" value="200" pressed="true"></input-mapping-display>
            <input-mapping-display input-label="B" output-label="X" value="200" pressed="true"></input-mapping-display>
            <input-mapping-display input-label="B" output-label="X" value="200" pressed="true"></input-mapping-display>

            <input-mapping-display input-label="B" output-label="X" value="200" pressed="true"></input-mapping-display>
            <input-mapping-display input-label="B" output-label="X" value="200" pressed="true"></input-mapping-display>
            <input-mapping-display input-label="B" output-label="X" value="200" pressed="true"></input-mapping-display>
            <input-mapping-display input-label="B" output-label="X" value="200" pressed="true"></input-mapping-display>
            <input-mapping-display input-label="B" output-label="X" value="200" pressed="true"></input-mapping-display>
            <input-mapping-display input-label="B" output-label="X" value="200" pressed="true"></input-mapping-display>

            <input-mapping-display input-label="B" output-label="X" value="200" pressed="true"></input-mapping-display>
            <input-mapping-display input-label="B" output-label="X" value="200" pressed="true"></input-mapping-display>
            <input-mapping-display input-label="B" output-label="X" value="200" pressed="true"></input-mapping-display>
            <input-mapping-display input-label="B" output-label="X" value="200" pressed="true"></input-mapping-display>
            <input-mapping-display input-label="B" output-label="X" value="200" pressed="true"></input-mapping-display>
            <input-mapping-display input-label="B" output-label="X" value="200" pressed="true"></input-mapping-display>

            <input-mapping-display input-label="B" output-label="X" value="200" pressed="true"></input-mapping-display>
            <input-mapping-display input-label="B" output-label="X" value="200" pressed="true"></input-mapping-display>
            <input-mapping-display input-label="B" output-label="X" value="200" pressed="true"></input-mapping-display>
            <input-mapping-display input-label="B" output-label="X" value="200" pressed="true"></input-mapping-display>
            <input-mapping-display input-label="B" output-label="X" value="200" pressed="true"></input-mapping-display>
            <input-mapping-display input-label="B" output-label="X" value="200" pressed="true"></input-mapping-display>

            <input-mapping-display input-label="B" output-label="X" value="200" pressed="true"></input-mapping-display>
            <input-mapping-display input-label="B" output-label="X" value="200" pressed="true"></input-mapping-display>
            <input-mapping-display input-label="B" output-label="X" value="200" pressed="true"></input-mapping-display>
            <input-mapping-display input-label="B" output-label="X" value="200" pressed="true"></input-mapping-display>
            <input-mapping-display input-label="B" output-label="X" value="200" pressed="true"></input-mapping-display>
            <input-mapping-display input-label="B" output-label="X" value="200" pressed="true"></input-mapping-display>

            <input-mapping-display input-label="B" output-label="X" value="200" pressed="true"></input-mapping-display>
            <input-mapping-display input-label="B" output-label="X" value="200" pressed="true"></input-mapping-display>
            <input-mapping-display input-label="B" output-label="X" value="200" pressed="true"></input-mapping-display>
            <input-mapping-display input-label="B" output-label="X" value="200" pressed="true"></input-mapping-display>
            <input-mapping-display input-label="B" output-label="X" value="200" pressed="true"></input-mapping-display>
            <input-mapping-display input-label="B" output-label="X" value="200" pressed="true"></input-mapping-display>
            </div>
    `;

    configPanelComponent = container.querySelector('input-config-panel');

    remapPanelElement = container.querySelector('#remap_panel');
    buttonGridComponent = container.querySelector('button-grid[id="gamepad_grid"]');

    buttonGridComponent._onClick = remapClickHandler;

    blurElement = container.querySelector('#panel_blur');

    const inputMappings = container.querySelectorAll('input-mapping-display');
    inputMappings.forEach((mapping) => {
        mapping._onClick = inputMapClicked;
    });

    configPanelElement = container.querySelector('#config_panel');

    configPanelComponent._onClose = closeOverlays;
    
    blurElement.addEventListener('click', (e) => {
        if(e.target === blurElement) {
            closeOverlays();
        }   
    });

    configPanelComponent.setOutputSelectorHandler(() => {
        openRemapPanel();
    });

    // Populate the button grid with input labels
    buttonGridComponent.setButtons(inputList);
}