class InputConfigPanel extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });

        // Component state
        this._inputLabel = 'B';
        this._outputLabel = 'RT';
        this._inputType = 'digital'; // 'digital', 'analog', 'joystick'
        this._outputType = 'analog'; // 'digital', 'analog', 'joystick', 'dpad'
        this._value = 2001; // 0-4095 (12-bit)
        this._pressed = false;
        this._mode = 'default'; // varies based on input/output types
        this._delta = 209;
        this._output = 209;
        this._onClose = null;
        this._onReset = null;
        this._onCalibrate = null;
        this._outputSelectorHandler = null;
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
                break;
            case 'output-label':
                this._outputLabel = newValue || 'NULL';
                break;
            case 'input-type':
                this._inputType = newValue || 'digital';
                break;
            case 'output-type':
                this._outputType = newValue || 'analog';
                break;
            case 'value':
                this._value = Math.max(0, Math.min(4095, parseInt(newValue) || 0));
                break;
            case 'pressed':
                this._pressed = newValue === 'true' || newValue === '';
                break;
            case 'mode':
                this._mode = newValue || 'default';
                break;
            case 'delta':
                this._delta = Math.max(0, Math.min(4095, parseInt(newValue) || 0));
                break;
            case 'output':
                this._output = Math.max(0, Math.min(4095, parseInt(newValue) || 0));
                break;
        }
        
        this.updateUI();
    }

    getTypeIcon(type) {
        switch(type) {
            case 'digital':
                return '⊓⊔'; // Digital symbol
            case 'analog':
                return '∿'; // Analog wave symbol
            case 'joystick':
                return '⊕'; // Joystick symbol
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
        
        // Analog/Joystick In -> Digital Out
        if ((iType === 'analog' || iType === 'joystick') && oType === 'digital') {
            return ['rapid', 'threshold'];
        }
        
        // Analog/Joystick In -> Analog/Joystick Out
        if ((iType === 'analog' || iType === 'joystick') && 
            (oType === 'analog' || oType === 'joystick')) {
            return ['passthrough', 'rapid', 'threshold'];
        }
        
        return [];
    }

    shouldShowDelta() {
        const { _inputType: iType, _outputType: oType, _mode } = this;
        
        // Analog/Joystick In -> Digital Out
        if ((iType === 'analog' || iType === 'joystick') && oType === 'digital') {
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

    shouldShowOutput() {
        const { _inputType: iType, _outputType: oType, _mode } = this;
        
        // Digital In -> Analog/Joystick Out
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
        
        // Show for Analog/Joystick In -> Any Out
        return (iType === 'analog' || iType === 'joystick');
    }

    shouldShowReset() {
        const { _inputType: iType, _outputType: oType } = this;
        
        // Show for Analog/Joystick In -> Digital Out
        return ((iType === 'analog' || iType === 'joystick') && oType === 'digital');
    }

    isDeltaDisabled() {
        return this._mode === 'passthrough';
    }

    isOutputDisabled() {
        return this._mode === 'passthrough';
    }

    getDeltaLabel() {
        return this._mode === 'threshold' ? 'Threshold' : 'Delta';
    }

    render(css) {
        const valuePercent = (this._value / 4095) * 100;
        const modeOptions = this.getModeOptions();
        const showDelta = this.shouldShowDelta();
        const showOutput = this.shouldShowOutput();
        const showCalibrate = this.shouldShowCalibrate();
        const showReset = this.shouldShowReset();
        const deltaDisabled = this.isDeltaDisabled();
        const outputDisabled = this.isOutputDisabled();
        const deltaLabel = this.getDeltaLabel();

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
                             style="left: ${valuePercent}%"></div>
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
                    <div class="section-title">${deltaLabel}</div>
                    <div class="slider-container ${deltaDisabled ? 'disabled' : ''}">
                        <input type="range" 
                               class="slider delta-slider" 
                               min="0" 
                               max="4095" 
                               value="${this._delta}"
                               ${deltaDisabled ? 'disabled' : ''}>
                        <div class="slider-value">${this._delta}</div>
                    </div>
                ` : ''}

                ${showOutput ? `
                    <div class="divider"></div>
                    <div class="section-title">Output</div>
                    <div class="slider-container ${outputDisabled ? 'disabled' : ''}">
                        <input type="range" 
                               class="slider output-slider" 
                               min="0" 
                               max="4095" 
                               value="${this._output}"
                               ${outputDisabled ? 'disabled' : ''}>
                        <div class="slider-value">${this._output}</div>
                    </div>
                ` : ''}

                ${(showReset || showCalibrate) ? `
                    <div class="divider"></div>
                    <div class="button-row">
                        <button class="action-button reset-button hoverable clickable">Reset</button>
                        ${showCalibrate ? '<button class="action-button calibrate-button hoverable clickable">Calibrate</button>' : ''}
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
                this.updateUI();
            });
        });

        // Delta slider
        const deltaSlider = shadow.querySelector('.delta-slider');
        if (deltaSlider) {
            deltaSlider.addEventListener('input', (e) => {
                this._delta = parseInt(e.target.value);
                const valueLabel = shadow.querySelector('.delta-slider + .slider-value');
                if (valueLabel) valueLabel.textContent = this._delta;
            });
        }

        // Output slider
        const outputSlider = shadow.querySelector('.output-slider');
        if (outputSlider) {
            outputSlider.addEventListener('input', (e) => {
                this._output = parseInt(e.target.value);
                const valueLabel = shadow.querySelector('.output-slider + .slider-value');
                if (valueLabel) valueLabel.textContent = this._output;
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
                if (this._onCalibrate) this._onCalibrate();
            });
        }
    }

    updateUI() {
        const css = this.shadowRoot.querySelector('style').textContent;
        this.render(css);
        this.setupEventListeners();
    }

    // Public API
    setValue(value) {
        this._value = Math.max(0, Math.min(4095, value));
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
    }

    setOutputLabelAndType(label, type) {
        this._outputLabel = label;
        this._outputType = type;
        this.setAttribute('output-label', label);
        this.setAttribute('output-type', type);
    }

    setOutputSelectorHandler(handler) {
        this._outputSelectorHandler = handler;
    }

    setMode(mode) {
        this._mode = mode;
        this.setAttribute('mode', mode);
    }

    setDelta(delta) {
        this._delta = Math.max(0, Math.min(4095, delta));
        this.setAttribute('delta', this._delta.toString());
    }

    setOutput(output) {
        this._output = Math.max(0, Math.min(4095, output));
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

    getState() {
        return {
            inputLabel: this._inputLabel,
            outputLabel: this._outputLabel,
            inputType: this._inputType,
            outputType: this._outputType,
            value: this._value,
            pressed: this._pressed,
            mode: this._mode,
            delta: this._delta,
            output: this._output
        };
    }
}

customElements.define('input-config-panel', InputConfigPanel);

export default InputConfigPanel;