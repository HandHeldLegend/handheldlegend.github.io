class InputConfigPanel extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });

        // Component state
        this._inputLabel = 'B';
        this._outputLabel = 'RT';
        this._inputType = 'digital'; // 'digital', 'analog', 'joystick'
        this._outputType = 'analog'; // 'digital', 'analog', 'joystick', 'dpad'
        this._value = 0; // 0-4096 (12-bit)
        this._pressed = false;
        this._mode = 'default'; // varies based on input/output types
        this._delta = 0;
        this._output = 0;
        this._onClose = null;
        this._onReset = null;
        this._onCalibrate = null;
        this._onCalibrateFinish = null;
        this._outputSelectorHandler = null;
        this._isCalibrating = false;
    }

    static get observedAttributes() {
        return [
            'input-label', 'output-label', 'input-type', 'output-type',
            'value', 'pressed', 'mode', 'delta', 'output'
        ];
    }

    async connectedCallback() {
        const csstext = await fetch('./components/input-config-panel.css');
        const css = await csstext.text();

        const modulecss = await fetch('./css/modules.css');
        const moduleStyles = await modulecss.text();

        const combined = css + moduleStyles;
        this.render(combined);
        this.setupEventListeners();
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return;
        
        switch(name) {
            case 'input-label':
                this._inputLabel = newValue || 'NULL';
                this.updateInputLabel();
                break;
            case 'output-label':
                this._outputLabel = newValue || 'NULL';
                this.updateOutputLabel();
                break;
            case 'input-type':
                this._inputType = newValue || 'digital';
                this.updateInputType();
                break;
            case 'output-type':
                this._outputType = newValue || 'analog';
                this.updateOutputType();
                break;
            case 'value':
                this._value = Math.max(0, Math.min(4096, parseInt(newValue) || 0));
                this.updateValueBar();
                break;
            case 'pressed':
                this._pressed = newValue === 'true' || newValue === '';
                this.updatePressState();
                break;
            case 'mode':
                this._mode = newValue || 'default';
                this.updateModeUI();
                break;
            case 'delta':
                this._delta = Math.max(0, Math.min(4096, parseInt(newValue) || 0));
                this.updateDeltaDisplay();
                break;
            case 'output':
                this._output = Math.max(0, Math.min(4096, parseInt(newValue) || 0));
                this.updateOutputDisplay();
                break;
        }
    }

    // Emit custom event for user interactions
    emitConfigChange() {
        this.dispatchEvent(new CustomEvent('config-change', {
            bubbles: true,
            composed: true,
            detail: this.getState()
        }));
    }

    getTypeIcon(type) {
        switch(type) {
            case 'digital':
                return '⊳'; // Digital symbol
            case 'analog':
                return '∿'; // Analog wave symbol
            case 'joystick':
                return '⊕'; // Joystick symbol
            case 'dpad':
                return '✥'; // D-pad symbol
            default:
                return '';
        }
    }

    getModeOptions() {
        const { _inputType: iType, _outputType: oType } = this;
        
        // Digital In -> Digital Out
        if (iType === 'digital' && oType === 'digital') {
            return [];
        }
        
        // Digital In -> Analog/Joystick Out
        if (iType === 'digital' && (oType === 'analog' || oType === 'joystick')) {
            return [];
        }

        // Digital In -> Dpad Out
        if (iType === 'digital' && oType === 'dpad') {
            return [];
        }
        
        // Analog/Joystick In -> Digital Out
        if ((iType === 'analog' || iType === 'joystick') && oType === 'digital') {
            return ['rapid', 'threshold'];
        }
        
        // Analog/Joystick In -> Analog/Joystick Out
        if ((iType === 'analog' || iType === 'joystick') && 
            (oType === 'analog' || oType === 'joystick')) {
            return ['passthrough', 'rapid', 'threshold'];
        }

        // Analog/Joystick In -> Dpad Out
        if ((iType === 'analog' || iType === 'joystick') && oType === 'dpad') {
            return ['passthrough', 'rapid', 'threshold'];
        }
        
        return [];
    }

    shouldShowDelta() {
        const { _inputType: iType, _outputType: oType, _mode } = this;
        
        // Analog/Joystick In -> Digital Out (always show delta for rapid or threshold)
        if ((iType === 'analog' || iType === 'joystick') && oType === 'digital') {
            return _mode === 'rapid' || _mode === 'threshold';
        }
        
        // Analog/Joystick In -> Analog/Joystick Out with Rapid or Threshold
        if ((iType === 'analog' || iType === 'joystick') && 
            (oType === 'analog' || oType === 'joystick') &&
            (_mode === 'rapid' || _mode === 'threshold')) {
            return true;
        }

        // Analog/Joystick In -> Dpad Out with Rapid or Threshold
        if ((iType === 'analog' || iType === 'joystick') && 
            oType === 'dpad' &&
            (_mode === 'rapid' || _mode === 'threshold')) {
            return true;
        }
        
        return false;
    }

    shouldShowOutput() {
        const { _inputType: iType, _outputType: oType, _mode } = this;
        
        // Digital In -> Analog/Joystick Out (always show output)
        if (iType === 'digital' && (oType === 'analog' || oType === 'joystick')) {
            return true;
        }
        
        // Analog/Joystick In -> Analog/Joystick Out with Rapid or Threshold
        if ((iType === 'analog' || iType === 'joystick') && 
            (oType === 'analog' || oType === 'joystick') &&
            (_mode === 'rapid' || _mode === 'threshold')) {
            return true;
        }
        
        return false;
    }

    shouldShowCalibrate() {
        const { _inputType: iType, _outputType: oType } = this;
        
        // Show for Analog In ONLY
        return (iType === 'analog');
    }

    shouldShowReset() {
        const { _inputType: iType, _outputType: oType } = this;
        
        // Show for Analog/Joystick In -> Digital Out
        return ((iType === 'analog' || iType === 'joystick'));
    }

    isDeltaDisabled() {
        return false; // Delta is never disabled, it's either shown or hidden
    }

    isOutputDisabled() {
        return false; // Output is never disabled, it's either shown or hidden
    }

    getDeltaLabel() {
        return this._mode === 'threshold' ? 'Threshold' : 'Delta';
    }

    render(css) {
        const valuePercent = (this._value / 4096) * 90;
        const modeOptions = this.getModeOptions();
        const showDelta = this.shouldShowDelta();
        const showOutput = this.shouldShowOutput();
        const showCalibrate = this.shouldShowCalibrate();
        const showReset = this.shouldShowReset();
        const deltaDisabled = this.isDeltaDisabled();
        const outputDisabled = this.isOutputDisabled();
        const deltaLabel = this.getDeltaLabel();
        
        // Ensure delta and output have valid values
        const deltaValue = isNaN(this._delta) ? 0 : this._delta;
        const outputValue = isNaN(this._output) ? 0 : this._output;

        this.shadowRoot.innerHTML = `
            <style>${css}</style>
            <div class="config-panel">
                <button class="close-button hoverable clickable">✕</button>
                
                <div class="mapping-display">
                    <div class="input-box">
                        <span class="type-icon">${this.getTypeIcon(this._inputType)}</span>
                        <span class="label">${this._inputLabel}</span>
                    </div>
                    <div class="arrow">→</div>
                    <div class="output-box hoverable clickable ${this._outputType}">
                        <span class="type-icon">${this.getTypeIcon(this._outputType)}</span>
                        <span class="label">${this._outputLabel}</span>
                    </div>
                </div>

                <div class="value-bar-container">
                    <div class="value-bar">
                        <div class="value-indicator ${this._pressed ? 'pressed' : ''}" 
                             style="left: ${5+valuePercent}%"></div>
                    </div>
                    <div class="value-label">${this._value}</div>
                </div>

                ${modeOptions.length > 0 ? `
                    <div class="divider"></div>
                    <div class="section-title">Mode</div>
                    <div class="mode-options">
                        ${modeOptions.map(option => `
                            <label class="radio-option">
                                <input type="radio" 
                                       name="mode" 
                                       value="${option}" 
                                       ${this._mode === option ? 'checked' : ''}>
                                <span>${option.charAt(0).toUpperCase() + option.slice(1)}</span>
                            </label>
                        `).join('')}
                    </div>
                ` : ''}

                ${showDelta ? `
                    <div class="divider"></div>
                    <div class="section-title delta-label">${deltaLabel}</div>
                    <div class="slider-container ${deltaDisabled ? 'disabled' : ''}">
                        <input type="range" 
                               class="slider delta-slider" 
                               min="0" 
                               max="4096" 
                               step="128" 
                               value="${deltaValue}"
                               ${deltaDisabled ? 'disabled' : ''}>
                        <div class="slider-value delta-value">${deltaValue}</div>
                    </div>
                ` : ''}

                ${showOutput ? `
                    <div class="divider"></div>
                    <div class="section-title">Output</div>
                    <div class="slider-container ${outputDisabled ? 'disabled' : ''}">
                        <input type="range" 
                               class="slider output-slider" 
                               min="0" 
                               max="4096" 
                               step="128"
                               value="${outputValue}"
                               ${outputDisabled ? 'disabled' : ''}>
                        <div class="slider-value output-value">${outputValue}</div>
                    </div>
                ` : ''}

                ${(showReset || showCalibrate) ? `
                    <div class="divider"></div>
                    <div class="button-row">
                        ${showReset ? '<button class="action-button reset-button hoverable clickable">Reset</button>' : ''}
                        ${showCalibrate ? `<button class="action-button calibrate-button hoverable clickable">${this._isCalibrating ? 'Finish' : 'Calibrate'}</button>` : ''}
                    </div>
                ` : ''}
            </div>
        `;
    }

    setupEventListeners() {
        const shadow = this.shadowRoot;
        
        // Close button
        const closeBtn = shadow.querySelector('.close-button');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                if (this._onClose) this._onClose();
            });
        }

        // Mode radio buttons
        const radioButtons = shadow.querySelectorAll('input[name="mode"]');
        radioButtons.forEach(radio => {
            radio.addEventListener('change', (e) => {
                this._mode = e.target.value;
                this.updateModeUI();
                
                // Emit config change event with full state
                this.emitConfigChange();
            });
        });

        // Delta slider
        const deltaSlider = shadow.querySelector('.delta-slider');
        if (deltaSlider) {
            deltaSlider.addEventListener('input', (e) => {
                this._delta = parseInt(e.target.value);
                const valueLabel = shadow.querySelector('.delta-value');
                if (valueLabel) valueLabel.textContent = this._delta;
            });
            
            deltaSlider.addEventListener('change', (e) => {
                // Emit config change event with full state when slider is released
                this.emitConfigChange();
            });
        }

        // Output slider
        const outputSlider = shadow.querySelector('.output-slider');
        if (outputSlider) {
            outputSlider.addEventListener('input', (e) => {
                this._output = parseInt(e.target.value);
                const valueLabel = shadow.querySelector('.output-value');
                if (valueLabel) valueLabel.textContent = this._output;
            });
            
            outputSlider.addEventListener('change', (e) => {
                // Emit config change event with full state when slider is released
                this.emitConfigChange();
            });
        }

        // Output button 
        const outputBox = shadow.querySelector('.output-box');
        if (outputBox) {
            outputBox.addEventListener('click', () => {
                if (this._outputSelectorHandler) {
                    this._outputSelectorHandler();
                }
            });
        }

        // Reset button
        const resetBtn = shadow.querySelector('.reset-button');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                if (this._onReset) this._onReset();
            });
        }

        // Calibrate button
        const calibrateBtn = shadow.querySelector('.calibrate-button');
        if (calibrateBtn) {
            calibrateBtn.addEventListener('click', () => {
                if (this._isCalibrating) {
                    // Finishing calibration
                    this._isCalibrating = false;
                    this.updateCalibrateButton();
                    if (this._onCalibrateFinish) this._onCalibrateFinish();
                } else {
                    // Starting calibration
                    this._isCalibrating = true;
                    this.updateCalibrateButton();
                    if (this._onCalibrate) this._onCalibrate();
                }
            });
        }
    }

    // Individual update methods that preserve animations
    updateInputLabel() {
        const label = this.shadowRoot.querySelector('.input-box .label');
        if (label) {
            label.textContent = this._inputLabel;
        }
    }

    updateOutputLabel() {
        const label = this.shadowRoot.querySelector('.output-box .label');
        if (label) {
            label.textContent = this._outputLabel;
        }
    }

    updateInputType() {
        // When input type changes, we need to re-render to show correct options
        const css = this.shadowRoot.querySelector('style')?.textContent;
        if (css) {
            this.render(css);
            this.setupEventListeners();
        }
    }

    updateOutputType() {
        // When output type changes, we need to re-render to show correct options
        const css = this.shadowRoot.querySelector('style')?.textContent;
        if (css) {
            this.render(css);
            this.setupEventListeners();
        }
    }

    updateValueBar() {
        const indicator = this.shadowRoot.querySelector('.value-indicator');
        const valueLabel = this.shadowRoot.querySelector('.value-label');
        if (indicator) {
            const valuePercent = (this._value / 4096) * 90;
            indicator.style.left = `${valuePercent+5}%`;
        }
        if (valueLabel) {
            valueLabel.textContent = this._value;
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

    updateModeUI() {
        // When mode changes, we need to update which sections are visible
        const css = this.shadowRoot.querySelector('style')?.textContent;
        if (css) {
            this.render(css);
            this.setupEventListeners();
        }
    }

    updateDeltaDisplay() {
        const deltaSlider = this.shadowRoot.querySelector('.delta-slider');
        const deltaValue = this.shadowRoot.querySelector('.delta-value');
        const safeValue = isNaN(this._delta) ? 0 : this._delta;
        if (deltaSlider) {
            deltaSlider.value = safeValue;
        }
        if (deltaValue) {
            deltaValue.textContent = safeValue;
        }
    }

    updateOutputDisplay() {
        const outputSlider = this.shadowRoot.querySelector('.output-slider');
        const outputValue = this.shadowRoot.querySelector('.output-value');
        const safeValue = isNaN(this._output) ? 0 : this._output;
        if (outputSlider) {
            outputSlider.value = safeValue;
        }
        if (outputValue) {
            outputValue.textContent = safeValue;
        }
    }

    updateCalibrateButton() {
        const calibrateBtn = this.shadowRoot.querySelector('.calibrate-button');
        if (calibrateBtn) {
            calibrateBtn.textContent = this._isCalibrating ? 'Finish' : 'Calibrate';
        }
    }

    updateUI() {
        // Full re-render only when structure needs to change (mode options visibility, etc.)
        const css = this.shadowRoot.querySelector('style').textContent;
        this.render(css);
        this.setupEventListeners();
    }

    // Public API
    setValue(value) {
        this._value = Math.max(0, Math.min(4096, value));
        this.setAttribute('value', this._value.toString());
    }

    setPressed(pressed) {
        this._pressed = pressed;
        this.setAttribute('pressed', pressed.toString());
    }

    setInputLabelAndType(label, type) {
        this._inputLabel = label;
        this._inputType = type;
        this.setAttribute('input-label', label);
        this.setAttribute('input-type', type);
        
        // Reset mode to valid option for new input/output combination
        const availableModes = this.getModeOptions();
        if (availableModes.length === 0) {
            this._mode = 'default';
        } else if (!availableModes.includes(this._mode)) {
            this._mode = availableModes[0];
        }
        this.setAttribute('mode', this._mode);
    }

    setOutputLabelAndType(label, type) {
        this._outputLabel = label;
        this._outputType = type;
        this.setAttribute('output-label', label);
        this.setAttribute('output-type', type);
        
        // Reset mode to valid option for new input/output combination
        const availableModes = this.getModeOptions();
        if (availableModes.length === 0) {
            this._mode = 'default';
        } else if (!availableModes.includes(this._mode)) {
            this._mode = availableModes[0];
        }
        this.setAttribute('mode', this._mode);
    }

    setOutputSelectorHandler(handler) {
        this._outputSelectorHandler = handler;
    }

    setMode(mode) {
        const availableModes = this.getModeOptions();
        
        // If no modes are available, set to 'default'
        if (availableModes.length === 0) {
            this._mode = 'default';
        } 
        // If mode is a number, treat it as an index
        else if (typeof mode === 'number') {
            const index = Math.max(0, Math.min(availableModes.length - 1, mode));
            this._mode = availableModes[index];
        }
        // If mode is a string index like "2"
        else if (!isNaN(parseInt(mode)) && availableModes[parseInt(mode)]) {
            this._mode = availableModes[parseInt(mode)];
        }
        // If the requested mode string is available, use it
        else if (availableModes.includes(mode)) {
            this._mode = mode;
        }
        // Otherwise, default to the first available mode
        else {
            this._mode = availableModes[0];
        }
        
        this.setAttribute('mode', this._mode);
        
        // Force update if already connected
        if (this.shadowRoot?.querySelector('.config-panel')) {
            this.updateModeUI();
        }
    }

    setDelta(delta) {
        this._delta = Math.max(0, Math.min(4096, delta));
        this.setAttribute('delta', this._delta.toString());
    }

    setOutput(output) {
        this._output = Math.max(0, Math.min(4096, output));
        this.setAttribute('output', this._output.toString());
    }

    setOnClose(handler) {
        this._onClose = handler;
    }

    setOnReset(handler) {
        this._onReset = handler;
    }

    setOnCalibrate(handler) {
        this._onCalibrate = handler;
    }

    setOnCalibrateFinish(handler) {
        this._onCalibrateFinish = handler;
    }

    // Set calibration state
    setCalibrating(isCalibrating) {
        this._isCalibrating = isCalibrating;
        this.updateCalibrateButton();
    }

    // Reset calibration state
    resetCalibrationState() {
        this._isCalibrating = false;
        this.updateCalibrateButton();
    }

    getState() {
        const availableModes = this.getModeOptions();
        const modeIndex = availableModes.indexOf(this._mode);
        
        return {
            inputLabel: this._inputLabel,
            outputLabel: this._outputLabel,
            inputType: this._inputType,
            outputType: this._outputType,
            value: this._value,
            pressed: this._pressed,
            mode: modeIndex >= 0 ? modeIndex : 0,
            delta: this._delta,
            output: this._output,
            isCalibrating: this._isCalibrating
        };
    }
}

customElements.define('input-config-panel', InputConfigPanel);

export default InputConfigPanel;