// Import the number selector (optional, as it's now globally defined)
import HojaGamepad from '../gamepad/gamepad.js';

import NumberSelector from '../components/number-selector.js';
import MultiPositionButton from '../components/multi-position-button.js';
import GroupRgbPicker from '../components/group-rgb-picker.js';
import AngleSelector from '../components/angle-selector.js';
import Analogpackeddistances from '../factory/parsers/analogPackedDistances.js';
import Anglemap from '../factory/parsers/angleMap.js';
import RemapSelector from '../components/remap-selector.js';

import AnalogStickVisual from '../components/analog-stick-visual.js';

import TristateButton from '../components/tristate-button.js';
import SingleShotButton from '../components/single-shot-button.js';

import { enableTooltips } from '../tooltips.js';

let selectedAxis = 0;
let mdContainer = null;

/** @type {HojaGamepad} */
const gamepad = HojaGamepad.getInstance();
const analogCfgBlockNumber = 2;

function mapsToStyleString(maps) {
    let output = "";
    maps.forEach(value => {
        if(value.distance>1000)
            output += `${value.output},${value.distance};`
    });

    output.slice(0, -1);
    return output;
}

// Load our data, no memory copy
function switchConfigAxis(axis) {
    selectedAxis = axis;
    let maps = (selectedAxis == 0) ? gamepad.analog_cfg.l_angle_maps : gamepad.analog_cfg.r_angle_maps;

    let mode = 'round';
    let modeNum = 0;
    let deadzone = 0;
    if(!selectedAxis) {
        mode = (gamepad.analog_cfg.l_scaler_type==1) ? 'polygon' : 'round';
        modeNum = gamepad.analog_cfg.l_scaler_type;
        deadzone = gamepad.analog_cfg.l_deadzone;
    }
    else {
        mode = (gamepad.analog_cfg.r_scaler_type==1) ? 'polygon' : 'round';
        modeNum = gamepad.analog_cfg.r_scaler_type;
        deadzone = gamepad.analog_cfg.r_deadzone;
    }
    
    updateAnalogVisualizerDeadzone(deadzone);
    updateAnalogVisualizerPolygon(maps);
    updateAnalogVisualizerScaler(modeNum);
    populateDeadzone(deadzone);
    populateScalerType(modeNum);
    populateAngleSelectors(maps);
}

function populateDeadzone(value) {
    /** @type {NumberSelector} */
    const deadzoneSlider = mdContainer.querySelector('number-selector[id="deadzone-slider"]');
    deadzoneSlider.setState(value);
}

function populateScalerType(mode) {
    /** @type {MultiPositionButton} */
    const scalerButtons = mdContainer.querySelector('multi-position-button[id="scale-mode-selector"]');
    scalerButtons.setState(mode);
}

function updateAnalogVisualizerPolygon(maps) {
    /** @type {AnalogStickVisual} */
    const analogVisualizer = mdContainer.querySelector('analog-stick');
    analogVisualizer.setPolygonVertices(maps);
}

function updateAnalogVisualizerScaler(idx) {
    let mode = 'round';
    if(idx==1) mode = 'polygon';
    /** @type {AnalogStickVisual} */
    const analogVisualizer = mdContainer.querySelector('analog-stick');
    analogVisualizer.setMode(mode);
}

function updateAnalogVisualizerDeadzone(value) {
    /** @type {AnalogStickVisual} */
    const analogVisualizer = mdContainer.querySelector('analog-stick');
    analogVisualizer.setDeadzone(value);
}

// Populate all the angle selector HTML items, optionally updating our memory
function populateAngleSelectors(maps) {
    let anglePickers = mdContainer.querySelectorAll('angle-selector');
    anglePickers.forEach((item, index) => {
        item.setAll(maps[index].input, maps[index].output, maps[index].distance); // Do not emit changes
    });
}

// Sort and clean up an array of Anglemaps
function sortAndFilterAnglemaps(maps) {
    // Filter out objects where the distance is less than 1000
    const filteredArray = maps.filter(item => item.distance >= 1000);

    // Sort the filtered array by the output (angle)
    const sortedArray = filteredArray.sort((a, b) => a.output - b.output);

    /** @type {Anglemap[]} */
    let outMaps = [];

    outMaps.forEach(map => {
        map.distance = 0;
        map.input = 0;
        map.output = 0;
    });

    // Overwrite the elements in outMaps with the sorted array data
    sortedArray.forEach((item, index) => {
        outMaps[index].distance = item.distance;
        outMaps[index].input = item.input || 0; // Default to 0 if input is undefined
        outMaps[index].output = item.output;
    });

    return outMaps;
}

// Ensures the input angle is a valid one
function validateAngle(input)
{
    // Validate inputs
    if(input < 0) input = 0;
    if(input >= 360) input = (input % 360);
    return input;
}

