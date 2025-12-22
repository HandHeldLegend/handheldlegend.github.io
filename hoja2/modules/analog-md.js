import HojaGamepad from '../js/gamepad.js';
import { enableTooltips } from '../js/tooltips.js';

import JoystickVisualizer from '../components/joystick-visual.js';
import NumberSelector from '../components/number-selector.js';
import WaveformDisplay from '../components/waveform-display.js';

import MultiPositionButton from '../components/multi-position-button.js';
import TristateButton from '../components/tristate-button.js';
import SingleShotButton from '../components/single-shot-button.js';
import AngleModifier from '../components/angle-modifier.js';
import Analogconfig from '../factory/parsers/analogConfig.js';
import Joyconfigslot from '../factory/parsers/joyConfigSlot.js';

let capturedData = {
    angle: 0,
    distance: 0
};

let selectedAxis = 0;

/** @type {JoystickVisualizer} */
let joystickVisual;

/** @type {HojaGamepad} */
const gamepad = HojaGamepad.getInstance();
const analogCfgBlockNumber = 2;

/** @type {Joyconfigslot[]} */
let currentConfigSlots;

let innerDeadzone = 0;
let outerDeadzone = 0;

let analogModuleContainer;

let dzInnerPicker;
let dzOuterPicker;

/** @type {AngleModifier} */
let angleMods;

async function populateNearestAngle(capturedData) {
    // Find the nearest angle in the current configuration
    let nearestAngleIndex = 0;
    let minDistance = Infinity;

    for (let i = 0; i < currentConfigSlots.length; i++) {
        if (currentConfigSlots[i].enabled) {
            let dist = angleDistance(capturedData.angle, currentConfigSlots[i].in_angle);
            if (dist < minDistance) {
                minDistance = dist;
                nearestAngleIndex = i;
            }

        }
    }

    // Set the captured data to the nearest angle
    currentConfigSlots[nearestAngleIndex].in_angle = capturedData.angle;
    currentConfigSlots[nearestAngleIndex].in_distance = capturedData.distance;

    // Write the updated configuration back to the gamepad
    await writeAngleMemBlock();

    // Refresh the UI to reflect the changes
    populateUIElements(true);
    return true;
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
    // ANALOG_CMD_CAPTURE_JOYSTICK_L 3
    // ANALOG_CMD_CAPTURE_JOYSTICK_R 4

    let command = selectedAxis == 0 ? 3 : 4;

    let { status, data } = await gamepad.sendConfigCommand(analogCfgBlockNumber, command);

    if (status && data) {
        // Create DataView from your Uint8Array
        const view = new DataView(data.buffer);
        capturedData.angle = view.getFloat32(0, true);
        capturedData.distance = view.getFloat32(4, true);

        console.log('Captured angle:', capturedData.angle);
        console.log('Captured distance:', capturedData.distance);

        return capturedData;
    }

    return null;
}

async function readAngleMemBlock() {
    await gamepad.requestBlock(analogCfgBlockNumber);
}

// Grab all the current config option values
// and write them to our controller memory 
async function writeAngleMemBlock() {
    // Write current config block to gamepad
    if(selectedAxis == 0) {
        gamepad.analog_cfg.joy_config_l = currentConfigSlots;
        gamepad.analog_cfg.l_deadzone = innerDeadzone;
        gamepad.analog_cfg.l_deadzone_outer = outerDeadzone;
    } else if (selectedAxis == 1) {
        gamepad.analog_cfg.joy_config_r = currentConfigSlots;
        gamepad.analog_cfg.r_deadzone = innerDeadzone;
        gamepad.analog_cfg.r_deadzone_outer = outerDeadzone;
    }

    gamepad.analog_cfg.analog_calibration_set = 1;

    await gamepad.sendBlock(analogCfgBlockNumber);
}

