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
let anglePickers = null;

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

function writeToClipboard(text) {
    navigator.clipboard.writeText(text)
        .then(() => {
            console.log('Text successfully copied to clipboard!');
        })
        .catch(err => {
            console.error('Failed to copy text to clipboard:', err);
        });
}

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

        /** @type {HojaGamepad} */
        let gamepad = HojaGamepad.getInstance();

        /** @type {Anglemap[]} */
        let angleEntries = (selectedAxis==0) ? gamepad.analog_cfg.l_angle_maps : gamepad.analog_cfg.r_angle_maps;
        let idx = 0;

        // Process each entry
        for (const entry of entries) {
            if (entry.inAngle === undefined || entry.outAngle === undefined || entry.distance === undefined) {
                console.warn('Skipping invalid entry:', entry);
                continue;
            }

            //angleEntries[idx].input = entry.inAngle;
            //ngleEntries[idx].output = entry.outAngle;
            //angleEntries[idx].distance = entry.distance;
            anglePickers[idx].setAll(entry.inAngle, entry.outAngle, entry.distance);
            idx+=1;
        }

        console.log('Import successful.');
    } catch (error) {
        console.error('Failed to import angles:', error);
    }
}


function updateAngleParam(axis, idx, input, output, distance) {
    /** @type {HojaGamepad} */
    let gamepad = HojaGamepad.getInstance();

    input = validateAngle(input);
    output = validateAngle(output);
    distance = validateDistance(distance);

    if(axis>0)
    {
        /** @type {Anglemap[]} */
        let tmpAngleMaps = gamepad.analog_cfg.r_angle_maps;
        
        tmpAngleMaps[idx].distance = distance;
        tmpAngleMaps[idx].input = input;
        tmpAngleMaps[idx].output = output;
        gamepad.analog_cfg.r_angle_maps = tmpAngleMaps;
    }
    else 
    {
        /** @type {Anglemap[]} */
        let tmpAngleMaps = gamepad.analog_cfg.l_angle_maps;

        tmpAngleMaps[idx].distance = distance;
        tmpAngleMaps[idx].input = input;
        tmpAngleMaps[idx].output = output;
        gamepad.analog_cfg.l_angle_maps = tmpAngleMaps;

        tmpAngleMaps = gamepad.analog_cfg.l_angle_maps;
    }

    gamepad.sendBlock(2);
}

export function render(container) {

    /** @type {HojaGamepad} */
    let gamepad = HojaGamepad.getInstance();

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
                mode="polygon" 
                deadzone="500"
                polygon-vertices="0,2048;90,2048;180,2048;270,2048"
            ></analog-stick>

            <h2>Deadzone</h2>
            <number-selector 
                id="deadzone-slider" 
                type="int" 
                min="0" 
                max="1000" 
                step="1" 
                default-value="300"
            ></number-selector>

            <h2>Mode</h2>
            <multi-position-button 
                id="scale-mode-selector" 
                labels="Round, Polygon"
                default-selected="0"
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

    // Set event change listeners
    anglePickers = container.querySelectorAll('angle-selector');

    anglePickers.forEach(picker => {
        picker.addEventListener('angle-change', (e) => {
            updateAngleParam(selectedAxis, e.detail.idx, 
                e.detail.inAngle, e.detail.outAngle, e.detail.distance);
        });

    });

    const copyButton = container.querySelector('single-shot-button[id="copy-angles-button"]');
    const pasteButton = container.querySelector('single-shot-button[id="paste-angles-button"]');

    console.log(copyButton);

    copyButton.setOnClick(exportAngles);
    pasteButton.setOnClick(importAngles);

    enableTooltips(container);
}