function validateDistance(input) {
    // Validate inputs
    if(input < 1000) input = 0;
    if(input >= 4096) input = 4096;
    return input;
}

// Write data to clipboard
function writeToClipboard(text) {
    navigator.clipboard.writeText(text)
        .then(() => {
            console.log('Text successfully copied to clipboard!');
        })
        .catch(err => {
            console.error('Failed to copy text to clipboard:', err);
        });
}

// Export angles to clipboard
function exportAngles() {
    try {
        // Prepare the export object
        const exportObject = {
            header: {
                magicNumber: "0xANGLEDATA", // Magic number for verification
                version: 1,                // Version for future compatibility
            },
            entries: []
        };

        /** @type {HojaGamepad} */
        let gamepad = HojaGamepad.getInstance();

        /** @type {Anglemap[]} */
        let angleEntries = (selectedAxis==0) ? gamepad.analog_cfg.l_angle_maps : gamepad.analog_cfg.r_angle_maps;
        let idx = 0;

        // Iterate through the data source to fill entries
        for (const item of angleEntries) {
            if (exportObject.entries.length >= 16) break; // Only 16 entries allowed
            
            // Validate and add each entry
            if (item.input !== undefined && item.output !== undefined && item.distance !== undefined) {
                exportObject.entries.push({
                    inAngle: item.input,
                    outAngle: item.output,
                    distance: item.distance
                });
            }
        }

        // Ensure exactly 16 entries are present
        if (exportObject.entries.length !== 16) {
            throw new Error('Exactly 16 entries are required for export.');
        }

        // Convert to JSON string
        writeToClipboard(JSON.stringify(exportObject, null, 2));
        return;
    } catch (error) {
        console.error('Failed to export angles:', error);
        return null; // Indicate failure gracefully
    }
}

// Import data from clipboard
async function importAngles(textLengthCap = 10000) {
    try {
        // Read text from the clipboard
        const clipboardText = await navigator.clipboard.readText();

        // Check clipboard text length
        if (clipboardText.length > textLengthCap) {
            console.warn('Clipboard text exceeds length cap. Aborting import.');
            return; // Early return if the text is too long
        }

        // Parse the JSON data from clipboard
        const parsedData = JSON.parse(clipboardText);

        // Validate the header
        if (!parsedData.header || parsedData.header.magicNumber !== "0xANGLEDATA") {
            throw new Error('Invalid or missing magic number in header.');
        }

        // Validate that there are exactly 16 entries
        const entries = parsedData.entries || [];
        if (entries.length !== 16) {
            throw new Error('Exactly 16 entries are required for import.');
        }

        /** @type {Anglemap[]} */
        let angleEntries = [16];

        entries.forEach((item, index) => {
            angleEntries[index].input   = item.inAngle;
            angleEntries[idx].output    = item.outAngle;
            angleEntries[idx].distance  = item.distance;
        });

        // Sort our map
        angleEntries = sortAndFilterAnglemaps(angleEntries);
        populateAngleSelectors(angleEntries, true);

        writeAngleMemBlock();

        console.log('Import successful.');
    } catch (error) {
        console.error('Failed to import angles:', error);
    }
}

function getAnglemapsFromAngleSelectors() {
    /** @type {Anglemap[]} */
    let angleEntries = [];

    /** @type {AngleSelector} */
    const anglePickers = mdContainer.querySelectorAll('angle-selector');

    anglePickers.forEach((item, index) => {
        let state = item.getState();
        let entry = new Anglemap();
        entry.input   = state.inAngle;
        entry.output    = state.outAngle;
        entry.distance  = state.distance;
        angleEntries.push(entry);
    });

    return angleEntries;
}

// Grab all the current config option values
// and write them to our controller memory
async function writeAngleMemBlock() {
    // Get Anglemaps
    let maps = getAnglemapsFromAngleSelectors();
    
    /** @type {AnalogStickVisual} */
    const analogVisualizer = mdContainer.querySelector('analog-stick');
    analogVisualizer.setPolygonVertices(maps);

    /** @type {NumberSelector} */
    const deadzoneSlider = mdContainer.querySelector('number-selector[id="deadzone-slider"]');

    /** @type {MultiPositionButton} */
    const scalerModePicker = mdContainer.querySelector('multi-position-button[id="scale-mode-selector"]');

    let scalerModeIdx = scalerModePicker.getState().selectedIndex;
    let deadzoneValue = deadzoneSlider.getState().formattedValue;


    updateAnalogVisualizerScaler(scalerModeIdx);
    updateAnalogVisualizerDeadzone(deadzoneValue);
    updateAnalogVisualizerPolygon(maps);

    if(selectedAxis==0)
    {
        gamepad.analog_cfg.l_angle_maps = maps;
        gamepad.analog_cfg.l_deadzone = deadzoneValue;
        gamepad.analog_cfg.l_scaler_type = scalerModeIdx;
    }
    else 
    {
        gamepad.analog_cfg.r_angle_maps = maps;
        gamepad.analog_cfg.r_deadzone = deadzoneValue;
        gamepad.analog_cfg.r_scaler_type = scalerModeIdx;
    }

    await gamepad.sendBlock(analogCfgBlockNumber);
}

