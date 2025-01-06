class SingleShotButton extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });

        // Default state configurations
        this._states = {
            ready: { 
                text: 'Start', 
                class: 'state-ready' 
            },
            pending: { 
                text: 'Loading...', 
                class: 'state-pending' 
            }, 
            success: {
                text: 'Success!',
                class: 'state-success'
            },
            failure: {
                text: 'Failed!',
                class: 'state-failure'
            },
            disabled: {
                text: 'Disabled',
                class: 'state-disabled'
            }
        };

        // Callback for button action
        this._onClick = null;
        // Timer for auto-transition
        this._stateTimer = null;
    }

    static get observedAttributes() {
        return [
            'state', 
            'ready-text', 
            'pending-text',
            'success-text',
            'failure-text',
            'disabled-text'
        ];
    }

    async connectedCallback() {
        // Load the component-specific CSS
        const csstext = await fetch('./components/single-shot-button.css');
        const css = await csstext.text();
        this.render(css);
        this.setupEventListeners();
    }

    attributeChangedCallback(name, oldValue, newValue) {
        switch(name) {
            case 'state':
                this.updateButtonState(newValue);
                break;
            case 'ready-text':
                this._states.ready.text = newValue || 'Start';
                this.updateButtonText();
                break;
            case 'pending-text':
                this._states.pending.text = newValue || 'Loading...';
                this.updateButtonText();
                break;
            case 'success-text':
                this._states.success.text = newValue || 'Success!';
                this.updateButtonText();
                break;
            case 'failure-text':
                this._states.failure.text = newValue || 'Failed!';
                this.updateButtonText();
                break;
            case 'disabled-text':
                this._states.disabled.text = newValue || 'Disabled';
                this.updateButtonText();
                break;
        }
    }

    render(css) {
        const currentState = this.getAttribute('state') || 'ready';
        const currentStateConfig = this._states[currentState];

        this.shadowRoot.innerHTML = `
            <style>${css}</style>
            <button 
                class="single-shot-button ${currentStateConfig.class}" 
            >
                ${currentStateConfig.text}
            </button>
        `;
    }

    setupEventListeners() {
        const button = this.shadowRoot.querySelector('.single-shot-button');

        button.addEventListener('click', async () => {
            // Prevent multiple clicks while processing
            if (this.getAttribute('state') !== 'ready') {
                return;
            }

            try {
                // Clear any existing timers
                if (this._stateTimer) {
                    clearTimeout(this._stateTimer);
                }

                // Set to pending state
                this.setAttribute('state', 'pending');
                
                // Disable button
                button.disabled = true;

                // Call the onClick handler if provided
                if (this._onClick != null) {
                    const result = await this._onClick();
                    
                    // Set success or failure state based on result
                    const resultState = result ? 'success' : 'failure';
                    this.setAttribute('state', resultState);

                    // Set timer to return to ready state after 1 second
                    this._stateTimer = setTimeout(() => {
                        this.setAttribute('state', 'ready');
                        button.disabled = false;
                    }, 1000);

                    return;
                }

            } catch (error) {
                // Handle error and show failure state
                console.error('Button action failed:', error);
                this.setAttribute('state', 'failure');
                
                // Set timer to return to ready state after 1 second
                this._stateTimer = setTimeout(() => {
                    this.setAttribute('state', 'ready');
                    button.disabled = false;
                }, 1000);
            }
        });
    }

    updateButtonState(state) {
        const button = this.shadowRoot.querySelector('.single-shot-button');
        
        try {
            // Remove all state classes
            Object.values(this._states).forEach(stateConfig => {
                button.classList.remove(stateConfig.class);
            });
        
            // Add the new state class
            const currentStateConfig = this._states[state];
            if (currentStateConfig) {
                button.classList.add(currentStateConfig.class);
            }
        
            this.updateButtonText();
        }
        catch(err) {
            
        }
    }

    updateButtonText() {
        const button = this.shadowRoot.querySelector('.single-shot-button');
        const currentState = this.getAttribute('state') || 'ready';
        try {
            button.textContent = this._states[currentState].text;
        }
        catch(err) {
            
        }
    }

    // Set custom click handler
    setOnClick(handler) {
        this._onClick = handler;
    }

    // Enable or disable the button and update its state
    enableButton(enable) {
        // Clear any existing timers when enabling/disabling
        if (this._stateTimer) {
            clearTimeout(this._stateTimer);
        }
        
        const newState = enable ? 'ready' : 'disabled';
        this.setAttribute('state', newState);
        const button = this.shadowRoot.querySelector('.single-shot-button');
        button.disabled = !enable;
    }

    // Cleanup when element is removed
    disconnectedCallback() {
        if (this._stateTimer) {
            clearTimeout(this._stateTimer);
        }
    }
}

// Define the custom element
customElements.define('single-shot-button', SingleShotButton);

export default SingleShotButton;