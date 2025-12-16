class SingleShotButton extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });

        this._currentState = 'ready';

        this._defaults = {
            ready: {
                text: 'Ready',
            },
            pending: {
                text: '...',
            },
            success: {
                text: 'OK!',
            },
            failure: {
                text: 'Error',
            },
            disabled: {
                text: 'N/A',
            }
        };

        // Default state configurations
        this._states = {
            ready: {
                class: 'ready',
                text: 'Ready',
            },
            pending: {
                class: 'pending',
                text: '...',
            },
            success: {
                class: 'success',
                text: 'OK!',
            },
            failure: {
                class: 'failure',
                text: 'Error',
            },
            disabled: {
                class: 'disabled',
                text: 'N/A',
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
            'width',
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
        switch (name) {
            case 'state':
                this.updateButtonState(newValue);
                break;
            case 'ready-text':
                this._states.ready.text = newValue || this._defaults.ready.text;
                break;
            case 'pending-text':
                this._states.pending.text = newValue || this._defaults.pending.text;

                break;
            case 'success-text':
                this._states.success.text = newValue || this._defaults.success.text;

                break;
            case 'failure-text':
                this._states.failure.text = newValue || this._defaults.failure.text;

                break;
            case 'disabled-text':
                this._states.disabled.text = newValue || this._defaults.disabled.text;

                break;
        }
    }

    render(css) {
        const currentState = this.getAttribute('state') || 'ready';
        const currentStateConfig = this._states[currentState];
        const width = this.getAttribute('width') || 60;

        this.shadowRoot.innerHTML = `
            <style>${css}</style>
            <button 
                class="single-shot-button ${currentStateConfig.class}"
                style="width:${width}px;" 
            >
                ${currentStateConfig.text}
            </button>
        `;
    }

    setupEventListeners() {
        const button = this.shadowRoot.querySelector('.single-shot-button');

        button.addEventListener('click', async () => {

            // Prevent multiple clicks while processing
            if (this._currentState !== 'ready') {
                return;
            }

            try {
                // Clear any existing timers
                if (this._stateTimer) {
                    clearTimeout(this._stateTimer);
                }

                // Set to pending state
                this.updateButtonState('pending');


                // Call the onClick handler if provided
                if (this._onClick != null) {
                    const result = await this._onClick();

                    // Set success or failure state based on result
                    const resultState = result ? 'success' : 'failure';
                    this.updateButtonState(resultState);

                    // Set timer to return to ready state after 1 second
                    this._stateTimer = setTimeout(() => {
                        this.updateButtonState('ready');
                    }, 500);

                    return;
                }
                else {
                    // Set default state
                    this.updateButtonState('failure');

                    // Set timer to return to ready state after 1 second
                    this._stateTimer = setTimeout(() => {
                        this.updateButtonState('ready');
                    }, 500);

                    return;
                }


            } catch (error) {
                // Handle error and show failure state
                console.error('Button action failed:', error);
                this.updateButtonState('failure');

                // Set timer to return to ready state after 1 second
                this._stateTimer = setTimeout(() => {
                    this.updateButtonState('ready');
                    button.disabled = false;
                }, 500);
            }
        });
    }

    updateButtonState(state) {
        const button = this.shadowRoot.querySelector('.single-shot-button');

        const stateToRemove = this._currentState;
        this._currentState = state;

        try {
            // Add the new state class
            const currentStateConfig = this._states[state];
            if (currentStateConfig) {
                button.classList.remove(stateToRemove);
                button.classList.add(currentStateConfig.class);
                button.textContent = this._states[state].text;
            }
        }
        catch (err) {
            
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