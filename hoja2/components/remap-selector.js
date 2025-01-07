import { enableTooltips } from "../tooltips.js";

class RemapSelector extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });

        this._pressed = false;
        this._inputContainer = null;
    }

    static get observedAttributes() {
        return ['in-value', 'out-value', 'idx'];
    }

    async connectedCallback() {
        // Load the component-specific CSS
        const csstext = await fetch('./components/remap-selector.css');
        const cssHostResponse = await fetch('./components/host-template.css');
        const cssHost = await cssHostResponse.text();
        const css = cssHost + await csstext.text();
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
        const idxValue = this.getAttribute('idx') || "0";

        this.shadowRoot.innerHTML = `
            <style>${css}</style>
            <button idx="${idxValue}" class="button-capture" tooltip="Listen for input (Press button to assign).">⤓</button>

            <div class="even-container">
                <span class="label">in:</span>
                <input tooltip="Input button" type="text" class="value-in" value="${inValue}" readonly />

                <span class="label">out:</span>
                <input tooltip="Output button" type="text" class="value-out" value="${outValue}" readonly />
            </div>
            <button class="button-clear" tooltip="Disable button">✖</button>

        `;

        // Remove reset button for now
        // <button class="button-reset" tooltip="Reset mapping">↺</button>

        this._inputContainer = this.shadowRoot.querySelector('div[class="even-container"');
    }

    // Synchronize input changes with attribute updates
    setupEventListeners() {
        const buttonClear = this.shadowRoot.querySelector('.button-clear');
        //const buttonReset = this.shadowRoot.querySelector('.button-reset');
        const buttonCapture = this.shadowRoot.querySelector('.button-capture');

        // Handle button clicks
        buttonClear.addEventListener('click', () => {
            this.emitChangeEvent('clear');
        });

        //buttonReset.addEventListener('click', () => {
        //    this.resetValues();
        //    this.emitChangeEvent('reset');
        //});

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

    // Reset values programmatically
    //resetValues() {
    //    console.log("Reset button clicked");
    //    // Add custom logic for resetting values if needed
    //}

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

    setPressed(pressed) {
        if(pressed && !this._pressed) {
            this._inputContainer.setAttribute('pressed', 'true');
            this._pressed = true;
        }
        else if (!pressed && this._pressed) {
            this._inputContainer.setAttribute('pressed', 'false');
            this._pressed = false;
        }
        
    }

    // Set the 'out' value programmatically
    setOutValue(value) {
        this.setAttribute('out-value', value);
    }

    disableCaptureButton(listening) {
        let btn = this.shadowRoot.querySelector('button[class="button-capture"]');
        btn.setAttribute('disabled', 'true');

        if(listening) btn.textContent = `⧗`;
        else btn.textContent = `⊘`;

        let btn2 = this.shadowRoot.querySelector('button[class="button-clear"]');
        btn2.setAttribute('disabled', 'true');
    }

    enableCaptureButton() {
        let btn = this.shadowRoot.querySelector('button[class="button-capture"]');
        let btn2 = this.shadowRoot.querySelector('button[class="button-clear"]');

        try {
            btn.removeAttribute('disabled');
            btn2.removeAttribute('disabled');
        }
        catch(err) {}

        btn.textContent = `⤓`;
    }
}

// Define the custom element
customElements.define('remap-selector', RemapSelector);

export default RemapSelector;
