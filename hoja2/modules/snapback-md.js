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

// Grab all the current config option values
// and write them to our controller memory
async function writeAngleMemBlock() {

    await gamepad.sendBlock(analogCfgBlockNumber);
}

// Render the analog settings page
export function render(container) {
    let snapbackIdxLeft = gamepad.analog_cfg.l_snapback_type;
    let snapbackIdxRight = gamepad.analog_cfg.r_snapback_type;

    snapbackIdxLeft = 2;

    let snapbackCutoffLeft  = (gamepad.analog_cfg.l_snapback_intensity / 10);
    let snapbackCutoffRight = (gamepad.analog_cfg.r_snapback_intensity / 10);

    container.innerHTML = `
            <h3>Left Stick</h3>
            <multi-position-button 
                width="300"
                id="snapback-mode-selector-left" 
                options="LPF, Auto, Off"
                selected="${snapbackIdxLeft}"
            ></multi-position-button>

            <p>Cutoff Frequency Hz</p>
            <number-selector 
                
                id="snapback-cutoff-left" 
                type="float" 
                min="30.0" 
                max="150.0" 
                step="0.5" 
                value="${snapbackCutoffLeft}"
            ></number-selector>

            <h3>Right Stick</h3>
            <multi-position-button 
                width="300"
                id="snapback-mode-selector-right" 
                options="LPF, Auto, Off"
                selected="${snapbackIdxRight}"
            ></multi-position-button>

            <p>Cutoff Frequency Hz</p>
            <number-selector 
                id="snapback-cutoff-right" 
                type="float" 
                min="30.0" 
                max="150.0" 
                step="0.5"  
                value="${snapbackCutoffRight}"
            ></number-selector>

            <h3>Analyzer</h3>
            <waveform-display width="450" height="280"></waveform-display>
    `;

    enableTooltips(container);

    // Set our snapback mode selectors
    const snapbackModeSelectorLeft = container.querySelector('#snapback-mode-selector-left');
    const snapbackModeSelectorRight = container.querySelector('#snapback-mode-selector-right');

    snapbackModeSelectorLeft.addEventListener('change', (event) => {
        const snapbackType = event.detail.selectedIndex;
        gamepad.analog_cfg.l_snapback_type = snapbackType;
        writeAngleMemBlock();
    });

    snapbackModeSelectorRight.addEventListener('change', (event) => {
        const snapbackType = event.detail.selectedIndex;
        gamepad.analog_cfg.r_snapback_type = snapbackType;
        writeAngleMemBlock();
    });

    // Set our snapback cutoff selectors
    const snapbackCutoffLeftSlider = container.querySelector('#snapback-cutoff-left');
    const snapbackCutoffRightSlider = container.querySelector('#snapback-cutoff-right');

    snapbackCutoffLeftSlider.addEventListener('change', (event) => {
        const cutoff = event.detail.value;
        gamepad.analog_cfg.l_snapback_intensity = cutoff * 10;
        writeAngleMemBlock();
    });

    snapbackCutoffRightSlider.addEventListener('change', (event) => {
        const cutoff = event.detail.value;
        gamepad.analog_cfg.r_snapback_intensity = cutoff * 10;
        writeAngleMemBlock();
    });

    // Set our waveform display
    /** @type {WaveformDisplay} */
    const waveformDisplay = container.querySelector('waveform-display');

    gamepad.setSnapbackHook((data) => {
        const buffer = new Uint8Array(data.buffer);
        waveformDisplay.loadData(buffer);
    });
}