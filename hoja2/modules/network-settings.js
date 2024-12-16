// Import the number selector (optional, as it's now globally defined)
import NumberSelector from '../components/number-selector.js';

export function render(container) {
    container.innerHTML = `
        <h1>Display Settings</h1>
        <number-selector 
            label="Brightness" 
            type="integer" 
            min="0" 
            max="100" 
            step="5" 
            default-value="50"
        ></number-selector>
        
        <number_selector 
            label="Volume" 
            type="integer" 
            min="0" 
            max="20" 
            step="1" 
            default-value="10"
        ></number_selector>
        
        <number-selector 
            label="Color Temperature" 
            type="float" 
            min="2700" 
            max="6500" 
            step="100" 
            default-value="4000"
        ></number-selector>
    `;

    // Optional: Add event listeners to specific number selectors
    const brightnessSelector = container.querySelector('number-selector[label="Brightness"]');
    brightnessSelector.addEventListener('change', (e) => {
        console.log(`Brightness changed to: ${e.detail.value}`);
    });
}