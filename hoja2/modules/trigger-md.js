// Import the number selector (optional, as it's now globally defined)
import NumberSelector from '../components/number-selector.js';
import MultiPositionButton from '../components/multi-position-button.js';
import GroupRgbPicker from '../components/group-rgb-picker.js';
import AngleSelector from '../components/angle-selector.js';
import RemapSelector from '../components/remap-selector.js';

import TristateButton from '../components/tristate-button.js';
import SingleShotButton from '../components/single-shot-button.js';

import { enableTooltips } from '../tooltips.js';

export function render(container) {

    let gamecubeEnabled = true;
    let analogTriggersEnabled = true;


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

        <single-shot-button 
            tooltip="Reset all trigger settings to default."
            id="trigger-default-btn" 
            state="ready"
            ready-text="Reset" 
            pending-text="Resetting..."
        ></single-shot-button>
    </div>
    `
    if(!analogTriggersEnabled) enabledOnlyAnalogSectionHTML = "";

    let leftAnalogSectionHTML = `
    <h3 class="header-detailed">Analog Mode<div class="header-tooltip" tooltip="Which analog mode the left trigger will use.">?</div></h3>
    <multi-position-button 
        id="l-trigger-mode" 
        labels="Analog, Disabled"
        default-selected="0"
    ></multi-position-button>

    <h3>Digital Threshold<div class="header-tooltip" tooltip="The analog value which will trigger the equivalent digital press and full analog output. Setting to 0 disables this feature.">?</div></h3>
    <number-selector 
        id="l-hairtrigger-number"
        type="integer" 
        min="0" 
        max="255" 
        step="1" 
        default-value="50"
    ></number-selector>

    <h3>Deadzone<div class="header-tooltip" tooltip="Analog levels below this value will be zero.">?</div></h3>
    <number-selector 
        id="l-deadzone-number"
        type="integer" 
        min="0" 
        max="255" 
        step="1" 
        default-value="50"
    ></number-selector>
    `;
    if(!analogTriggersEnabled) leftAnalogSectionHTML = "";

    let leftAnalogSectionGameCubeHTML = `
    <h3>Split Press Value<div class="header-tooltip" tooltip="The analog value which will be used for split modes (GameCube Only).">?</div></h3>
    <number-selector 
        id="l-static-number"
        type="integer" 
        min="0" 
        max="255" 
        step="1" 
        default-value="50"
    ></number-selector>
    `;
    if(!gamecubeEnabled) leftAnalogSectionGameCubeHTML = "";

    let rightAnalogSectionHTML = `
    <h3 class="header-detailed">Analog Mode<div class="header-tooltip" tooltip="Which analog mode the right trigger will use.">?</div></h3>
    <multi-position-button 
        id="r-trigger-mode" 
        labels="Analog, Disabled"
        default-selected="0"
    ></multi-position-button>

    <h3>Digital Threshold<div class="header-tooltip" tooltip="The analog value which will trigger the equivalent digital press and full analog output. Setting to 0 disables this feature.">?</div></h3>
    <number-selector 
        id="r-hairtrigger-number"
        type="integer" 
        min="0" 
        max="255" 
        step="1" 
        default-value="50"
    ></number-selector>

    <h3>Deadzone<div class="header-tooltip" tooltip="Analog levels below this value will be zero.">?</div></h3>
    <number-selector 
        id="r-deadzone-number"
        type="integer" 
        min="0" 
        max="255" 
        step="1" 
        default-value="50"
    ></number-selector>
    `;
    if(!analogTriggersEnabled) rightAnalogSectionHTML = "";

    let rightAnalogSectionGameCubeHTML = `
    <h3>Split Press Value<div class="header-tooltip" tooltip="The analog value which will be used for split modes (GameCube Only).">?</div></h3>
    <number-selector 
        id="r-static-number"
        type="integer" 
        min="0" 
        max="255" 
        step="1" 
        default-value="50"
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
        default-selected="0"
    ></multi-position-button>
    `;
    if(!gamecubeEnabled) gameCubeOnlySectionHTML = "";

    container.innerHTML = `
            <h1>Trigger Settings</h1>

            ${enabledOnlyAnalogSectionHTML}
            
            <h2 title="Test">Left Trigger</h2>

            ${leftAnalogSectionHTML}
            ${leftAnalogSectionGameCubeHTML}

            <h2 title="Test">Right Trigger</h2>
            ${rightAnalogSectionHTML}
            ${rightAnalogSectionGameCubeHTML}

            ${gameCubeOnlySectionHTML}
    `;

    enableTooltips(container);
}