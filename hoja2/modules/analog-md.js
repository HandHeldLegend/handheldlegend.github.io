import HojaGamepad from '../js/gamepad.js';
import { enableTooltips } from '../js/tooltips.js';

import NumberSelector from '../components/number-selector.js';
import MultiPositionButton from '../components/multi-position-button.js';
import GroupRgbPicker from '../components/group-rgb-picker.js';
import AngleSelector from '../components/angle-selector.js';
import Analogpackeddistances from '../factory/parsers/analogPackedDistances.js';
import Anglemap from '../factory/parsers/angleMap.js';

import AnalogStickVisual from '../components/analog-stick-visual.js';
import AxisInvertSelector from '../components/axis-invert-selector.js';

import TristateButton from '../components/tristate-button.js';
import SingleShotButton from '../components/single-shot-button.js';

let selectedAxis = 0;
let mdContainer = null;
let watingForAngles = false;
let capturedAngles = {
    left: 0,
    right: 0
};

/** @type {HojaGamepad} */
const gamepad = HojaGamepad.getInstance();
const analogCfgBlockNumber = 2;

function resetAllAnglesDefault() {
    /** @type {Anglemap[]} */
    let outMaps = [];

    for(let i = 0; i < 8; i++) {
        let newMap = new Anglemap();
        newMap.input    = i * 45;
        newMap.output   = i * 45;
        newMap.distance = 2048;
        outMaps.push(newMap);
    }

    for(let i = 0; i < 8; i++) {
        let newMap = new Anglemap();
        newMap.input    = 0;
        newMap.output   = 0;
        newMap.distance = 0;
        outMaps.push(newMap);
    }

    populateAngleSelectors(outMaps);
    updateAnalogSelectorDefaults(outMaps);
    writeAngleMemBlock();
    return true;
}

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
    let snapbackMode = 0;
    if(!selectedAxis) {
        mode = (gamepad.analog_cfg.l_scaler_type==1) ? 'polygon' : 'round';
        modeNum = gamepad.analog_cfg.l_scaler_type;
        deadzone = gamepad.analog_cfg.l_deadzone;
        snapbackMode = gamepad.analog_cfg.l_snapback_type;
    }
    else {
        mode = (gamepad.analog_cfg.r_scaler_type==1) ? 'polygon' : 'round';
        modeNum = gamepad.analog_cfg.r_scaler_type;
        deadzone = gamepad.analog_cfg.r_deadzone;
        snapbackMode = gamepad.analog_cfg.r_snapback_type
    }
    
    updateAnalogSelectorDefaults(maps);
    updateAnalogVisualizerDeadzone(deadzone);
    updateAnalogVisualizerPolygon(maps);
    updateAnalogVisualizerScaler(modeNum);
    populateDeadzone(deadzone);
    populateScalerType(modeNum);
    populateAngleSelectors(maps);
    populateSnapbackType(snapbackMode);
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

