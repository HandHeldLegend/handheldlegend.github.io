import HojaGamepad from '../js/gamepad.js';
import { enableTooltips } from '../js/tooltips.js';

import JoystickVisualizer from '../components/joystick-visual.js';
import NumberSelector from '../components/number-selector.js';
import WaveformDisplay from '../components/waveform-display.js';

import MultiPositionButton from '../components/multi-position-button.js';
import TristateButton from '../components/tristate-button.js';
import SingleShotButton from '../components/single-shot-button.js';

let capturedAngles = {
    left: 0,
    right: 0
};

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
        if(value.distance>1000)
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

    await gamepad.sendBlock(analogCfgBlockNumber);
}

// Render the analog settings page
export function render(container) {
    let snapbackIdxLeft = gamepad.analog_cfg.l_snapback_type;
    let snapbackIdxRight = gamepad.analog_cfg.r_snapback_type;

    let snapbackCutoffLeft  = (gamepad.analog_cfg.l_snapback_intensity / 10);
    let snapbackCutoffRight = (gamepad.analog_cfg.r_snapback_intensity / 10);

    container.innerHTML = `
            <multi-position-button 
                id="joystick-selector" 
                labels="Left, Right"
                default-selected="0"
            ></multi-position-button>
            
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

            <div class="app-row">
            <joystick-visualizer id="joystick"></joystick-visualizer>
            </div>
    `;

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


    enableTooltips(container);


    gamepad.setInputMode(true);

    // Set input loop hook to use the analog data
    gamepad.setReportHook((data) => {

        if(data.getUint8(0) != 0xFE) return;

        let offset = 0;
        let base = 15;

        if(selectedAxis==1)
        {
            offset = 4;
        }

        let x = (data.getUint8(offset+base) << 8) | (data.getUint8(1+offset+base));
        let y = 4096 - ( (data.getUint8(2+offset+base) << 8) | (data.getUint8(3+offset+base)) );

        x -= 2048;
        y -= 2048;

        base=23;

        let x_scaled = (data.getUint8(offset+base) << 8) | (data.getUint8(1+offset+base));
        let y_scaled = 4096 - ( (data.getUint8(2+offset+base) << 8) | (data.getUint8(3+offset+base)) );
        x_scaled -= 2048;
        y_scaled -= 2048;

        //analogVisualizer.setAnalogInput(x, y, x_scaled, y_scaled);
    });
}