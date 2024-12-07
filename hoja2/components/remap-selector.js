import { enableTooltips } from "../tooltips.js";

class RemapSelector extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    static get observedAttributes() {
        return ['in-value', 'out-value'];
    }

    async connectedCallback() {
        // Load the component-specific CSS
        const csstext = await fetch('./components/remap-selector.css');
        const css = await csstext.text();
        this.render(css);
        this.setupEventListeners();

        enableTooltips(this.shadowRoot);
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'in-value' && oldValue !== newValue) {
            this.updateInValue(newValue);
        } else if (name === 'out-value' && oldValue !== newValue) {
            this.updateOutValue(newValue);
        }
    }

    // Render the component
    render(css) {
        const inValue = this.getAttribute('in-value') || "A";
        const outValue = this.getAttribute('out-value') || "A";

        this.shadowRoot.innerHTML = `
            <style>${css}</style>
                <button class="button-capture" tooltip="Listen for input">⤓</button>

                <div class="even-container">
                    <span class="label">in:</span>
                    <input tooltip="Input button" type="text" class="value-in" value="${inValue}" readonly />

                    <span class="label">out:</span>
                    <input tooltip="Output button" type="text" class="value-out" value="${outValue}" readonly />
                </div>

                <button class="button-clear" tooltip="Disable button">✖</button>
                <button class="button-reset" tooltip="Reset mapping">↺</button>
        `;
    }

    // Synchronize input changes with attribute updates
    setupEventListeners() {
        const buttonClear = this.shadowRoot.querySelector('.button-clear');
        const buttonReset = this.shadowRoot.querySelector('.button-reset');
        const buttonCapture = this.shadowRoot.querySelector('.button-capture');

        // Handle button clicks
        buttonClear.addEventListener('click', () => {
            this.clearValues();
            this.emitChangeEvent('clear');
        });

        buttonReset.addEventListener('click', () => {
            this.resetValues();
            this.emitChangeEvent('reset');
        });

        buttonCapture.addEventListener('click', () => {
            this.captureValue();
            this.emitChangeEvent('capture');
        });
    }

    // Update the 'in' value dynamically
    updateInValue(value) {
        const inValueInput = this.shadowRoot.querySelector('.value-in');
        if (inValueInput) {
            inValueInput.value = value;
        }
    }

    // Update the 'out' value dynamically
    updateOutValue(value) {
        const outValueInput = this.shadowRoot.querySelector('.value-out');
        if (outValueInput) {
            outValueInput.value = value;
        }
    }

    // Clear values programmatically
    clearValues() {
        this.setAttribute('in-value', "0");
        this.setAttribute('out-value', "0");
    }

    // Reset values programmatically
    resetValues() {
        console.log("Reset button clicked");
        // Add custom logic for resetting values if needed
    }

    // Capture value programmatically
    captureValue() {
        console.log("Capture button clicked");
        // Add custom logic for capturing values if needed
    }

    // Emit a change event when a button is pressed
    emitChangeEvent(action) {
        this.dispatchEvent(new CustomEvent('remap-change', {
            detail: {
                action: action,
                inValue: this.getAttribute('in-value'),
                outValue: this.getAttribute('out-value')
            }
        }));
    }

    // Set the 'in' value programmatically
    setInValue(value) {
        this.setAttribute('in-value', value);
    }

    // Set the 'out' value programmatically
    setOutValue(value) {
        this.setAttribute('out-value', value);
    }
}

// Define the custom element
customElements.define('remap-selector', RemapSelector);

export default RemapSelector;
