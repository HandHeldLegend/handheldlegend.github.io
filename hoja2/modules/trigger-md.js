import HojaGamepad from '../gamepad/gamepad.js';

import NumberSelector from '../components/number-selector.js';
import MultiPositionButton from '../components/multi-position-button.js';
import GroupRgbPicker from '../components/group-rgb-picker.js';
import AngleSelector from '../components/angle-selector.js';
import RemapSelector from '../components/remap-selector.js';

import DualAnalogTrigger from '../components/dual-analog-trigger.js';

import TristateButton from '../components/tristate-button.js';
import SingleShotButton from '../components/single-shot-button.js';

import { enableTooltips } from '../tooltips.js';

/** @type {HojaGamepad} */
const gamepad = HojaGamepad.getInstance();

const triggerCfgBlockNumber = 4;

/** @type {DualAnalogTrigger} */
let analogTriggerBar = null;

function triggerReportHook(data) {
    const lt = data.getUint8(12) << 8 | data.getUint8(13);
    const rt = data.getUint8(14) << 8 | data.getUint8(15);

    if(analogTriggerBar) {
        analogTriggerBar.setValues(lt, rt);
    }
}

async function writeTriggerMemBlock() {
    await gamepad.sendBlock(triggerCfgBlockNumber);
}

export function render(container) {

    let gamecubeEnabled = gamepad.device_static.joybus_supported;
    let analogTriggersEnabled = (gamepad.analog_static.axis_lt | gamepad.analog_static.axis_rt);

    /*
    <single-shot-button 
        tooltip="Reset all trigger settings to default."
        id="trigger-default-btn" 
        state="ready"
        ready-text="Reset" 
        pending-text="Resetting..."
    ></single-shot-button>
    */

    let enabledOnlyAnalogSectionHTML = `
    <div class="app-row">
        <tristate-button 
            tooltip="Start/Stop analog trigger calibration."
            id="trigger-calibrate-btn"
            off-text="Calibrate" 
            on-text="Stop" 
            off-to-on-transitioning-text="Calibrate" 
            on-to-off-transitioning-text="Stop"
        ></tristate-button>
    </div>
    <dual-analog-trigger></dual-analog-trigger>
    `
    if(!analogTriggersEnabled) enabledOnlyAnalogSectionHTML = "";

    let leftAnalogSectionHTML = `
    <h3 class="header-detailed">Analog Mode<div class="header-tooltip" tooltip="Which analog mode the left trigger will use.">?</div></h3>
    <multi-position-button 
        id="l-trigger-mode" 
        labels="Analog, Disabled"
        default-selected="${gamepad.trigger_cfg.left_disabled}"
    ></multi-position-button>

    <h3>Digital Threshold<div class="header-tooltip" tooltip="The analog value which will trigger the equivalent digital press and full analog output. Setting to 0 disables this feature.">?</div></h3>
    <number-selector 
        id="l-hairtrigger-number"
        type="integer" 
        min="0" 
        max="4096" 
        step="128" 
        default-value="${gamepad.trigger_cfg.left_hairpin_value}"
    ></number-selector>

    <h3>Deadzone<div class="header-tooltip" tooltip="Analog levels below this value will be zero.">?</div></h3>
    <number-selector 
        id="l-deadzone-number"
        type="integer" 
        min="0" 
        max="2560" 
        step="128" 
        default-value="${gamepad.trigger_cfg.left_deadzone}"
    ></number-selector>
    `;
    if(!analogTriggersEnabled) leftAnalogSectionHTML = "";

    let leftAnalogSectionGameCubeHTML = `
    <h3>Split Press Value<div class="header-tooltip" tooltip="The analog value which will be used for split modes (GameCube Only).">?</div></h3>
    <number-selector 
        id="l-static-number"
        type="integer" 
        min="0" 
        max="4096" 
        step="128" 
        default-value="${gamepad.trigger_cfg.left_static_output_value}"
    ></number-selector>
    `;
    if(!gamecubeEnabled) leftAnalogSectionGameCubeHTML = "";

    let rightAnalogSectionHTML = `
    <h3 class="header-detailed">Analog Mode<div class="header-tooltip" tooltip="Which analog mode the right trigger will use.">?</div></h3>
    <multi-position-button 
        id="r-trigger-mode" 
        labels="Analog, Disabled"
        default-selected="${gamepad.trigger_cfg.right_disabled}"
    ></multi-position-button>

    <h3>Digital Threshold<div class="header-tooltip" tooltip="The analog value which will trigger the equivalent digital press and full analog output. Setting to 0 disables this feature.">?</div></h3>
    <number-selector 
        id="r-hairtrigger-number"
        type="integer" 
        min="0" 
        max="4096" 
        step="128" 
        default-value="${gamepad.trigger_cfg.right_hairpin_value}"
    ></number-selector>

    <h3>Deadzone<div class="header-tooltip" tooltip="Analog levels below this value will be zero.">?</div></h3>
    <number-selector 
        id="r-deadzone-number"
        type="integer" 
        min="0" 
        max="2560" 
        step="128" 
        default-value="${gamepad.trigger_cfg.right_deadzone}"
    ></number-selector>
    `;
    if(!analogTriggersEnabled) rightAnalogSectionHTML = "";

    let rightAnalogSectionGameCubeHTML = `
    <h3>Split Press Value<div class="header-tooltip" tooltip="The analog value which will be used for split modes (GameCube Only).">?</div></h3>
    <number-selector 
        id="r-static-number"
        type="integer" 
        min="0" 
        max="4096" 
        step="128" 
        default-value="${gamepad.trigger_cfg.right_static_output_value}"
    ></number-selector>
    `;
    if(!gamecubeEnabled) rightAnalogSectionGameCubeHTML = "";

    let gameCubeOnlySectionHTML = `
    <h2>GameCube Setting
        <div class="header-tooltip" tooltip="Split modes will bind the 'SP' button to perform a light analog press for a given mode.">?</div>
    </h2>
    <multi-position-button 
        id="gamecube-trigger-mode" 
        labels="Default, L Split, R Split, Dual Z"
        default-selected="${gamepad.trigger_cfg.trigger_mode_gamecube}"
    ></multi-position-button>
    `;
    if(!gamecubeEnabled) gameCubeOnlySectionHTML = "";

    container.innerHTML = `
            ${enabledOnlyAnalogSectionHTML}
            
            <h2 title="Test">Left Trigger</h2>

            ${leftAnalogSectionHTML}
            ${leftAnalogSectionGameCubeHTML}

            <h2 title="Test">Right Trigger</h2>
            ${rightAnalogSectionHTML}
            ${rightAnalogSectionGameCubeHTML}

            ${gameCubeOnlySectionHTML}
    `;

    if(gamecubeEnabled) {
        const rightSplitEl = container.querySelector('number-selector[id="r-static-number"]');
        rightSplitEl.addEventListener('change', (e) => {
            console.log(`Right static/split changed to: ${e.detail.value}`);
            let pinVal = e.detail.value;
            pinVal = (pinVal > 4095) ? 4095 : pinVal;
            pinVal = (pinVal < 0) ? 0 : pinVal;

            gamepad.trigger_cfg.right_static_output_value = pinVal;
    
            writeTriggerMemBlock();
        });

        const leftSplitEl = container.querySelector('number-selector[id="l-static-number"]');
        leftSplitEl.addEventListener('change', (e) => {
            console.log(`Left static/split changed to: ${e.detail.value}`);
            let pinVal = e.detail.value;
            pinVal = (pinVal > 4095) ? 4095 : pinVal;
            pinVal = (pinVal < 0) ? 0 : pinVal;

            gamepad.trigger_cfg.left_static_output_value = pinVal;
    
            writeTriggerMemBlock();
        });

        const gcModeSelector = container.querySelector('multi-position-button[id="gamecube-trigger-mode"]');
        gcModeSelector.addEventListener('change', (e) => {
            console.log("GC trigger mode change");
            gamepad.trigger_cfg.trigger_mode_gamecube = e.detail.selectedIndex;
            writeTriggerMemBlock();
        });
    }

    if(analogTriggersEnabled) {
        analogTriggerBar = container.querySelector('dual-analog-trigger');
        analogTriggerBar.setThresholds(gamepad.trigger_cfg.left_hairpin_value, gamepad.trigger_cfg.right_hairpin_value);
        analogTriggerBar.setValues(0, 0);
        
        const leftHairpinEl = container.querySelector('number-selector[id="l-hairtrigger-number"]');
        leftHairpinEl.addEventListener('change', (e) => {
            console.log(`Left hairpin changed to: ${e.detail.value}`);
            let pinVal = e.detail.value;
            pinVal = (pinVal > 4095) ? 4095 : pinVal;
            pinVal = (pinVal < 0) ? 0 : pinVal;

            gamepad.trigger_cfg.left_hairpin_value = pinVal;

            if(analogTriggerBar) {
                analogTriggerBar.setThresholds(pinVal, null);
            }
    
            writeTriggerMemBlock();
        });

        const rightHairpinEl = container.querySelector('number-selector[id="r-hairtrigger-number"]');
        rightHairpinEl.addEventListener('change', (e) => {
            console.log(`Right hairpin changed to: ${e.detail.value}`);
            let pinVal = e.detail.value;
            pinVal = (pinVal > 4095) ? 4095 : pinVal;
            pinVal = (pinVal < 0) ? 0 : pinVal;

            gamepad.trigger_cfg.right_hairpin_value = pinVal;

            if(analogTriggerBar) {
                analogTriggerBar.setThresholds(null, pinVal);
            }
    
            writeTriggerMemBlock();
        });

        const leftDeadzoneEl = container.querySelector('number-selector[id="l-deadzone-number"]');
        leftDeadzoneEl.addEventListener('change', (e) => {
            console.log(`Left deadzone changed to: ${e.detail.value}`);
            let pinVal = e.detail.value;
            pinVal = (pinVal > 4095) ? 4095 : pinVal;
            pinVal = (pinVal < 0) ? 0 : pinVal;

            gamepad.trigger_cfg.left_deadzone = pinVal;
    
            writeTriggerMemBlock();
        });

        const rightDeadzoneEl = container.querySelector('number-selector[id="r-deadzone-number"]');
        rightDeadzoneEl.addEventListener('change', (e) => {
            console.log(`Right deadzone changed to: ${e.detail.value}`);
            let pinVal = e.detail.value;
            pinVal = (pinVal > 4095) ? 4095 : pinVal;
            pinVal = (pinVal < 0) ? 0 : pinVal;

            gamepad.trigger_cfg.right_deadzone = pinVal;
    
            writeTriggerMemBlock();
        });

        const lDisable = container.querySelector('multi-position-button[id="l-trigger-mode"]');
        lDisable.addEventListener('change', (e) => {
            console.log("L Trigger disable change");
            gamepad.trigger_cfg.left_disabled = e.detail.selectedIndex;
            writeTriggerMemBlock();
        });

        const rDisable = container.querySelector('multi-position-button[id="r-trigger-mode"]');
        rDisable.addEventListener('change', (e) => {
            console.log("R Trigger disable change");
            gamepad.trigger_cfg.right_disabled = e.detail.selectedIndex;
            writeTriggerMemBlock();
        });

        // Set calibration command handlers 
        const calibrateButton = container.querySelector('tristate-button[id="trigger-calibrate-btn"]');

        calibrateButton.setOnHandler(async () => {
            // CFG_BLOCK_TRIGGER, ANALOG_CMD_CALIBRATE_START
            let {status, data} = await gamepad.sendConfigCommand(triggerCfgBlockNumber, 1);
            return status;
        });

        calibrateButton.setOffHandler(async () => {
            // CFG_BLOCK_TRIGGER, ANALOG_CMD_CALIBRATE_STOP
            let {status, data} = await gamepad.sendConfigCommand(triggerCfgBlockNumber, 2);
            // Reload our mem block
            await gamepad.requestBlock(triggerCfgBlockNumber);
            return status;
        });


    }

    gamepad.setReportHook(triggerReportHook);
    
    enableTooltips(container);
}