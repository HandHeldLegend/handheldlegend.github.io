import HojaGamepad from '../js/gamepad.js';
import { enableTooltips } from '../js/tooltips.js';

import JoystickVisualizer from '../components/joystick-visual.js';
import NumberSelector from '../components/number-selector.js';
import WaveformDisplay from '../components/waveform-display.js';

import MultiPositionButton from '../components/multi-position-button.js';
import TristateButton from '../components/tristate-button.js';
import SingleShotButton from '../components/single-shot-button.js';
import AngleModifier from '../components/angle-modifier.js';

let capturedAngles = {
    left: 0,
    right: 0
};

let selectedAxis = 0;

/** @type {JoystickVisualizer} */
let joystickVisual;

/** @type {AngleModifier} */
let angleMods;

/** @type {HojaGamepad} */
const gamepad = HojaGamepad.getInstance();
const analogCfgBlockNumber = 2;

function resetAllAnglesDefault() {

    writeAngleMemBlock();
    return true;
}

function mapsToStyleString(maps) {
    let output = "";
    maps.forEach(value => {
        if (value.distance > 1000)
            output += `${value.output},${value.distance};`
    });

    output.slice(0, -1);
    return output;
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

async function captureAngleHandler() {
    // CFG_BLOCK_ANALOG 2
    // ANALOG_CMD_CAPTURE_ANGLE 3
    let { status, data } = await gamepad.sendConfigCommand(analogCfgBlockNumber, 3);

    if (status && data) {
        // Create DataView from your Uint8Array
        const view = new DataView(data.buffer);
        capturedAngles.left = view.getFloat32(0, true);
        capturedAngles.right = view.getFloat32(4, true);

        if (selectedAxis == 0) {
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

    await gamepad.sendBlock(analogCfgBlockNumber);
}

const acss = `
.analog-container {
    color: var(--color-text-tertiary);
    padding: 8px;
    padding-top: 5px;
    text-align: center;
    border:  var(--spacing-xs) solid var(--color-p1-light);
    background: var(--color-p1-grad);
    background-color: var(--color-p1);
    border-radius: var(--border-radius-md);
    font-size: var(--font-size-sm);
    width: 350px;
}

.angle-btn {
    cursor: pointer;
    padding-bottom: 4px;

    align-content: center;
    text-align: center;

    color: var(--color-text-tertiary);
    height: var(--button-h);
    width: var(--button-h);

    font-weight: bold;
    font-size: var(--font-size-lg);

    background: var(--color-p1-grad);
    background-color: var(--color-p1);
    border: var(--spacing-xs) solid var(--color-p1-dark);
    border-radius: var(--border-radius-md);

    overflow: hidden;
    box-sizing: border-box;

    align-items: center;

    /* Prevent text selection */
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;

    transition: all var(--transition-quick);
}

@media (hover: hover) {
    .angle-btn:hover:not(:active){
        filter:brightness(1.1);
        box-shadow: var(--box-shadow-outset);
        transform: translate(-1px, -1px);
        transition: all var(--transition-quick);
    }
}
`

// Render the analog settings page
export function render(container) {
    let snapbackIdxLeft = gamepad.analog_cfg.l_snapback_type;
    let snapbackIdxRight = gamepad.analog_cfg.r_snapback_type;

    let snapbackCutoffLeft = (gamepad.analog_cfg.l_snapback_intensity / 10);
    let snapbackCutoffRight = (gamepad.analog_cfg.r_snapback_intensity / 10);

    container.innerHTML = `
            <style>${acss}</style>    
            <div class="analog-container">
                To calibrate both sticks, press <strong>Calibrate</strong>.<br>
                Move both analog sticks in a full circle slowly.<br><br>
                Press <strong>Stop</strong> once you have rotated both sticks several times.
                <br><br>
                Verify the output of your analog sticks and that they both reach the full output range. Click <strong>Save</strong>!
                <br><br>
                <strong>You must calibrate both analog sticks at once.</strong>
            </div>

            <h2>Options</h2>
            <div class="app-row">
                <h3>Axis</h3>
                <div class="vert-separator"></div>
                <multi-position-button 
                        id="joystick-selector" 
                        options="Left, Right"
                        selected="0"
                        width="100"
                ></multi-position-button>
            </div>

            <div class="app-row">
                <tristate-button 
                    id="calibrate-button" 
                    off-text="Calibrate" 
                    on-text="Stop"
                    off-to-on-text="Calibrate"
                    on-to-off-text="Stop"
                    width="70"
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

            <div class="separator"></div>

                
                <h2>Visualizer</h2> 

                <div class="app-row">
                <h3>Trace</h3>
                <div class="vert-separator"></div>
                <multi-position-button 
                    id="trace-enable" 
                    options="Off, On"
                    selected="0"
                    width="100"
                ></multi-position-button>
                </div>

                <joystick-visualizer id="joystick"></joystick-visualizer>

                <div class="separator"></div>

            <div class="app-row">
                <h2>Angles</h2>
                <div class="vert-separator"></div>
                <div class="angle-btn" id="add-angle">+</div>
            </div>

            <angle-modifier></angle-modifier>
    `;

    // Global angle capture
    const globalCaptureButton = container.querySelector('single-shot-button[id="global-angle-button"]');
    globalCaptureButton.setOnClick(async function () {
        let angle = await captureAngleHandler();

        if (angle) {
            await populateNearestAngle(angle);
            return true;
        }
        else return false;
    });


    angleMods = container.querySelector('angle-modifier');

    const increment = 45;
    const defaultDistance = 2048;
    const defaultDeadzone = 2.00; // Match the new parameter requirement
    let defaultPoints = [];

    for (let angle = 0; angle < 360; angle += increment) {
        defaultPoints.push({
            inAngle: angle,
            inDist: defaultDistance,
            outAngle: angle,
            outDist: defaultDistance,
            deadzone: defaultDeadzone // Added to support the new UI column
        });
    }

    // Assign the array to the component's internal points reference
    angleMods.points = defaultPoints;

    // Trigger the render process
    angleMods.refresh();

    // Set calibration command handlers 
    const calibrateButton = container.querySelector('tristate-button[id="calibrate-button"]');

    calibrateButton.setOnHandler(async () => {

        if (joystickVisual) joystickVisual.resetTrace();

        // CFG_BLOCK_ANALOG, ANALOG_CMD_CALIBRATE_START
        let { status, data } = await gamepad.sendConfigCommand(2, 1);
        return status;
    });

    calibrateButton.setOffHandler(async () => {
        // CFG_BLOCK_ANALOG, ANALOG_CMD_CALIBRATE_STOP
        let { status, data } = await gamepad.sendConfigCommand(2, 2);

        // Reload our mem block
        await gamepad.requestBlock(analogCfgBlockNumber);
        return status;
    });


    enableTooltips(container);

    joystickVisual = container.querySelector('joystick-visualizer');

    if (joystickVisual) {
        let deadzoneInner = selectedAxis === 0 ? gamepad.analog_cfg.l_deadzone : gamepad.analog_cfg.r_deadzone;
        let deadzoneOuter = selectedAxis === 0 ? gamepad.analog_cfg.l_deadzone_outer : gamepad.analog_cfg.r_deadzone_outer;

        console.log(deadzoneInner);
        console.log(deadzoneOuter);

        joystickVisual.setDeadzones(
            deadzoneInner,
            deadzoneOuter
        );

        joystickVisual.startTracing();
    }

    gamepad.setInputMode(true);

    // Set input loop hook to use the analog data
    gamepad.setReportHook((data) => {

        if (data.getUint8(0) != 0xFE) return;

        let offset = 0;
        let base = 15;

        if (selectedAxis == 1) {
            offset = 4;
        }

        let x = (data.getUint8(offset + base) << 8) | (data.getUint8(1 + offset + base));
        let y = ((data.getUint8(2 + offset + base) << 8) | (data.getUint8(3 + offset + base)));

        //x -= 2048;
        //y -= 2048;

        base = 23;

        let x_scaled = (data.getUint8(offset + base) << 8) | (data.getUint8(1 + offset + base));
        let y_scaled = ((data.getUint8(2 + offset + base) << 8) | (data.getUint8(3 + offset + base)));
        //x_scaled -= 2048;
        //y_scaled -= 2048;

        if (joystickVisual) {
            joystickVisual.setInput(x, y, x_scaled, y_scaled);
        }
        //analogVisualizer.setAnalogInput(x, y, x_scaled, y_scaled);
    });
}