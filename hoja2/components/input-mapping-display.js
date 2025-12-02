class InputMappingDisplay extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });

        // Component state
        this._inputLabel = 'A';
        this._outputLabel = 'A';
        this._value = 0; // 0-255
        this._pressed = false;
        this._onClick = null;
    }

    static get observedAttributes() {
        return ['input-label', 'output-label', 'value', 'pressed'];
    }

    async connectedCallback() {
        // Load the component-specific CSS
        const csstext = await fetch('./components/input-mapping-display.css');
        const css = await csstext.text();

        const modulecss = await fetch('./css/modules.css');
        const moduleStyles = await modulecss.text();

        const combined = css + moduleStyles;
        this.render(combined);
        this.setupEventListeners();
    }

    attributeChangedCallback(name, oldValue, newValue) {
        switch(name) {
            case 'input-label':
                this._inputLabel = newValue || 'A';
                this.updateInputLabel();
                break;
            case 'output-label':
                this._outputLabel = newValue || 'A';
                this.updateOutputLabel();
                break;
            case 'value':
                this._value = Math.max(0, Math.min(255, parseInt(newValue) || 0));
                this.updateValueBar();
                break;
            case 'pressed':
                this._pressed = newValue === 'true' || newValue === '';
                this.updatePressState();
                break;
        }
    }

    render(css) {
        const valuePercent = (this._value / 255) * 80;
        
        this.shadowRoot.innerHTML = `
            <style>${css}</style>
            <div class="input-mapping-container hoverable clickable">
                <div class="mapping-header">
                    <div class="input-circle">
                        <span class="input-text">${this._inputLabel}</span>
                    </div>
                    <div class="arrow">→</div>
                    <div class="output-square">
                        <span class="output-text">${this._outputLabel}</span>
                    </div>
                </div>
                <div class="value-bar-container">
                    <div class="value-bar">
                        <div class="value-indicator ${this._pressed ? 'pressed' : ''}" style="left: ${valuePercent+10}%"></div>
                    </div>
                </div>
            </div>
        `;
    }

    setupEventListeners() {
        const container = this.shadowRoot.querySelector('.input-mapping-container');
        
        container.addEventListener('click', () => {
            if (this._onClick) {
                this._onClick({
                    inputLabel: this._inputLabel,
                    outputLabel: this._outputLabel,
                    value: this._value,
                    pressed: this._pressed
                });
            }
        });
    }

    updateInputLabel() {
        const inputText = this.shadowRoot.querySelector('.input-text');
        if (inputText) {
            inputText.textContent = this._inputLabel;
        }
    }

    updateOutputLabel() {
        const outputText = this.shadowRoot.querySelector('.output-text');
        if (outputText) {
            outputText.textContent = this._outputLabel;
        }
    }

    updateValueBar() {
        const indicator = this.shadowRoot.querySelector('.value-indicator');
        if (indicator) {
            const valuePercent = (this._value / 255) * 80;
            indicator.style.left = `${valuePercent+10}%`;
        }
    }

    updatePressState() {
        const indicator = this.shadowRoot.querySelector('.value-indicator');
        if (indicator) {
            if (this._pressed) {
                indicator.classList.add('pressed');
            } else {
                indicator.classList.remove('pressed');
            }
        }
    }

    // Public API methods
    setInputLabel(label) {
        this._inputLabel = label;
        this.setAttribute('input-label', label);
    }

    setOutputLabel(label) {
        this._outputLabel = label;
        this.setAttribute('output-label', label);
    }

    setValue(value) {
        this._value = Math.max(0, Math.min(255, value));
        this.setAttribute('value', this._value.toString());
    }

    setPressed(pressed) {
        this._pressed = pressed;
        this.setAttribute('pressed', pressed.toString());
    }

    setOnClick(handler) {
        this._onClick = handler;
    }

    // Convenience method to update all values at once
    updateMapping(config) {
        if (config.inputLabel !== undefined) this.setInputLabel(config.inputLabel);
        if (config.outputLabel !== undefined) this.setOutputLabel(config.outputLabel);
        if (config.value !== undefined) this.setValue(config.value);
        if (config.pressed !== undefined) this.setPressed(config.pressed);
    }
}

// Define the custom element
customElements.define('input-mapping-display', InputMappingDisplay);

export default InputMappingDisplay;