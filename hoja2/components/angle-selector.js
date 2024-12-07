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

    #validateAngle(angle)
    {
        if(angle>360)
        {
            return angle % 360;
        }
        if(angle < 0)
        {
            return 360 - (-angle % 360);
        }
    }

    #validateDistance(distance)
    {
        if(distance>4096)
        {
            return 4096;
        }
        if(distance < 1000)
        {
            return 1000;
        }
    }

    // Render the component
    render(css) {
        const inAngle = parseFloat(this.getAttribute('in-angle') || "0");
        const outAngle = parseFloat(this.getAttribute('out-angle') || "0");
        const distance = parseInt(this.getAttribute('distance') || "1000");

        this.shadowRoot.innerHTML = `
            <style>${css}</style>
                <button class="button-down" tooltip="Capture angle">⤓</button>

                <div class="even-container">
                <span class="label">in:</span>
                <input tooltip="Input angle" type="number" class="angle-in" value="${inAngle}" min="0" max="360" step="any"/>

                <span class="label">out:</span>
                <input tooltip="Output angle" type="number" class="angle-out" value="${outAngle}" min="0" max="360" step="any"/>

                <span class="label">dist:</span>
                <input tooltip="Output distance" type="number" class="distance" value="${distance}" min="1000" max="4096" step="1"/>
                </div>

                <button class="button-x" tooltip="Reset angle">↺</button>
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
        inAngleInput.addEventListener('change', (event) => {
            console.log("Test");
            const value = this.#validateAngle(parseFloat(event.target.value));
            if (value >= 0 && value <= 360) {
                this.setAttribute('in-angle', value);
                this.emitChangeEvent();
            }
        });

        // Update 'out' angle when input changes
        outAngleInput.addEventListener('change', (event) => {
            const value = this.#validateAngle(parseFloat(event.target.value));
            if (value >= 0 && value <= 360) {
                this.setAttribute('out-angle', value);
                this.emitChangeEvent();
            }
        });

        // Update distance when input changes
        distanceInput.addEventListener('change', (event) => {
            const value = this.#validateDistance(parseInt(event.target.value, 10));
            if (value >= 0 && value <= 4096) {
                this.setAttribute('distance', value);
                this.emitChangeEvent();
            }
        });

        // Handle button clicks (you can add further logic for these buttons)
        buttonX.addEventListener('click', () => {
            console.log("Reset angle clicked");
        });

        buttonDown.addEventListener('click', () => {
            console.log("Capture angle clicked");
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
