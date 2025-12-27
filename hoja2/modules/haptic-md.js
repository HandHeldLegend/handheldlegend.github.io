import HojaGamepad from '../js/gamepad.js';

// Import the number selector (optional, as it's now globally defined)
import NumberSelector from '../components/number-selector.js';
import MultiPositionButton from '../components/multi-position-button.js';

import TristateButton from '../components/tristate-button.js';
import SingleShotButton from '../components/single-shot-button.js';

const hapticCfgBlockNumber = 6;

/** @type {HojaGamepad} */
const gamepad = HojaGamepad.getInstance();

import { enableTooltips } from '../js/tooltips.js';

async function writeHapticMemBlock() {
    await gamepad.sendBlock(hapticCfgBlockNumber);
}

async function testHaptics() {
    // CFG_BLOCK_HAPTIC=5 HAPTIC_CMD_TEST_STRENGTH=1
    let {status, data} = await gamepad.sendConfigCommand(hapticCfgBlockNumber, 1, 10000);
    return status;
}

export function render(container) {

    let hapticIntensity = Math.round((gamepad.haptic_cfg.haptic_strength/255) * 100);

    let hapticTriggerBlock = `
    <div class="separator"></div>
    <h2>Haptic Triggers</h2>
    <multi-position-button 
        width="130"
        id="haptic-trigger-mode" 
        options="Off, On"
        selected="${gamepad.haptic_cfg.haptic_triggers}"
    ></multi-position-button>
    `;

    let hapticTriggerEnable = true;

    if(!gamepad.haptic_static.haptic_hd) {
        hapticTriggerBlock = "";
        hapticTriggerEnable = false;
    }

    container.innerHTML = `
        <single-shot-button 
                id="haptic-test-button" 
                state="ready" 
                ready-text="Test Feedback" 
                disabled-text="Test"
                pending-text="Testing..."
                success-text="Complete!"
                failure-text="Failure..."
        ></single-shot-button>

        <h2>Intensity</h2>
        <number-selector 
            id="haptic-intensity-selector"
            type="integer" 
            min="0" 
            max="100" 
            step="1" 
            value="${hapticIntensity}"
        ></number-selector>
        
        ${hapticTriggerBlock}
    `;

    /** @type {SingleShotButton} */
    const testButton = container.querySelector('single-shot-button[id="haptic-test-button"]');
    testButton.setOnClick(testHaptics);

    /** @type {NumberSelector} */
    const intensitySelector = container.querySelector('number-selector[id="haptic-intensity-selector"]');
    intensitySelector.addEventListener('change', async (e) => {
        let newVal = (e.detail.value/100) * 255;
        newVal = newVal > 255 ? 255 : newVal < 0 ? 0 : newVal;
        gamepad.haptic_cfg.haptic_strength = Math.round(newVal);
        console.log("New strength: " + gamepad.haptic_cfg.haptic_strength);
        await writeHapticMemBlock();
    });

    if(hapticTriggerEnable) {
        /** @type {MultiPositionButton} */
        const hapticTriggerSelector = container.querySelector('multi-position-button[id="haptic-trigger-mode"]');
        hapticTriggerSelector.addEventListener('change', async (e) => {
            console.log("Haptic trigger mode change");
            gamepad.haptic_cfg.haptic_triggers = e.detail.selectedIndex;
            await writeHapticMemBlock();
    });
    }
}