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
            disabled: {
                text: 'Disabled',
                class: 'state-disabled'
            }
        };

        // Callback for button action
        this._onClick = null;
    }

    static get observedAttributes() {
        return [
            'state', 
            'ready-text', 
            'pending-text',
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
                // Set to pending state
                this.setAttribute('state', 'pending');
                
                // Disable button
                button.disabled = true;

                // Call the onClick handler if provided
                if (this._onClick != null) {
                    await this._onClick();
                }

            } catch (error) {
                // Handle error and return to ready state
                console.error('Button action failed:', error);
                this.setAttribute('state', 'ready');
            } finally {
                // Return to ready state
                this.setAttribute('state', 'ready');
                // Ensure button is re-enabled
                button.disabled = false;
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
        catch(err) {}
    }

    // Set custom click handler
    setOnClick(handler) {
        console.log("Click handler setup");
        this._onClick = handler;
    }

    // Enable or disable the button and update its state
    enableButton(enable) {
        const newState = enable ? 'ready' : 'disabled';
        this.setAttribute('state', newState);
        const button = this.shadowRoot.querySelector('.single-shot-button');
        button.disabled = !enable;
    }
}

// Define the custom element
customElements.define('single-shot-button', SingleShotButton);

export default SingleShotButton;