async function populateUIElements(refresh = false) {
    if(refresh===true)
        // Get the current config block from the gamepad
        await readAngleMemBlock();

    // Get selected config
    /** @type {Joyconfigslot[]} */
    currentConfigSlots = selectedAxis === 0 ? gamepad.analog_cfg.joy_config_l : gamepad.analog_cfg.joy_config_r;

    innerDeadzone = selectedAxis === 0 ? gamepad.analog_cfg.l_deadzone : gamepad.analog_cfg.r_deadzone;
    outerDeadzone = selectedAxis === 0 ? gamepad.analog_cfg.l_deadzone_outer : gamepad.analog_cfg.r_deadzone_outer;

    if(analogModuleContainer) {

        // Set deadzone picker values
        if(dzInnerPicker && dzOuterPicker) {
            dzInnerPicker.setState(innerDeadzone);
            dzOuterPicker.setState(outerDeadzone);
        }
        // --------------------------

        // Set joystick visualizer deadzones
        if(joystickVisual) {
            joystickVisual.setDeadzones(
                innerDeadzone,
                outerDeadzone
            );
        }
        // --------------------------

        // Set angle modifier values
        if(angleMods) {
            let defaultPoints = [];
            for (let angle = 0; angle < 16; angle++) {
                if (currentConfigSlots[angle].enabled) {
                    defaultPoints.push({
                        inAngle:    currentConfigSlots[angle].in_angle,
                        inDist:     currentConfigSlots[angle].in_distance,
                        outAngle:   currentConfigSlots[angle].out_angle,
                        outDist:    currentConfigSlots[angle].out_distance,
                        deadzone:   currentConfigSlots[angle].deadzone
                    });
                }
            }

            // Assign the array to the component's internal points reference
            angleMods.points = defaultPoints;

            angleMods.refresh();
        }
        // --------------------------
    }
}

