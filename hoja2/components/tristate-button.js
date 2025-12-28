class TristateButton extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });

        this._currentState = 'off';

        this._defaults = {
            off: {
                text: 'Enable',
            },
            offToOn: {
                text: 'Enabling',
            },
            on: {
                text: 'Disable',
            },
            onToOff: {
                text: 'Disabling',
            },
            disabled: {
                text: 'N/A',
            }
        };

        // Default state configurations
        this._states = {
            off: {
                class: 'off',
                text: 'Enable',
            },
            offToOn: {
                class: 'off-to-on',
                text: 'Enabling',
            },
            on: {
                class: 'on',
                text: 'Disable',
            },
            onToOff: {
                class: 'on-to-off',
                text: 'Disabling',
            },
            disabled: {
                class: 'disabled',
                text: 'N/A',
            }
        };

        // Callbacks for state changes
        this._offToOnHandler = null;
        this._onToOffHandler = null;
    }

    static get observedAttributes() {
        return [
            'state',
            'width',
            'off-text',
            'on-text',
            'off-to-on-text',
            'on-to-off-text',
            'disabled-text',
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
        switch (name) {
            case 'state':
                this.updateButtonState(newValue);
                break;
            case 'off-text':
                this._states.off.text = newValue || this._defaults.off.text;
                break;
            case 'on-text':
                this._states.on.text = newValue || this._defaults.on.text;
                break;
            case 'off-to-on-text':
                this._states.offToOn.text = newValue || this._defaults.offToOn.text;
                break;
            case 'on-to-off-text':
                this._states.onToOff.text = newValue || this._defaults.onToOff.text;
                break;
            case 'disabled-text':
                this._states.disabled.text = newValue || this._defaults.disabled.text;
                break;
        }
    }

    render(css) {
        const currentState = this.getAttribute('state') || 'off';
        const currentStateConfig = this._states[currentState];
        const width = this.getAttribute('width') || 120;

        this.shadowRoot.innerHTML = `
            <style>${css}</style>
            <button 
                class="tristate-button ${currentStateConfig.class}"
                style="width:${width}px;" 
            >
                ${currentStateConfig.text}
            </button>
        `;
    }

    setupEventListeners() {
        const button = this.shadowRoot.querySelector('.tristate-button');

        button.addEventListener('click', async () => {

            if(this._currentState === 'disabled') return;

            // Prevent clicks during transition states
            if (this._currentState === 'offToOn' || this._currentState === 'onToOff') {
                return;
            }

            try {
                switch (this._currentState) {
                    case 'off':
                        if (this._offToOnHandler) {
                            // Change to transition state
                            this.updateButtonState('offToOn');

                            const result = await this._offToOnHandler();

                            if (result) {
                                // Change to 'on' state
                                this.updateButtonState('on');
                            } else {
                                // Revert back to 'off' state
                                this.updateButtonState('off');
                            }
                        } else {
                            // No handler, just toggle to on
                            this.updateButtonState('on');
                        }
                        break;

                    case 'on':
                        if (this._onToOffHandler) {
                            // Change to transition state
                            this.updateButtonState('onToOff');

                            const result = await this._onToOffHandler();

                            if (result) {
                                // Change to 'off' state
                                this.updateButtonState('off');
                            } else {
                                // Revert back to 'on' state
                                this.updateButtonState('on');
                            }
                        } else {
                            // No handler, just toggle to off
                            this.updateButtonState('off');
                        }
                        break;

                    default:
                        break;
                }
            } catch (error) {
                // Revert to previous stable state on error
                const revertState = this._currentState === 'offToOn' ? 'off' : 'on';
                this.updateButtonState(revertState);
                console.error('State transition failed:', error);
            }
        });
    }

    updateButtonState(state) {
        const button = this.shadowRoot.querySelector('.tristate-button');

        this._currentState = state;

        try {
            // Update the button class and text
            const currentStateConfig = this._states[state];
            if (currentStateConfig) {

                button.classList.forEach((className) => {
                    console.log(className);
                    if(className != 'tristate-button') {
                        button.classList.remove(className);
                    }
                });
                button.classList.add(currentStateConfig.class);
                button.textContent = this._states[state].text;
            }
        } catch (err) {

        }
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
        this.updateButtonState(state);
    }

    // Enable or disable the button
    enableButton(enable) {
        const button = this.shadowRoot.querySelector('.tristate-button');
        if (button) {
            button.disabled = !enable;
        }
    }

    // Cleanup when element is removed
    disconnectedCallback() {
        // Any cleanup if needed in the future
    }
}

// Define the custom element
customElements.define('tristate-button', TristateButton);

export default TristateButton;