function populateSnapbackType(mode) {
    /** @type {MultiPositionButton} */
    const snapbackButtons = mdContainer.querySelector('multi-position-button[id="snapback-mode-selector"]');
    snapbackButtons.setState(mode);
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

function updateAnalogSelectorDefaults(maps) {
    let anglePickers = mdContainer.querySelectorAll('angle-selector');
    anglePickers.forEach((item, index) => {
        item.setDefaults(maps[index].input, maps[index].output, maps[index].distance); // Do not emit changes
    });
}

// Populate all the angle selector HTML items, optionally updating our memory
function populateAngleSelectors(maps) {
    let anglePickers = mdContainer.querySelectorAll('angle-selector');
    anglePickers.forEach((item, index) => {
        if(index < maps.length)
            item.setAll(maps[index].input, maps[index].output, maps[index].distance); // Do not emit changes
        else 
            item.setAll(0, 0, 0); // Do not emit changes
        });
}

function angleDistance(angle1, angle2) {
    // Normalize angles to be within 0-360
    angle1 = ((angle1 % 360) + 360) % 360;
    angle2 = ((angle2 % 360) + 360) % 360;

    // Calculate the absolute difference
    let diff = Math.abs(angle1 - angle2);

    // Account for wraparound
    return Math.min(diff, 360 - diff);
}

async function populateNearestAngle(capturedAngle) {
    // Find the index of the closest where the distance is non-zero
    let matchingIdx = 0;
    let lowestDistance = 360;
    let listToCheck = null;
    if(!selectedAxis)
    {
        listToCheck = gamepad.analog_cfg.l_angle_maps;
    }
    else 
    {
        listToCheck = gamepad.analog_cfg.r_angle_maps;
    }

    listToCheck.forEach((value, index) => {
        let d = angleDistance(value.output, capturedAngle);
        if(d<lowestDistance) {
            lowestDistance = d;
            matchingIdx = index;
        }
    });

    // Update value and re-populate
    listToCheck[matchingIdx].input = capturedAngle;

    if(!selectedAxis)
    {
        gamepad.analog_cfg.l_angle_maps = listToCheck;
    }
    else 
    {
        gamepad.analog_cfg.r_angle_maps = listToCheck;
    }

    populateAngleSelectors(listToCheck);
    await writeAngleMemBlock();
}

// Sort and clean up an array of Anglemaps
function sortAndFilterAnglemaps(maps) {
    // Filter out objects where the distance is less than 1000
    const filteredArray = maps.filter(item => item.distance >= 1000);

    // Sort the filtered array by the output (angle)
    const sortedArray = filteredArray.sort((a, b) => a.output - b.output);

    /** @type {Anglemap[]} */
    let outMaps = [];

    // Overwrite the elements in outMaps with the sorted array data
    sortedArray.forEach((item, index) => {
        let newMap = new Anglemap();
        newMap.distance = item.distance;
        newMap.input = item.input || 0; // Default to 0 if input is undefined
        newMap.output = item.output;
        outMaps.push(newMap);
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
        return true;
    } catch (error) {
        console.error('Failed to export angles:', error);
        return false; // Indicate failure gracefully
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
        let angleEntries = [];

        entries.forEach((item, index) => {
            let entry = new Anglemap();
            entry.input   = item.inAngle;
            entry.output    = item.outAngle;
            entry.distance  = item.distance;

            angleEntries.push(entry);
        });

        // Sort our map
        angleEntries = sortAndFilterAnglemaps(angleEntries);
        populateAngleSelectors(angleEntries);

        writeAngleMemBlock();

        console.log('Import successful.');
        return true;
    } catch (error) {
        console.error('Failed to import angles:', error);
        return false;
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

async function captureAngleHandler() {
    // CFG_BLOCK_ANALOG 2
    // ANALOG_CMD_CAPTURE_ANGLE 3
    let {status, data} = await gamepad.sendConfigCommand(analogCfgBlockNumber, 3);

    if(status && data) {
        // Create DataView from your Uint8Array
        const view = new DataView(data.buffer);
        capturedAngles.left     = view.getFloat32(0, true);
        capturedAngles.right    = view.getFloat32(4, true);

        if(selectedAxis==0) {
            return capturedAngles.left;
        }
        else {
            return capturedAngles.right;
        }
    }

    return null;
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

    const snapbackModePicker = mdContainer.querySelector('multi-position-button[id="snapback-mode-selector"]');

    let scalerModeIdx = scalerModePicker.getState().selectedIndex;
    let deadzoneValue = deadzoneSlider.getState().formattedValue;
    let snapbackMode = snapbackModePicker.getState().selectedIndex;

    updateAnalogVisualizerScaler(scalerModeIdx);
    updateAnalogVisualizerDeadzone(deadzoneValue);
    updateAnalogVisualizerPolygon(maps);

    if(selectedAxis==0)
    {
        gamepad.analog_cfg.l_angle_maps = maps; 
        gamepad.analog_cfg.l_deadzone = deadzoneValue; 
        gamepad.analog_cfg.l_scaler_type = scalerModeIdx; 
        gamepad.analog_cfg.l_snapback_type = snapbackMode; 
    }
    else 
    {
        gamepad.analog_cfg.r_angle_maps = maps; 
        gamepad.analog_cfg.r_deadzone = deadzoneValue; 
        gamepad.analog_cfg.r_scaler_type = scalerModeIdx; 
        gamepad.analog_cfg.r_snapback_type = snapbackMode; 
    }

    await gamepad.sendBlock(analogCfgBlockNumber);
}

// Render the analog settings page
export function render(container) {
    selectedAxis = 0;
    
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
    let snapbackIdx = gamepad.analog_cfg.l_snapback_type;
    let mode = (gamepad.analog_cfg.l_scaler_type==1) ? 'polygon' : 'round';
    let deadzone = gamepad.analog_cfg.l_deadzone;
    let polyVerticesString = mapsToStyleString(angleConfigs);

    container.innerHTML = `
            <h2>Calibrate</h2>
            <div class="app-text-container">
            To calibrate both sticks, press Calibrate. Move both analog sticks in a full circle slowly. Press Stop. 
            Verify the output of your analog sticks and that they both reach the full output range. Click Save to retain your new calibration settings.
            <strong>You must calibrate both analog sticks at once.</strong>
            </div>
            <div class="app-row">
                <tristate-button 
                    id="calibrate-button" 
                    off-text="Calibrate" 
                    on-text="Stop"
                    off-to-on-text="Calibrate"
                    on-to-off-text="Stop"
                ></tristate-button>

                <single-shot-button 
                    id="global-angle-button" 
                    state="ready" 
                    ready-text="Angle Set" 
                    disabled-text="Angle Set"
                    pending-text="Setting..."
                    success-text="Set Success"
                    failure-text="Set Error"
                    tooltip="Quickly capture an angle and it will be assigned to the most similar angle."
                ></single-shot-button>
            </div>

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

            <h2>Snapback Filter
            <div class="header-tooltip" tooltip="The snapback filter required for ProCon sticks is quite aggressive and may not be to your liking. For more responsiveness, you may disable this filter per stick.">?</div>
            </h2>
            <multi-position-button 
                id="snapback-mode-selector" 
                labels="On, Off"
                default-selected="${snapbackIdx}"
            ></multi-position-button>

            <h2>Angles</h2>
            <div class="app-row">
                <single-shot-button 
                    id="copy-angles-button" 
                    state="ready" 
                    ready-text="Copy" 
                    disabled-text="Copy"
                    pending-text="Copy"
                    success-text="Copied!"
                    failure-text="Copy Error"
                    tooltip="Copy your Output/Distance\ndata as JSON"
                ></single-shot-button>

                <single-shot-button 
                    id="paste-angles-button" 
                    state="ready" 
                    ready-text="Paste" 
                    disabled-text="Paste"
                    pending-text="Paste"
                    success-text="Pasted!"
                    failure-text="Paste Error"
                    tooltip="Paste your Output/Distance data as JSON"
                ></single-shot-button>

                <single-shot-button 
                    id="reset-angles-button" 
                    state="ready" 
                    ready-text="Reset All" 
                    disabled-text="Reset All"
                    pending-text="Reset All"
                    success-text="Reset!"
                    failure-text="Reset Error"
                    tooltip="Reset all angles to an 8 angle setup"
                ></single-shot-button>
            </div>
            ${anglePickersHTML}
            <h2>Invert Axis</h2>
            <axis-invert-selector 
                default-lx="${gamepad.analog_cfg.lx_invert ? 'true' : 'false'}"
                default-ly="${gamepad.analog_cfg.ly_invert ? 'true' : 'false'}"
                default-rx="${gamepad.analog_cfg.rx_invert ? 'true' : 'false'}"
                default-ry="${gamepad.analog_cfg.ry_invert ? 'true' : 'false'}"
            ></axis-invert-selector>
    `;

    // Set analog angle change handler
    const anglePickers = container.querySelectorAll('angle-selector');
    anglePickers.forEach(picker => {
        picker.addEventListener('angle-change', (e) => {
            writeAngleMemBlock();
        });

        picker.setAngleCaptureHandler(captureAngleHandler);
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
    const resetButton = container.querySelector('single-shot-button[id="reset-angles-button"]');
    copyButton.setOnClick(exportAngles);
    pasteButton.setOnClick(importAngles);
    resetButton.setOnClick(resetAllAnglesDefault);

    // Global angle capture
    const globalCaptureButton = container.querySelector('single-shot-button[id="global-angle-button"]');
    globalCaptureButton.setOnClick(async function () {
        let angle = await captureAngleHandler();

        if(angle) {
            await populateNearestAngle(angle);
            return true;
        }
        else return false;
    });

    const scaleModeButton = container.querySelector('multi-position-button[id="scale-mode-selector"]');
    scaleModeButton.addEventListener('change', (e) => {
        console.log("Scale Mode Change");
        writeAngleMemBlock();
    });

    const snapbackModeButton = container.querySelector('multi-position-button[id="snapback-mode-selector"]');
    snapbackModeButton.addEventListener('change', (e) => {
        console.log("Snapback Mode Change");
        writeAngleMemBlock();
    });

    const deadzoneSlider = container.querySelector('number-selector[id="deadzone-slider"]');
    deadzoneSlider.addEventListener('change', (e) => {
        console.log("Deadzone Change");
        writeAngleMemBlock();
    });

    // Set calibration command handlers 
    const calibrateButton = container.querySelector('tristate-button[id="calibrate-button"]');

    calibrateButton.setOnHandler(async () => {
        // CFG_BLOCK_ANALOG, ANALOG_CMD_CALIBRATE_START
        let {status, data} = await gamepad.sendConfigCommand(2, 1);
        return status;
    });

    calibrateButton.setOffHandler(async () => {
        // CFG_BLOCK_ANALOG, ANALOG_CMD_CALIBRATE_STOP
        let {status, data} = await gamepad.sendConfigCommand(2, 2);

        // Reload our mem block
        await gamepad.requestBlock(analogCfgBlockNumber);
        return status;
    });

    const invertAxisSelector = container.querySelector('axis-invert-selector');

    invertAxisSelector.addEventListener('change', (event) => {
        const { axis, inverted } = event.detail;
        console.log(`${axis} is now ${inverted ? 'inverted' : 'normal'}`);
        switch(axis) {
            case 'LX':
                // Left stick X-axis inversion
                gamepad.analog_cfg.lx_invert = inverted;
                break;
            case 'LY':
                // Left stick Y-axis inversion
                gamepad.analog_cfg.ly_invert = inverted;
                break;
            case 'RX':
                // Right stick X-axis inversion
                gamepad.analog_cfg.rx_invert = inverted;
                break;
            case 'RY':
                // Right stick Y-axis inversion
                gamepad.analog_cfg.ry_invert = inverted;
                break;
            default:
                console.warn(`Unknown axis: ${axis}`);
        }
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