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
    container.innerHTML = `
            <number-selector 
                label="Brightness" 
                type="integer" 
                min="0" 
                max="100" 
                step="5" 
                default-value="50"
            ></number-selector>

            <h2>Brightness</h2>
    
            <number-selector 
                label="Brightness" 
                type="integer" 
                min="0" 
                max="100" 
                step="5" 
                default-value="50"
            ></number-selector>

            <h2>Mode</h2>
            <multi-position-button 
                id="rgbModeButton" 
                labels="User, Rainbow"
                default-selected="0"
            ></multi-position-button>

            <h2>Colors</h2>
            <group-rgb-picker 
                group-name="A" 
                color="22AA22"
            ></group-rgb-picker>

            <group-rgb-picker 
                group-name="B" 
                color="22AA22"
            ></group-rgb-picker>

            <group-rgb-picker 
                group-name="X" 
                color="22AA22"
            ></group-rgb-picker>

            <angle-selector 
                in-angle="45"
                out-angle="45"
                distance="2048"
            ></angle-selector>

            <remap-selector
                in-value="A",
                out-value="B",
            ></remap-selector>

            <tristate-button 
                id="component-test-tristate"
                off-text="Connect" 
                on-text="Disconnect" 
                off-to-on-transitioning-text="Connecting..." 
                on-to-off-transitioning-text="Disconnecting..."
            ></tristate-button>

            <single-shot-button 
                id="component-test-singleshot" 
                state="ready"
                ready-text="Save" 
                pending-text="Saving..."
            ></single-shot-button>
    `;
}