export function render(container) {

    /** @type {Anglemap[]} */
    let angleConfigs = gamepad.analog_cfg.l_angle_maps;
    let anglePickersHTML = "";

    for(let i = 0; i < angleConfigs.length; i++) {
        anglePickersHTML += `
        <angle-selector 
            idx="${i}"
            in-angle="${angleConfigs[i].input}"
            out-angle="${angleConfigs[i].output}"
            distance="${angleConfigs[i].distance}"
        ></angle-selector>
        `
    }

    let modeIdx = gamepad.analog_cfg.l_scaler_type;
    let mode = (gamepad.analog_cfg.l_scaler_type==1) ? 'polygon' : 'round';
    let deadzone = gamepad.analog_cfg.l_deadzone;
    let polyVerticesString = mapsToStyleString(angleConfigs);

    container.innerHTML = `
            <h1>Joystick Settings</h1>
            <h2>Calibrate</h2>
            <p>To calibrate both sticks, press Start. Move both analog sticks in a full circle slowly. Press Stop to complete calibration.</p>
            <tristate-button 
                id="calibrate-button" 
                off-text="Calibrate" 
                on-text="Stop"
                off-to-on-text="Calibrate"
                on-to-off-text="Stop"
            ></tristate-button>

            <h2>Axis Selection</h2>
            <multi-position-button 
                id="stick-chooser" 
                labels="Left, Right"
                default-selected="0"
            ></multi-position-button>

            <h2>Visualizer</h2>
            <analog-stick 
                id="analog-visualizer"
                mode="${mode}" 
                deadzone="${deadzone}"
                polygon-vertices="${polyVerticesString}"
            ></analog-stick>

            <h2>Deadzone</h2>
            <number-selector 
                id="deadzone-slider" 
                type="int" 
                min="0" 
                max="1000" 
                step="1" 
                default-value="${deadzone}"
            ></number-selector>

            <h2>Mode</h2>
            <multi-position-button 
                id="scale-mode-selector" 
                labels="Round, Polygon"
                default-selected="${modeIdx}"
            ></multi-position-button>

            <h2>Angles</h2>
            <div class="app-row">
                <single-shot-button 
                    id="copy-angles-button" 
                    state="ready" 
                    ready-text="Copy" 
                    disabled-text="Copy"
                    pending-text="Copy"
                    tooltip="Copy your Output/Distance data as JSON"
                ></single-shot-button>

                <single-shot-button 
                    id="paste-angles-button" 
                    state="ready" 
                    ready-text="Paste" 
                    disabled-text="Paste"
                    pending-text="Paste"
                    tooltip="Paste your Output/Distance data as JSON"
                ></single-shot-button>
            </div>
            ${anglePickersHTML}
    `;

    // Set analog angle change handler
    const anglePickers = container.querySelectorAll('angle-selector');
    anglePickers.forEach(picker => {
        picker.addEventListener('angle-change', (e) => {
            writeAngleMemBlock();
        });
    });

    // Set axis change handler
    const axisSelector = container.querySelector('multi-position-button[id="stick-chooser"]');
    axisSelector.addEventListener('change', (e) => {
        console.log("Axis Select Change");
        switchConfigAxis(e.detail.selectedIndex);
    });

    // Set copy/paste handlers
    const copyButton = container.querySelector('single-shot-button[id="copy-angles-button"]');
    const pasteButton = container.querySelector('single-shot-button[id="paste-angles-button"]');
    copyButton.setOnClick(exportAngles);
    pasteButton.setOnClick(importAngles);

    const scaleModeButton = container.querySelector('multi-position-button[id="scale-mode-selector"]');
    scaleModeButton.addEventListener('change', (e) => {
        console.log("Scale Mode Change");
        writeAngleMemBlock();
    });

    const deadzoneSlider = container.querySelector('number-selector[id="deadzone-slider"]');
    deadzoneSlider.addEventListener('change', (e) => {
        console.log("Deadzone Change");
        writeAngleMemBlock();
    });

    enableTooltips(container);


    /** @type {AnalogStickVisual} */
    const analogVisualizer = container.querySelector('analog-stick');

    // Set input loop hook to use the analog data
    gamepad.setReportHook((data) => {
        let offset = 0;

        if(selectedAxis==1)
        {
            offset = 4;
        }

        let x = (data.getUint8(1 + offset) << 8) | (data.getUint8(2 + offset));
        let y = 4096- ( (data.getUint8(3 + offset) << 8) | (data.getUint8(4 + offset)) );

        x -= 2048;
        y -= 2048;

        analogVisualizer.setAnalogInput(x, y);
    });

    mdContainer = container;
}