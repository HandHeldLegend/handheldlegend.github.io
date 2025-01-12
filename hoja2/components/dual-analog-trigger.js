class DualAnalogTrigger extends HTMLElement {
    constructor() {
        super();
        this._leftValue = 0;
        this._rightValue = 0;
        this._leftThreshold = 2048;
        this._rightThreshold = 2048;
        this._maxValue = 4095;
        
        this.attachShadow({ mode: 'open' });
    }

    static get observedAttributes() {
        return ['left-value', 'right-value', 'left-threshold', 'right-threshold'];
    }

    async connectedCallback() {
        // Load the component-specific CSS
        const csstext = await fetch('./components/dual-analog-trigger.css');
        const cssHostResponse = await fetch('./components/host-template.css');
        const cssHost = await cssHostResponse.text();
        const css = cssHost + await csstext.text();

        this.render(css);
        this.updateVisuals();
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return;
        
        const left = name === 'left-value' ? newValue : this._leftValue;
        const right = name === 'right-value' ? newValue : this._rightValue;
        const leftThreshold = name === 'left-threshold' ? newValue : this._leftThreshold;
        const rightThreshold = name === 'right-threshold' ? newValue : this._rightThreshold;
        
        this._updateValues(left, right, leftThreshold, rightThreshold);
    }

    _validateValue(value) {
        const num = parseInt(value, 10);
        if (isNaN(num)) return 0;
        return Math.max(0, Math.min(this._maxValue, num));
    }

    _updateValues(leftValue, rightValue, leftThreshold, rightThreshold) {
        this._leftValue = this._validateValue(leftValue);
        this._rightValue = this._validateValue(rightValue);
        this._leftThreshold = this._validateValue(leftThreshold);
        this._rightThreshold = this._validateValue(rightThreshold);
        this.updateVisuals();
    }

    render(css) {
        this.shadowRoot.innerHTML = `
            <style>${css}</style>
            <div class="trigger-container">
                <div class="trigger-group">
                    <div class="trigger-label">Left Trigger</div>
                    <div class="trigger">
                        <div class="trigger-bar"></div>
                        <div class="threshold-line"></div>
                        <div class="value-label"></div>
                        <div class="threshold-label"></div>
                    </div>
                </div>
                <div class="trigger-group">
                    <div class="trigger-label">Right Trigger</div>
                    <div class="trigger">
                        <div class="trigger-bar"></div>
                        <div class="threshold-line"></div>
                        <div class="value-label"></div>
                        <div class="threshold-label"></div>
                    </div>
                </div>
            </div>
        `;
    }

    updateVisuals() {
        const leftBar = this.shadowRoot.querySelector('.trigger-group:first-child .trigger-bar');
        const rightBar = this.shadowRoot.querySelector('.trigger-group:last-child .trigger-bar');
        const leftThresholdLine = this.shadowRoot.querySelector('.trigger-group:first-child .threshold-line');
        const rightThresholdLine = this.shadowRoot.querySelector('.trigger-group:last-child .threshold-line');
        const leftLabel = this.shadowRoot.querySelector('.trigger-group:first-child .value-label');
        const rightLabel = this.shadowRoot.querySelector('.trigger-group:last-child .value-label');
        const leftThresholdLabel = this.shadowRoot.querySelector('.trigger-group:first-child .threshold-label');
        const rightThresholdLabel = this.shadowRoot.querySelector('.trigger-group:last-child .threshold-label');

        if (!leftBar || !rightBar) return;

        // Update bar widths
        const leftPercent = (this._leftValue / this._maxValue) * 100;
        const rightPercent = (this._rightValue / this._maxValue) * 100;
        const leftThresholdPercent = (this._leftThreshold / this._maxValue) * 100;
        const rightThresholdPercent = (this._rightThreshold / this._maxValue) * 100;

        leftBar.style.width = `${leftPercent}%`;
        rightBar.style.width = `${rightPercent}%`;
        leftThresholdLine.style.left = `${leftThresholdPercent}%`;
        rightThresholdLine.style.left = `${rightThresholdPercent}%`;

        // Update classes for threshold crossing
        leftBar.classList.toggle('above-threshold',     (this._leftValue > this._leftThreshold) && this._leftThreshold);
        rightBar.classList.toggle('above-threshold',    (this._rightValue > this._rightThreshold) && this._rightThreshold);

        // Update value labels
        leftLabel.textContent = this._leftValue;
        rightLabel.textContent = this._rightValue;
        
        // Update threshold labels
        leftThresholdLabel.textContent = `Threshold: ${this._leftThreshold}`;
        rightThresholdLabel.textContent = `Threshold: ${this._rightThreshold}`;
        leftThresholdLabel.style.left = `${leftThresholdPercent}%`;
        rightThresholdLabel.style.left = `${rightThresholdPercent}%`;
    }

    // Public methods for setting values
    setValues(leftValue, rightValue) {
        this._updateValues(leftValue, rightValue, this._leftThreshold, this._rightThreshold);
    }

    setThresholds(leftThreshold=null, rightThreshold=null) {

        let lt = this._leftThreshold;
        let rt = this._rightThreshold;

        if(leftThreshold!=null)     lt = leftThreshold;
        if(rightThreshold!=null)    rt = rightThreshold;

        this._updateValues(this._leftValue, this._rightValue, lt, rt);
    }

    // Get current values
    getValues() {
        return {
            leftValue: this._leftValue,
            rightValue: this._rightValue,
            leftThreshold: this._leftThreshold,
            rightThreshold: this._rightThreshold
        };
    }
}

customElements.define('dual-analog-trigger', DualAnalogTrigger);

export default DualAnalogTrigger;