class NumberSelector extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });

        this._isInternalUpdate = false;
    }

    // Default configuration if not specified
    static get defaultConfig() {
        return {
            type: 'integer', // 'integer' or 'float'
            min: 0,
            max: 100,
            step: 1,
            defaultValue: 0,
            formatter: (value) => value.toString(),
        };
    }

    // Observed attributes for configuration
    static get observedAttributes() {
        return ['width', 'type', 'min', 'max', 'step', 'value', 'label'];
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
            defaultValue: parseFloat(this.getAttribute('value') ?? parseFloat(this.getAttribute('min') ?? NumberSelector.defaultConfig.min)),
            label: this.getAttribute('label') || '',
        };
    }

    render(css) {
        const config = this.getConfig();
        const width = parseInt(this.getAttribute('width') ?? 400);

        this.shadowRoot.innerHTML = `
            <style>${css}</style>
            <div class="num-container" style="width:${width}px;">
            <button orientation="left" class="btn-control btn-decrease">◀</button>
            <div class="slider-container">
                <input 
                    type="range" 
                    class="slider" 
                    min="${config.min}" 
                    max="${config.max}" 
                    value="${config.defaultValue.toFixed(config.type === 'float' ? 1 : 0)}"
                    step="${config.step}"
                >
            </div>
            <div class="value-display">${config.defaultValue.toFixed(config.type === 'float' ? 1 : 0)}</div>
            <button orientation="right" class="btn-control btn-increase">▶</button>
            </div>
        `;
    }

    setupEventListeners() {
        const config = this.getConfig();
        const slider = this.shadowRoot.querySelector('.slider');
        const valueDisplay = this.shadowRoot.querySelector('.value-display');
        const btnDecrease = this.shadowRoot.querySelector('.btn-decrease');
        const btnIncrease = this.shadowRoot.querySelector('.btn-increase');

        slider.addEventListener('keydown', (event) => {
            // Check if the key pressed is an arrow key (up/down or left/right)
            if (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                // Prevent the default action (changing the slider value)
                event.preventDefault();
            }
        });

        // Slider change
        slider.addEventListener('change', (e) => {
            let value = parseFloat(e.target.value);

            // Handle float vs integer
            if (config.type === 'integer') {
                value = Math.round(value);
                e.target.value = value;
            }

            valueDisplay.textContent = value.toFixed(config.type === 'float' ? 1 : 0);

            if(!this._isInternalUpdate)
                this.dispatchEvent(
                    new CustomEvent('change', {
                        detail: { value },
                    })
                );
        });

        // Slider change (TEXT ONLY)
        slider.addEventListener('input', (e) => {
            let value = parseFloat(e.target.value);

            // Handle float vs integer
            if (config.type === 'integer') {
                value = Math.round(value);
                e.target.value = value;
            }

            valueDisplay.textContent = value.toFixed(config.type === 'float' ? 1 : 0);
        });

        // Decrease button
        btnDecrease.addEventListener('click', () => {
            let currentValue = parseFloat(slider.value);
            let newValue = Math.max(config.min, currentValue - config.step);

            slider.value = newValue;
            slider.dispatchEvent(new Event('change'));
        });

        // Increase button
        btnIncrease.addEventListener('click', () => {
            let currentValue = parseFloat(slider.value);
            let newValue = Math.min(config.max, currentValue + config.step);

            slider.value = newValue;
            slider.dispatchEvent(new Event('change'));
        });
    }

    // Get the current state of the selector
    getState() {
        const slider = this.shadowRoot.querySelector('.slider');
        const valueDisplay = this.shadowRoot.querySelector('.value-display');
        const config = this.getConfig();

        return {
            value: parseFloat(slider.value),
            label: config.label,
            type: config.type,
            formattedValue: config.type === 'float'
                ? parseFloat(slider.value).toFixed(1)
                : parseInt(slider.value, 10),
        };
    }

    // Set the state of the selector
    setState(value) {
        this._isInternalUpdate = true;
        const slider = this.shadowRoot.querySelector('.slider');
        const valueDisplay = this.shadowRoot.querySelector('.value-display');
        const config = this.getConfig();

        // Ensure the value is within bounds
        const clampedValue = Math.min(config.max, Math.max(config.min, value));

        // Update the slider and display
        slider.value = clampedValue;
        valueDisplay.textContent = clampedValue.toFixed(config.type === 'float' ? 1 : 0);
        this._isInternalUpdate = false;
    }
}

// Define the custom element
customElements.define('number-selector', NumberSelector);

export default NumberSelector;
