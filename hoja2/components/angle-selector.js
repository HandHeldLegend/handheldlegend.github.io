import { enableTooltips } from "../tooltips.js";

class AngleSelector extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    static get observedAttributes() {
        return ['in-angle', 'out-angle', 'distance'];
    }

    async connectedCallback() {
        // Load the component-specific CSS
        const csstext = await fetch('./components/angle-selector.css');
        const css = await csstext.text();
        this.render(css);
        this.setupEventListeners();

        enableTooltips(this.shadowRoot);
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'in-angle' && oldValue !== newValue) {
            this.updateInAngle(newValue);
        } else if (name === 'out-angle' && oldValue !== newValue) {
            this.updateOutAngle(newValue);
        } else if (name === 'distance' && oldValue !== newValue) {
            this.updateDistance(newValue);
        }
    }

    // Render the component
    render(css) {
        const inAngle = this.getAttribute('in-angle') || '0';
        const outAngle = this.getAttribute('out-angle') || '0';
        const distance = this.getAttribute('distance') || '0';

        this.shadowRoot.innerHTML = `
            <style>${css}</style>
            <div class="angle-selector">
                <button class="button-x" tooltip="Reset angle">↺</button>
                <button class="button-down" tooltip="Capture angle">⤓</button>

                <div class="even-container">
                <span class="label">in:</span>
                <input tooltip="Input angle" type="number" class="angle-in" value="${inAngle}" min="0" max="360" step="any"/>
                </div>

                <div class="even-container">
                <span class="label">out:</span>
                <input tooltip="Output angle" type="number" class="angle-out" value="${outAngle}" min="0" max="360" step="any"/>
                </div>

                <div class="even-container">
                <span class="label">dist:</span>
                <input tooltip="Output distance" type="number" class="distance" value="${distance}" min="0" max="4096" step="1"/>
                </div>
            </div>
        `;
    }

    // Synchronize input changes with attribute updates
    setupEventListeners() {
        const inAngleInput = this.shadowRoot.querySelector('.angle-in');
        const outAngleInput = this.shadowRoot.querySelector('.angle-out');
        const distanceInput = this.shadowRoot.querySelector('.distance');
        const buttonX = this.shadowRoot.querySelector('.button-x');
        const buttonDown = this.shadowRoot.querySelector('.button-down');

        // Update 'in' angle when input changes
        inAngleInput.addEventListener('input', (event) => {
            const value = parseFloat(event.target.value);
            if (value >= 0 && value <= 360) {
                this.setAttribute('in-angle', value);
                this.emitChangeEvent();
            }
        });

        // Update 'out' angle when input changes
        outAngleInput.addEventListener('input', (event) => {
            const value = parseFloat(event.target.value);
            if (value >= 0 && value <= 360) {
                this.setAttribute('out-angle', value);
                this.emitChangeEvent();
            }
        });

        // Update distance when input changes
        distanceInput.addEventListener('input', (event) => {
            const value = parseInt(event.target.value, 10);
            if (value >= 0 && value <= 4096) {
                this.setAttribute('distance', value);
                this.emitChangeEvent();
            }
        });

        // Handle button clicks (you can add further logic for these buttons)
        buttonX.addEventListener('click', () => {
            console.log("X button clicked");
        });

        buttonDown.addEventListener('click', () => {
            console.log("Down button clicked");
        });
    }

    // Update the 'in' angle dynamically
    updateInAngle(value) {
        const inAngleInput = this.shadowRoot.querySelector('.angle-in');
        if (inAngleInput) {
            inAngleInput.value = value;
        }
    }

    // Update the 'out' angle dynamically
    updateOutAngle(value) {
        const outAngleInput = this.shadowRoot.querySelector('.angle-out');
        if (outAngleInput) {
            outAngleInput.value = value;
        }
    }

    // Update the distance dynamically
    updateDistance(value) {
        const distanceInput = this.shadowRoot.querySelector('.distance');
        if (distanceInput) {
            distanceInput.value = value;
        }
    }

    // Emit a change event when any value changes
    emitChangeEvent() {
        this.dispatchEvent(new CustomEvent('angle-change', {
            detail: {
                inAngle: this.getAttribute('in-angle'),
                outAngle: this.getAttribute('out-angle'),
                distance: this.getAttribute('distance')
            }
        }));
    }

    // Set the 'in' angle programmatically
    setInAngle(value) {
        if (value >= 0 && value <= 360) {
            this.setAttribute('in-angle', value);
        }
    }

    // Set the 'out' angle programmatically
    setOutAngle(value) {
        if (value >= 0 && value <= 360) {
            this.setAttribute('out-angle', value);
        }
    }

    // Set the distance programmatically
    setDistance(value) {
        if (value >= 0 && value <= 4096) {
            this.setAttribute('distance', value);
        }
    }
}

// Define the custom element
customElements.define('angle-selector', AngleSelector);

export default AngleSelector;
