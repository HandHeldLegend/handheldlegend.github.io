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
            offToOn: { 
                text: 'Connecting...', 
                class: 'state-off-to-on' 
            },
            on: { 
                text: 'Disconnect', 
                class: 'state-on' 
            },
            onToOff: { 
                text: 'Disconnecting...', 
                class: 'state-on-to-off' 
            }
        };

        // Callbacks for state changes
        this._offToOnHandler = null;
        this._onToOffHandler = null;
    }

    static get observedAttributes() {
        return [
            'state', 
            'off-text', 
            'on-text', 
            'off-to-on-text', 
            'on-to-off-text'
        ];
    }

    async connectedCallback() {
        // Load the component-specific CSS
        const csstext = await fetch('./components/tristate-button.css');
        const css = await csstext.text();
        this.render(css);
        this.setupEventListeners();
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
            case 'off-to-on-text':
                this._states.offToOn.text = newValue;
                this.updateButtonText();
                break;
            case 'on-to-off-text':
                this._states.onToOff.text = newValue;
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
                switch(currentState)
                {
                    default:
                        break;

                    case 'off':
                        // Change to transition
                        this.setAttribute('state', 'offToOn');

                        if (this._offToOnHandler) {
                            if (await this._offToOnHandler())
                            {
                                // Change to 'on' state
                                this.setAttribute('state', 'on');
                            }
                            else 
                            {
                                // Revert back to 'off' state
                                this.setAttribute('state', 'off');
                            }
                        }
                        break;

                    case 'on':
                        // Change to transition
                        this.setAttribute('state', 'onToOff');

                        if (this._onToOffHandler) {
                            if (await this._onToOffHandler())
                            {
                                // Change to 'off' state
                                this.setAttribute('state', 'off');
                            }
                            else 
                            {
                                // Revert back to 'on' state
                                this.setAttribute('state', 'on');
                            }
                        }
                        break;
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
    setOnHandler(handler) {
        this._offToOnHandler = handler;
    }

    setOffHandler(handler) {
        this._onToOffHandler = handler;
    }

    // Allow programmatic state changes
    setState(state) {
        this.setAttribute('state', state);
    }
}

// Define the custom element
customElements.define('tristate-button', TristateButton);

export default TristateButton;