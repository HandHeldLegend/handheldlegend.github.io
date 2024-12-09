import { enableTooltips } from "../tooltips.js";

class TristateButton extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        
        // Default state configurations
        this._states = {
            off: { 
                text: 'Connect', 
                class: 'state-off' 
            },
            offToOnTransitioning: { 
                text: 'Connecting...', 
                class: 'state-off-to-on-transitioning' 
            },
            on: { 
                text: 'Disconnect', 
                class: 'state-on' 
            },
            onToOffTransitioning: { 
                text: 'Disconnecting...', 
                class: 'state-on-to-off-transitioning' 
            }
        };

        // Callbacks for state changes
        this._onClickOff = null;
        this._onClickOn = null;
    }

    static get observedAttributes() {
        return [
            'state', 
            'off-text', 
            'on-text', 
            'off-to-on-transitioning-text', 
            'on-to-off-transitioning-text'
        ];
    }

    async connectedCallback() {
        // Load the component-specific CSS
        const csstext = await fetch('./components/tristate-button.css');
        const css = await csstext.text();
        this.render(css);
        this.setupEventListeners();

        enableTooltips(this.shadowRoot);
    }

    attributeChangedCallback(name, oldValue, newValue) {
        switch(name) {
            case 'state':
                this.updateButtonState(newValue);
                break;
            case 'off-text':
                this._states.off.text = newValue;
                this.updateButtonText();
                break;
            case 'on-text':
                this._states.on.text = newValue;
                this.updateButtonText();
                break;
            case 'off-to-on-transitioning-text':
                this._states.offToOnTransitioning.text = newValue;
                this.updateButtonText();
                break;
            case 'on-to-off-transitioning-text':
                this._states.onToOffTransitioning.text = newValue;
                this.updateButtonText();
                break;
        }
    }

    render(css) {
        const currentState = this.getAttribute('state') || 'off';
        const currentStateConfig = this._states[currentState];

        this.shadowRoot.innerHTML = `
            <style>${css}</style>
            <button 
                class="tristate-button ${currentStateConfig.class}" 
            >
                ${currentStateConfig.text}
            </button>
        `;
    }

    setupEventListeners() {
        const button = this.shadowRoot.querySelector('.tristate-button');
        
        button.addEventListener('click', async () => {
            const currentState = this.getAttribute('state') || 'off';
            
            try {
                if (currentState === 'off') {
                    this.setAttribute('state', 'offToOnTransitioning');
                    
                    if (this._onClickOff) {
                        await this._onClickOff();
                    }
                    
                    this.setAttribute('state', 'on');
                } else if (currentState === 'on') {
                    this.setAttribute('state', 'onToOffTransitioning');
                    
                    if (this._onClickOn) {
                        await this._onClickOn();
                    }
                    
                    this.setAttribute('state', 'off');
                }
            } catch (error) {
                // Revert to previous state if an error occurs
                this.setAttribute('state', currentState);
                console.error('State transition failed:', error);
            }
        });
    }

    updateButtonState(state) {
        const button = this.shadowRoot.querySelector('.tristate-button');
        
        // Remove previous state classes
        Object.values(this._states).forEach(stateConfig => {
            button.classList.remove(stateConfig.class);
        });
        
        // Add current state class
        button.classList.add(this._states[state].class);
        this.updateButtonText();
    }

    updateButtonText() {
        const button = this.shadowRoot.querySelector('.tristate-button');
        const currentState = this.getAttribute('state') || 'off';
        try
        {
            button.textContent = this._states[currentState].text;
        }
        catch(err) {}
    }

    // Set custom click handlers
    setOnClickOff(handler) {
        this._onClickOff = handler;
    }

    setOnClickOn(handler) {
        this._onClickOn = handler;
    }

    // Allow programmatic state changes
    setState(state) {
        this.setAttribute('state', state);
    }
}

// Define the custom element
customElements.define('tristate-button', TristateButton);

export default TristateButton;