class NumberSelector extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    // Default configuration if not specified
    static get defaultConfig() {
        return {
            type: 'integer',  // 'integer' or 'float'
            min: 0,
            max: 100,
            step: 1,
            defaultValue: 50,
            formatter: (value) => value.toString()
        };
    }

    // Observed attributes for configuration
    static get observedAttributes() {
        return [
            'type', 
            'min', 
            'max', 
            'step', 
            'default-value',
            'label'
        ];
    }

    async connectedCallback() {
         // Load the component-specific CSS
         const csstext = await fetch('./components/number-selector.css');
         const css = await csstext.text();

         // Render the component with loaded CSS
         this.render(css);
         this.setupEventListeners();
    }

    // Parse configuration from attributes
    getConfig() {
        return {
            type: this.getAttribute('type') || NumberSelector.defaultConfig.type,
            min: parseFloat(this.getAttribute('min') ?? NumberSelector.defaultConfig.min),
            max: parseFloat(this.getAttribute('max') ?? NumberSelector.defaultConfig.max),
            step: parseFloat(this.getAttribute('step') ?? NumberSelector.defaultConfig.step),
            defaultValue: parseFloat(this.getAttribute('default-value') ?? NumberSelector.defaultConfig.defaultValue),
            label: this.getAttribute('label') || ''
        };
    }

    render(css) {
        const config = this.getConfig();

        this.shadowRoot.innerHTML = `
            <style>${css}</style>
            ${config.label ? `<div class="label">${config.label}</div>` : ''}
            <div class="number-selector">
                <button orientation="left" class="btn-control btn-decrease"><</button>
                <div class="slider-container">
                    <input 
                        type="range" 
                        class="slider" 
                        min="${config.min}" 
                        max="${config.max}" 
                        value="${config.defaultValue}"
                        step="${config.step}"
                    >
                </div>
                <div class="value-display">${config.defaultValue}</div>
                <button orientation="right" class="btn-control btn-increase">></button>
            </div>
        `;
    }

    setupEventListeners() {
        const config = this.getConfig();
        const slider = this.shadowRoot.querySelector('.slider');
        const valueDisplay = this.shadowRoot.querySelector('.value-display');
        const btnDecrease = this.shadowRoot.querySelector('.btn-decrease');
        const btnIncrease = this.shadowRoot.querySelector('.btn-increase');

        // Slider change
        slider.addEventListener('input', (e) => {
            let value = parseFloat(e.target.value);
            
            // Handle float vs integer
            if (config.type === 'integer') {
                value = Math.round(value);
                e.target.value = value;
            }
            
            valueDisplay.textContent = value.toFixed(config.type === 'float' ? 2 : 0);
            this.dispatchEvent(new CustomEvent('change', { 
                detail: { value }
            }));
        });

        // Decrease button
        btnDecrease.addEventListener('click', () => {
            let currentValue = parseFloat(slider.value);
            let newValue = Math.max(config.min, currentValue - config.step);
            
            slider.value = newValue;
            slider.dispatchEvent(new Event('input'));
        });

        // Increase button
        btnIncrease.addEventListener('click', () => {
            let currentValue = parseFloat(slider.value);
            let newValue = Math.min(config.max, currentValue + config.step);
            
            slider.value = newValue;
            slider.dispatchEvent(new Event('input'));
        });
    }
}

// Define the custom element
customElements.define('number-selector', NumberSelector);

export default NumberSelector;