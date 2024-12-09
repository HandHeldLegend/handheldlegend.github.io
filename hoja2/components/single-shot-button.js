import { enableTooltips } from "../tooltips.js";

class SingleShotButton extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        
        // Default state configurations
        this._states = {
            ready: { 
                text: 'Click Me', 
                class: 'state-ready' 
            },
            pending: { 
                text: 'Processing...', 
                class: 'state-pending' 
            }
        };

        // Callback for button action
        this._onClick = null;
    }

    static get observedAttributes() {
        return [
            'state', 
            'ready-text', 
            'pending-text'
        ];
    }

    async connectedCallback() {
        // Load the component-specific CSS
        const csstext = await fetch('./components/single-shot-button.css');
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
            case 'ready-text':
                this._states.ready.text = newValue || 'Click Me';
                this.updateButtonText();
                break;
            case 'pending-text':
                this._states.pending.text = newValue || 'Processing...';
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
            if (this.getAttribute('state') !== 'ready') 
            {
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

                // Return to ready state
                this.setAttribute('state', 'ready');
            } catch (error) {
                // Handle error and return to ready state
                console.error('Button action failed:', error);
                this.setAttribute('state', 'ready');
            } finally {
                // Ensure button is re-enabled
                button.disabled = false;
            }
        });
    }

    updateButtonState(state) {
        const button = this.shadowRoot.querySelector('.single-shot-button');
        
        // Remove previous state classes
        Object.values(this._states).forEach(stateConfig => {
            button.classList.remove(stateConfig.class);
        });
        
        // Add current state class
        button.classList.add(this._states[state].class);
        this.updateButtonText();
    }

    updateButtonText() {
        const button = this.shadowRoot.querySelector('.single-shot-button');
        const currentState = this.getAttribute('state') || 'ready';
        try 
        {
            button.textContent = this._states[currentState].text;
        }
        catch(err) {}
        
    }

    // Set custom click handler
    setOnClick(handler) {
        console.log("Click handler setup");
        this._onClick = handler;
    }
}

// Define the custom element
customElements.define('single-shot-button', SingleShotButton);

export default SingleShotButton;