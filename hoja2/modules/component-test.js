// Import the number selector (optional, as it's now globally defined)
import NumberSelector from '../components/number-selector.js';
import MultiPositionButton from '../components/multiposition-button.js';
import GroupRgbPicker from '../components/group-rgb-picker.js';
import AngleSelector from '../components/angle-selector.js';

import { globalState } from '../app.js';

export function render(container) {
    container.innerHTML = `
        <h1>Display Settings</h1>
        <div class="display-settings">
            <number-selector 
                label="Brightness" 
                type="integer" 
                min="0" 
                max="100" 
                step="5" 
                default-value="50"
            ></number-selector>

            <number-selector 
                type="integer" 
                min="0" 
                max="100" 
                step="5" 
                default-value="50"
            ></number-selector>

            <number-selector 
                label="Brightness" 
                type="integer" 
                min="0" 
                max="100" 
                step="5" 
                default-value="50"
            ></number-selector>

            <multi-position-button 
                label="Gamepad Mode" 
                labels="Option 1, Option 2, Option 3"
                default-selected="0"
            ></multi-position-button>

            <multi-position-button 
                labels="Option 1, Option 2, Option 3"
                default-selected="0"
            ></multi-position-button>

            <group-rgb-picker 
                group-name="Test" 
                color="ff5733"
            ></group-rgb-picker>

            <angle-selector 
                in-angle:"45"
                out-angle:"45"
                distance:"2048"
            ></angle-selector>

        </div>
    `;

    // Optional: Add event listeners to specific number selectors
    const brightnessSelector = container.querySelector('number-selector[label="Brightness"]');
    brightnessSelector.addEventListener('change', (e) => {
        console.log(`Brightness changed to: ${e.detail.value}`);
    });

    const gamepadModeSelector = container.querySelector('multi-position-button[label="Gamepad Mode"]');

    gamepadModeSelector.setState(globalState.gamepadMode);
}