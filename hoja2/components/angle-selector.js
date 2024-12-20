import { enableTooltips } from "../tooltips.js";

class AngleSelector extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });

        // Internal state
        this._angleCaptureHandler = null;

        this._isInternalUpdate = false;

        // Element references
        this._inAngleInput = null;
        this._outAngleInput = null;
        this._distanceInput = null;
        this._idx

        this._inputDefault  = 0;
        this._outputDefault = 0;
        this._distanceDefault = 0;
    }

    /**
     * Observed attributes
     */
    static get observedAttributes() {
        return ['in-angle', 'out-angle', 'distance', 'idx'];
    }

    /**
     * Lifecycle: connectedCallback
     */
    async connectedCallback() {
        try {
            const cssResponse = await fetch('./components/angle-selector.css');
            const css = await cssResponse.text();
            this.render(css);
            this.#setupReferences();
            this.#setupEventListeners();
            this._isInitialized = true;
            enableTooltips(this.shadowRoot);
        } catch (error) {
            console.error('Error initializing AngleSelector:', error);
        }
    }

    /**
     * Lifecycle: attributeChangedCallback
     */
    attributeChangedCallback(name, oldValue, newValue) {
        if (!this._isInitialized || oldValue === newValue) return;
        if (this._isInternalUpdate || oldValue === newValue) return; // Ignore internal updates

        switch (name) {
            case 'in-angle':
                this.#setInAngle(parseFloat(newValue));
                break;
            case 'out-angle':
                this.#setOutAngle(parseFloat(newValue));
                break;
            case 'distance':
                this.#setDistance(parseInt(newValue, 10));
                break;
            case 'idx':
                this._idx = parseInt(newValue, 10);
                break;
        }
    }

    /**
     * Public methods for external use
     */

    /** Set an external angle capture handler */
    setAngleCaptureHandler(handler) {
        this._angleCaptureHandler = handler;
    }

    /** Get the current state of the component */
    getState() {
        return {
            idx: this._idx || 0,
            inAngle: parseFloat(this._inAngleInput?.value || 0),
            outAngle: parseFloat(this._outAngleInput?.value || 0),
            distance: parseInt(this._distanceInput?.value || 0)
        };
    }

    /**
     * Internal methods
     */

    #validateAngle(angle) {
        angle = parseFloat(angle);
        if (isNaN(angle)) return 0;
        angle = angle % 360;
        return angle < 0 ? angle + 360 : angle;
    }

    #validateDistance(distance) {
        distance = parseInt(distance, 10);
        if (isNaN(distance)) return 0;
        return Math.min(Math.max(distance, 0), 4096);
    }

    #setupReferences() {
        this._inAngleInput = this.shadowRoot.querySelector('.angle-in');
        this._outAngleInput = this.shadowRoot.querySelector('.angle-out');
        this._distanceInput = this.shadowRoot.querySelector('.distance');
    }

    #setupEventListeners() {
        // Input change listeners
        this._inAngleInput.addEventListener('change', (event) => {
            this.#setInAngle(this.#validateAngle(event.target.value));
        });

        this._outAngleInput.addEventListener('change', (event) => {
            this.#setOutAngle(this.#validateAngle(event.target.value));
        });

        this._distanceInput.addEventListener('change', (event) => {
            this.#setDistance(this.#validateDistance(event.target.value));
        });

        // Button click listeners
        this.shadowRoot.querySelector('.button-reset').addEventListener('click', () => this.#resetValues());

        this.shadowRoot.querySelector('.button-capture').addEventListener('click', async () => {
            await this.#captureAngle();
        });

        this.shadowRoot.querySelector('.button-disable').addEventListener('click', () => this.#disableValues());
    }

    #emitChangeEvent() {
        const currentState = this.getState();
        if (JSON.stringify(this._lastEmittedState) !== JSON.stringify(currentState)) {
            this.dispatchEvent(new CustomEvent('angle-change', {
                detail: currentState,
                bubbles: true,
                composed: true
            }));
            this._lastEmittedState = currentState;
        }
    }

    #setInAngle(value) {
        this._inAngleInput.value = value;
        this.setAttribute('in-angle', value);
        this.#emitChangeEvent();
    }

    #setOutAngle(value) {
        this._outAngleInput.value = value;
        this.setAttribute('out-angle', value);
        this.#emitChangeEvent();
    }

    #setDistance(value) {
        this._distanceInput.value = value;
        this.setAttribute('distance', value);
        this.#emitChangeEvent();
    }

    setDefaults(input, output, distance){
        this._inputDefault = input;
        this._outputDefault = output;
        this._distanceDefault = distance;
    }

    // Set all the attributes. Set emit to true if it should do a callback
    setAll(input, output, distance, emit=false) {
        this._isInternalUpdate = true;

        this._distanceInput.value = distance;
        this.setAttribute('distance', distance);

        this._outAngleInput.value = output;
        this.setAttribute('out-angle', output);

        this._inAngleInput.value = input;
        this.setAttribute('in-angle', input);

        this._isInternalUpdate = false;

        if(emit)
            this.#emitChangeEvent();
    }

    #resetValues() {
        this.setAll(this._inputDefault, this._outputDefault, this._distanceDefault, true);
    }

    async #captureAngle() {
        if (this._angleCaptureHandler) {
            try {
                const captureResult = await this._angleCaptureHandler();
                if (captureResult !== false) {
                    this.#setInAngle(captureResult);
                }
            } catch (error) {
                console.error('Angle capture failed:', error);
            }
        } else {
            console.warn(`No angle capture handler set for index ${this.idx}`);
        }
    }

    #disableValues() {
        this.setAll(0,0,0, true);
    }

    render(css) {
        this._idx = parseInt(this.getAttribute('idx') || "0");
        const inAngle = parseFloat(this.getAttribute('in-angle') || "0");
        const outAngle = parseFloat(this.getAttribute('out-angle') || "0");
        const distance = parseInt(this.getAttribute('distance') || "0");

        this.shadowRoot.innerHTML = `
            <style>${css}</style>
            <button class="button-capture" tooltip="Capture angle">⤓</button>

            <div class="even-container">
                <span class="label">in:</span>
                <input tooltip="Input angle" type="number" class="angle-in" value="${inAngle}" min="0" max="360" step="any"/>

                <span class="label">out:</span>
                <input tooltip="Output angle" type="number" class="angle-out" value="${outAngle}" min="0" max="360" step="any"/>

                <span class="label">dist:</span>
                <input tooltip="Output distance" type="number" class="distance" value="${distance}" min="0" max="4096" step="1"/>
            </div>

            <button class="button-reset" tooltip="Reset angle">↺</button>
            <button class="button-disable" tooltip="Disable angle">✖</button>
        `;
    }
}

customElements.define('angle-selector', AngleSelector);
export default AngleSelector;
