class InputMappingDisplay extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });

        // Component state
        this._inputLabel = 'A';
        this._outputLabel = 'A';
        this._inputIcon = null; // URL to icon image
        this._outputIcon = null; // URL to icon image
        this._value = 0; // 0-255
        this._pressed = false;
        this._onClick = null;
    }

    static get observedAttributes() {
        return ['input-label', 'output-label', 'input-icon', 'output-icon', 'value', 'pressed'];
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
                this.updateInputDisplay();
                break;
            case 'output-label':
                this._outputLabel = newValue || 'A';
                this.updateOutputDisplay();
                break;
            case 'input-icon':
                this._inputIcon = newValue || null;
                this.updateInputDisplay();
                break;
            case 'output-icon':
                this._outputIcon = newValue || null;
                this.updateOutputDisplay();
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
                    <div class="input-circle ${this._inputIcon ? 'has-icon' : ''}">
                        ${this._inputIcon ? `<img src="${this._inputIcon}" class="input-icon" alt="${this._inputLabel}">` : ''}
                        <span class="input-text">${this._inputLabel}</span>
                    </div>
                    <div class="arrow">→</div>
                    <div class="output-square ${this._outputIcon ? 'has-icon' : ''}">
                        ${this._outputIcon ? `<img src="${this._outputIcon}" class="output-icon" alt="${this._outputLabel}">` : ''}
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
                    inputIcon: this._inputIcon,
                    outputIcon: this._outputIcon,
                    value: this._value,
                    pressed: this._pressed
                });
            }
        });
    }

    updateInputDisplay() {
        const circle = this.shadowRoot.querySelector('.input-circle');
        const inputText = this.shadowRoot.querySelector('.input-text');
        const inputIcon = this.shadowRoot.querySelector('.input-icon');
        
        if (circle && inputText) {
            if (this._inputIcon) {
                circle.classList.add('has-icon');
                if (inputIcon) {
                    inputIcon.src = this._inputIcon;
                } else {
                    // Re-render if icon element doesn't exist
                    this.refreshRender();
                }
            } else {
                circle.classList.remove('has-icon');
                inputText.textContent = this._inputLabel;
            }
        }
    }

    updateOutputDisplay() {
        const square = this.shadowRoot.querySelector('.output-square');
        const outputText = this.shadowRoot.querySelector('.output-text');
        const outputIcon = this.shadowRoot.querySelector('.output-icon');
        
        if (square && outputText) {
            if (this._outputIcon) {
                square.classList.add('has-icon');
                if (outputIcon) {
                    outputIcon.src = this._outputIcon;
                } else {
                    // Re-render if icon element doesn't exist
                    this.refreshRender();
                }
            } else {
                square.classList.remove('has-icon');
                outputText.textContent = this._outputLabel;
            }
        }
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

    async refreshRender() {
        const csstext = await fetch('./components/input-mapping-display.css');
        const css = await csstext.text();
        const modulecss = await fetch('./css/modules.css');
        const moduleStyles = await modulecss.text();
        const combined = css + moduleStyles;
        this.render(combined);
        this.setupEventListeners();
    }

    // Public API methods
    // Public API methods
    setInputLabel(label) {
        this._inputLabel = label;
        this.setAttribute('input-label', label);
    }

    setOutputLabel(label) {
        this._outputLabel = label;
        this.setAttribute('output-label', label);
    }

    setInputIcon(iconUrl) {
        this._inputIcon = iconUrl;
        if (iconUrl) {
            this.setAttribute('input-icon', iconUrl);
        } else {
            this.removeAttribute('input-icon');
        }
    }

    setOutputIcon(iconUrl) {
        this._outputIcon = iconUrl;
        if (iconUrl) {
            this.setAttribute('output-icon', iconUrl);
        } else {
            this.removeAttribute('output-icon');
        }
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
        if (config.inputIcon !== undefined) this.setInputIcon(config.inputIcon);
        if (config.outputIcon !== undefined) this.setOutputIcon(config.outputIcon);
        if (config.value !== undefined) this.setValue(config.value);
        if (config.pressed !== undefined) this.setPressed(config.pressed);
    }
}

// Define the custom element
customElements.define('input-mapping-display', InputMappingDisplay);

export default InputMappingDisplay;