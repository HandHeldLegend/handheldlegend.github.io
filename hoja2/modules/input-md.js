import HojaGamepad from '../js/gamepad.js';

import InputMappingDisplay from '../components/input-mapping-display.js';
import InputConfigPanel from '../components/input-config-panel.js';
import ButtonGrid from '../components/button-grid.js';

import { enableTooltips } from '../js/tooltips.js';

/** @type {HojaGamepad} */
const gamepad = HojaGamepad.getInstance();
const gamepadCfgBlockNumber = 0;

let overlayElement = null;
let blurElement = null;
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
    if(!overlayElement) return;
    overlayElement.classList.add('hidden');

    if(!remapPanelElement) return;
    remapPanelElement.classList.add('hidden');

    if(!blurElement) return;
    blurElement.classList.add('hidden');
}

function openRemapPanel() {
    if(!remapPanelElement) return;
    remapPanelElement.classList.remove('hidden');

    if(!blurElement) return;
    blurElement.classList.remove('hidden');
}

function inputMapClicked(event) { 
    console.log("Input mapping clicked:", event.inputLabel);

    if(!overlayElement) return;

    configPanelComponent.setInputLabelAndType(event.inputLabel, 'analog');
    configPanelComponent.setOutputLabelAndType(event.outputLabel, 'analog');

    overlayElement.classList.remove('hidden');
}

const inputList = [
    "A", "B", "X", "Y",
    "L", "R", "ZL", "ZR",];

export function render(container) {

    container.innerHTML = `
            <h2>Default Mode</h2>
            <div class="app-text-container">
                <strong>WARNING</strong>
                <br>
                Changing the default mode will require you to hold A upon plugging in the controller to connect to this configuration app. 
            </div>

            <div id="panel_overlay" class="popup-overlay hidden" style="z-index: 100;">
                

                <div id="remap_panel" class="popup hidden" style="z-index: 200;">
                <button-grid id="gamepad_grid"></button-grid>
                </div>
            </div>

            <div id="panel_blur" class="popup-blur hidden" style="z-index: 199;"></div>

            <div id="config_panel" class="popup" style="z-index: 100;">
                <input-config-panel></input-config-panel>
            </div>

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

    overlayElement = container.querySelector('#panel_overlay');
    configPanelComponent = container.querySelector('input-config-panel');

    remapPanelElement = container.querySelector('#remap_panel');
    buttonGridComponent = container.querySelector('button-grid[id="gamepad_grid"]');

    blurElement = container.querySelector('#panel_blur');

    const inputMappings = container.querySelectorAll('input-mapping-display');
    inputMappings.forEach((mapping) => {
        mapping._onClick = inputMapClicked;
    });

    configPanelComponent._onClose = closeOverlays;
    
    overlayElement.addEventListener('click', (e) => {
        if(e.target === overlayElement) {
            closeOverlays();
        }   
    });

    configPanelComponent.setOutputSelectorHandler(() => {
        openRemapPanel();
    });

    // Populate the button grid with input labels
    buttonGridComponent.setButtons(inputList);
}