const acss = `
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

function deadzoneInnerAdjustHandler(detail) {
    console.log(detail);
}

function deadzoneOuterAdjustHandler(detail) {
    console.log(detail);
}

async function addAngleNew() {
     let command = selectedAxis == 0 ? 3 : 4;

    let { status, data } = await gamepad.sendConfigCommand(analogCfgBlockNumber, command);

    if (status && data) {
        // Create DataView from your Uint8Array
        const view = new DataView(data.buffer);
        capturedData.angle = view.getFloat32(0, true);
        capturedData.distance = view.getFloat32(4, true);

        // Get the first disabled slot
        let newSlot = currentConfigSlots.find(slot => !slot.enabled);
        if (newSlot) {
            newSlot.in_angle = capturedData.angle;
            newSlot.in_distance = capturedData.distance;
            newSlot.out_angle = capturedData.angle;
            newSlot.out_distance = 2048;
            newSlot.deadzone = 2;
            newSlot.enabled = true;
        }

        currentConfigSlots[newSlot.index] = newSlot;

        // Write the updated configuration back to the gamepad
        await writeAngleMemBlock();
        populateUIElements(true);
    }
}

async function angleDeleteHandler(detail) {
    let index = detail.index;
    
    // Reset slot to default
    currentConfigSlots[index].deadzone = 2;
    currentConfigSlots[index].in_angle = 0;
    currentConfigSlots[index].in_distance = 2048;
    currentConfigSlots[index].out_angle = 0;
    currentConfigSlots[index].out_distance = 2048;
    currentConfigSlots[index].deadzone = 2;
    currentConfigSlots[index].enabled = false;

    // Write the updated configuration back to the gamepad
    await writeAngleMemBlock();
    populateUIElements(true);
}

async function angleCaptureHandler(detail) {
    
    let idx = detail.index;

    let command = selectedAxis == 0 ? 3 : 4;

    let { status, data } = await gamepad.sendConfigCommand(analogCfgBlockNumber, command);

    if (status && data) {
        // Create DataView from your Uint8Array
        const view = new DataView(data.buffer);
        capturedData.angle = view.getFloat32(0, true);
        capturedData.distance = view.getFloat32(4, true);

        console.log('Captured angle:', capturedData.angle);
        console.log('Captured distance:', capturedData.distance);

        currentConfigSlots[idx].in_angle = capturedData.angle;
        currentConfigSlots[idx].in_distance = capturedData.distance;

        // Write the updated configuration back to the gamepad
        await writeAngleMemBlock();
        populateUIElements(true);
    }
}

async function angleChangeHandler(detail) {
    console.log(detail);

    let slot = currentConfigSlots[detail.index];

    slot.in_angle = parseFloat(detail.data.inAngle);
    slot.in_distance = parseFloat(detail.data.inDist);
    slot.out_angle = parseFloat(detail.data.outAngle);
    slot.out_distance = parseFloat(detail.data.outDist);
    slot.deadzone = parseFloat(detail.data.deadzone);
    currentConfigSlots[detail.index] = slot;

    console.log('Angle changed:', currentConfigSlots[detail.index]);

    await writeAngleMemBlock();
    populateUIElements(true);
}

async function angleResetHandler() {
    
    for (let i = 0; i < 8; i++) {
        currentConfigSlots[i].deadzone = 2;
        currentConfigSlots[i].in_angle = i*45;
        currentConfigSlots[i].in_distance = 1028;
        currentConfigSlots[i].out_angle = i*45;
        currentConfigSlots[i].out_distance = 2048;
        currentConfigSlots[i].enabled = true;
    }

    // Remaining should be disabled
    for (let i = 8; i < 16; i++) {
        currentConfigSlots[i].deadzone = 2;
        currentConfigSlots[i].in_angle = 0;
        currentConfigSlots[i].in_distance = 2048;
        currentConfigSlots[i].out_angle = 0;
        currentConfigSlots[i].out_distance = 2048;
        currentConfigSlots[i].deadzone = 2;
        currentConfigSlots[i].enabled = false;
    }

    await writeAngleMemBlock();
    populateUIElements(true);
}

// Render the analog settings page
export function render(container) {
    analogModuleContainer = container;
    selectedAxis = 0;

    container.innerHTML = `
            <style>${acss}</style>    
            <div class="app-text-container">
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
                <h3 style="width: 50px;">DZ In<div class="header-tooltip" tooltip="Inner deadzone (Center)">?</div></h3>
                <div class="vert-separator" style="margin-left:35px"></div>
                <number-selector 
                    id="inner-deadzone-picker" 
                    type="int" 
                    min="0" 
                    max="1000" 
                    step="24" 
                    value="0"
                    width="240"
                ></number-selector>
            </div>

             <div class="app-row">
                <h3 style="width: 64px;">DZ Out<div class="header-tooltip" tooltip="Outer deadzone (Edge)">?</div></h3>
                <div class="vert-separator" style="margin-left:20px"></div>
                <number-selector 
                    id="outer-deadzone-picker" 
                    type="int" 
                    min="0" 
                    max="1000" 
                    step="24" 
                    value="0"
                    width="240"
                ></number-selector>
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

                <div class="app-row">
                <multi-position-button 
                    id="output-visualizer-type" 
                    options="Full, GC, Melee, N64"
                    selected="0"
                    width="180"
                ></multi-position-button>
                <div class="header-tooltip" tooltip="Show the translated coordinates for a given gamepad mode.">?</div>
                </div>

                <joystick-visualizer id="joystick"></joystick-visualizer>

                <div class="separator"></div>

            <div class="app-row">
                <h2>Angles</h2>
                <div class="vert-separator"></div>
                <div class="angle-btn" id="add-angle"
                tooltip="Hold your joystick to the desired angle, then click the button to add a new angle to the list."
                >+</div>
            </div>

            <angle-modifier></angle-modifier>

            <single-shot-button 
                id="angles-reset-button" 
                state="ready"
                ready-text="Reset Angles" 
                disabled-text="Reset Angles"
                pending-text="Resetting..."
                success-text="Reset Success"
                failure-text="Reset Error"
                tooltip="This resets all angles and calibration to the default values."
            ></single-shot-button>
    `;

    // JOYSTICK VISUALIZER
    joystickVisual = container.querySelector('joystick-visualizer');
    joystickVisual.setDeadzones(0, 0);

    // GLOBAL ANGLE CAPTURE HANDLER
    const globalCaptureButton = container.querySelector('single-shot-button[id="global-angle-button"]');
    globalCaptureButton.setOnClick(async function () {
        let capture = await captureAngleHandler();

        if (capture) {
            await populateNearestAngle(capture);
            return true;
        }
        else return false;
    });

    // TRACER ENABLE
    const traceSelector = container.querySelector('multi-position-button[id="trace-enable"]');
    traceSelector.addEventListener('change', (e) => {
        if (joystickVisual) {
            if(e.detail.selectedIndex == 0) {
                joystickVisual.resetTrace();
                joystickVisual.stopTracing();
            }
            else if(e.detail.selectedIndex == 1) {
                joystickVisual.resetTrace();
                joystickVisual.startTracing();
            }
        }
    });
    // -----------------------------

    // OUTPUT VISUALIZER TYPE SELECTOR
    const outputVisualizerTypeSelector = container.querySelector('multi-position-button[id="output-visualizer-type"]');
    outputVisualizerTypeSelector.addEventListener('change', (e) => {
        joystickVisual.setMeleeMode(false);

        if(e.detail.selectedIndex == 0) {
            joystickVisual.setAxisOutputRoundingPoints(1);
            joystickVisual.setAxisOutputScaler(1.0);
        }
        else if(e.detail.selectedIndex == 1) {
            joystickVisual.setAxisOutputRoundingPoints(0);
            joystickVisual.setAxisOutputScaler(0.0537109375);
        }
        else if (e.detail.selectedIndex == 2) {
            joystickVisual.setMeleeMode(true);
        }
        else if(e.detail.selectedIndex == 3) {
            joystickVisual.setAxisOutputRoundingPoints(0);
            joystickVisual.setAxisOutputScaler(0.04150390625);
        }
    });
    // -----------------------------

    // AXIS SELECTOR
    const joystickSelector = container.querySelector('multi-position-button[id="joystick-selector"]');
    joystickSelector.addEventListener('change', (e) => {
        selectedAxis = e.detail.selectedIndex;
        if(joystickVisual) {
            joystickVisual.resetTrace();
        }

        populateUIElements();
    });
    // -----------------------------

    // ANGLE ADJUSTMENT HANDLERS
    angleMods = analogModuleContainer.querySelector('angle-modifier');

    angleMods.addEventListener('change', (e) => {
        angleChangeHandler(e.detail);
    });

    angleMods.addEventListener('capture', (e) => {
        angleCaptureHandler(e.detail);
    });

    angleMods.addEventListener('delete', (e) => {

        // Check to ensure we have at least 8 angles before allowing deletion
        if(currentConfigSlots.filter(slot => slot.enabled).length <= 8) {
            console.log("Cannot delete angle, must have at least 8 angles.");
            return;
        }

        angleDeleteHandler(e.detail);
    });
    // -----------------------------
    

    // ADD ANGLE HANDLER
    const addAngleButton = container.querySelector('#add-angle');
    addAngleButton.addEventListener('click', (e) => {
        addAngleNew();
    });
    // -----------------------------

    // CALIBRATE BUTTON HANDLERS
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

        populateUIElements(true);
        return status;
    });
    // -----------------------------

    // DEADZONE ADJUSTMENT HANDLERS
    dzInnerPicker = container.querySelector('number-selector[id="inner-deadzone-picker"]');
    dzOuterPicker = container.querySelector('number-selector[id="outer-deadzone-picker"]');

    dzInnerPicker.addEventListener('change', async (e) => {
        innerDeadzone = e.detail.value;
        await writeAngleMemBlock();
        populateUIElements();
    });

    dzOuterPicker.addEventListener('change', async (e) => {
        outerDeadzone = e.detail.value;
        await writeAngleMemBlock();
        populateUIElements();
    });
    // -----------------------------

    // ANGLE RESET BUTTON HANDLERS
    const angleResetButton = container.querySelector('single-shot-button[id="angles-reset-button"]');
    angleResetButton.setOnClick(async function () {
        await angleResetHandler();
        return true;
    });
    // -----------------------------


    enableTooltips(container);

    populateUIElements();

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