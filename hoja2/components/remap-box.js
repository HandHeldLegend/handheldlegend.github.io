import { enableTooltips } from "../js/tooltips.js";

class RemapBox extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });

        this._inputs = [];
        this._inputMask = 0;
        this._outputs = [];
        this._inputValues = [];
        this._isAnalog = [];
        this._analogRange = [];
        this._outputMappings = [];
        this._popupVisible = false;
        this._currentInputIndex = -1;
    }

    static get observedAttributes() {
        return ['inputs', 'outputs'];
    }

    async connectedCallback() {
        // Load the component-specific CSS
        const csstext = await fetch('./components/remap-box.css');
        const css = await csstext.text();
        this.render(css);
        this.setupEventListeners();

        enableTooltips(this.shadowRoot);
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'inputs' && oldValue !== newValue) {
            this._inputs = JSON.parse(newValue || '[]');
            this.initializeInputs();
            this.render();
        } else if (name === 'outputs' && oldValue !== newValue) {
            this._outputs = JSON.parse(newValue || '[]');
        }
    }

    initializeInputs() {
        this._inputValues = new Array(this._inputs.length).fill(0);
        //this._isAnalog = new Array(this._inputs.length).fill(false);
        this._outputMappings = new Array(this._inputs.length).fill(-1);
    }

    render(css) {
        if (!css) return;

        const gridItems = this._inputs.map((input, index) => {

            if(  ((1 << index) & this._inputMask) == 0 ) 
                return ``;

            // Set all at 22 and beyond to analog
            if(index>=22) {
                this._isAnalog[index] = true;
                this._analogRange[index] = 4095
            }

            if(index>=24) this._analogRange[index] = 2048;

            const outputLabel = this._outputMappings[index] === -1 ? 'Disabled' : 
                               this._outputs[this._outputMappings[index]] || 'None';
            
            const statusIndicator = this._isAnalog[index] ? 
                this.renderAnalogBar(this._inputValues[index]) : 
                this.renderDigitalIndicator(this._inputValues[index] > 0);

            return `
                <div class="input-box" data-index="${index}">
                    <div class="box-header">
                        <span class="input-label">${input}</span>
                        ${statusIndicator}
                    </div>
                    <div class="mapping-display">
                        <span class="output-label">${outputLabel}</span>
                    </div>
                </div>
            `;
        }).join('');

        this.shadowRoot.innerHTML = `
            <style>${css}</style>
            <div class="remap-grid">
                ${gridItems}
            </div>
            <div class="popup-overlay" style="display: none;">
                <div class="popup-content">
                    <div class="popup-header">
                        <span>Select Output for <span class="current-input"></span></span>
                        <button class="popup-close">✖</button>
                    </div>
                    <div class="output-grid">
                        <!-- Dynamic content -->
                    </div>
                </div>
            </div>
        `;
    }

    renderAnalogBar(value, range) {
        const percentage = (value && range) ? (value / range) * 100 : 0;

        return `
            <div class="analog-bar">
                <div class="analog-fill" style="width: ${percentage}%"></div>
                <span class="analog-value">${value}</span>
            </div>
        `;
    }

    renderDigitalIndicator(pressed) {
        return `
            <div class="digital-indicator ${pressed ? 'active' : ''}"></div>
        `;
    }

    setupEventListeners() {
        //console.log('Setting up main event listeners');
        
        // Use event delegation on the shadow root for all clicks
        this.shadowRoot.addEventListener('click', (e) => {
            //console.log('Click detected on:', e.target);
            //console.log('Event target classes:', e.target.className);
            //console.log('Closest input-box:', e.target.closest('.input-box'));
            //console.log('Closest output-box:', e.target.closest('.output-box'));
            
            // Input box click handlers
            const inputBox = e.target.closest('.input-box');
            if (inputBox) {
                //console.log('Input box clicked');
                const index = parseInt(inputBox.dataset.index);
                this.showOutputPopup(index);
                this.emitInputClickEvent(index);
                return; // Prevent other handlers from running
            }

            // Popup close button
            if (e.target.matches('.popup-close')) {
                //console.log('Close button clicked');
                this.hideOutputPopup();
                return;
            }

            // Popup overlay (background) click
            if (e.target.matches('.popup-overlay')) {
                //console.log('Overlay clicked');
                this.hideOutputPopup();
                return;
            }

            // Output selection
            const outputBox = e.target.closest('.output-box');
            if (outputBox) {
                //console.log('Output box clicked:', outputBox.dataset.index);
                const outputIndex = parseInt(outputBox.dataset.index);
                this.selectOutput(this._currentInputIndex, outputIndex);
                this.hideOutputPopup();
                return;
            }
        });

        // Prevent popup close when clicking inside popup content (but not on buttons)
        this.shadowRoot.addEventListener('click', (e) => {
            const popupContent = e.target.closest('.popup-content');
            if (popupContent && !e.target.closest('.popup-close') && !e.target.closest('.output-box')) {
                //console.log('Click inside popup content, preventing propagation');
                e.stopPropagation();
            }
        });
    }

    showOutputPopup(inputIndex) {
        //console.log('Showing popup for input:', inputIndex);
        this._currentInputIndex = inputIndex;
        this._popupVisible = true;

        const popup = this.shadowRoot.querySelector('.popup-overlay');
        const currentInputSpan = this.shadowRoot.querySelector('.current-input');
        const outputGrid = this.shadowRoot.querySelector('.output-grid');

        if (!popup || !currentInputSpan || !outputGrid) {
            console.error('Could not find popup elements');
            return;
        }

        currentInputSpan.textContent = this._inputs[inputIndex];

        // Create output options including disable option
        const disableOption = `
            <div class="output-box disable-option" data-index="-1" tooltip="Disable this input">
                <span>Disable</span>
            </div>
        `;

        const outputOptions = this._outputs.map((output, index) => `
            <div class="output-box" data-index="${index}" tooltip="Map to ${output}">
                <span>${output}</span>
            </div>
        `).join('');

        outputGrid.innerHTML = disableOption + outputOptions;
        popup.style.display = 'flex';

        //console.log('Popup shown, output options created:', outputGrid.children.length);

        // Re-enable tooltips for new content
        enableTooltips(this.shadowRoot);
    }

    hideOutputPopup() {
        //console.log('Hiding popup');
        this._popupVisible = false;
        const popup = this.shadowRoot.querySelector('.popup-overlay');
        if (popup) {
            popup.style.display = 'none';
        }
        this._currentInputIndex = -1;
    }

    selectOutput(inputIndex, outputIndex) {
        console.log('Selecting output:', outputIndex, 'for input:', inputIndex);
        this._outputMappings[inputIndex] = outputIndex;
        this.updateInputBox(inputIndex);
        this.emitMappingChangeEvent(inputIndex, outputIndex);
    }

    updateInputBox(inputIndex) {
        const inputBox = this.shadowRoot.querySelector(`.input-box[data-index="${inputIndex}"]`);
        if (!inputBox) return;

        const outputLabel = this._outputMappings[inputIndex] === -1 ? 'Disabled' : 
                           this._outputs[this._outputMappings[inputIndex]] || 'None';
        
        const outputLabelElement = inputBox.querySelector('.output-label');
        outputLabelElement.textContent = outputLabel;
    }

    // Public API methods
    setInputs(inputs, mask=0) {
        this._inputMask = mask;
        this._inputs = inputs;
        this.initializeInputs();
        this.render();
    }

    setOutputs(outputs) {
        this._outputs = outputs;
    }

    setInputValue(index, value) {
        if (index >= 0 && index < this._inputValues.length) {
            if((1<<index) & this._inputMask == 0) return;

            if(value != this._inputValues[index]) {
                this._inputValues[index] = value;
                this.updateStatusIndicator(index);
            }
        }
    }

    setInputType(index, isAnalog) {
        if (index >= 0 && index < this._isAnalog.length) {
            this._isAnalog[index] = isAnalog;
            this.updateStatusIndicator(index);
        }
    }

    updateStatusIndicator(index) {
        const inputBox = this.shadowRoot.querySelector(`.input-box[data-index="${index}"]`);
        if (!inputBox) return;

        const statusContainer = inputBox.querySelector('.box-header');
        const oldIndicator = statusContainer.querySelector('.analog-bar, .digital-indicator');
        
        const newIndicator = this._isAnalog[index] ? 
            this.renderAnalogBar(this._inputValues[index], this._analogRange[index]) : 
            this.renderDigitalIndicator(this._inputValues[index] > 0);

        oldIndicator.outerHTML = newIndicator;
    }

    getMapping(index) {
        return this._outputMappings[index];
    }

    getAllMappings() {
        return [...this._outputMappings];
    }

    // Event emitters
    emitInputClickEvent(inputIndex) {
        this.dispatchEvent(new CustomEvent('input-clicked', {
            detail: {
                inputIndex: inputIndex,
                inputName: this._inputs[inputIndex]
            }
        }));
    }

    emitMappingChangeEvent(inputIndex, outputIndex) {
        this.dispatchEvent(new CustomEvent('mapping-changed', {
            detail: {
                inputIndex: inputIndex,
                outputIndex: outputIndex,
                inputName: this._inputs[inputIndex],
                outputName: outputIndex === -1 ? 'Disabled' : this._outputs[outputIndex]
            }
        }));
    }
}

// Define the custom element
customElements.define('remap-box', RemapBox);

export default RemapBox;