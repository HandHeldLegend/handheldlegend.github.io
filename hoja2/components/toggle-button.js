class ToggleButton extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    // Default configuration if not specified
    static get defaultConfig() {
        return {
            autoRelease: true,
            offText: "Off",
            onText: "On",
            waitingText: "Waiting",
            defaultValue: 0,
            formatter: (value) => value.toString()
        };
    }

    // Observed attributes for configuration
    static get observedAttributes() {
        return [
            'auto_release', 
            'off_text', 
            'on_text', 
            'waiting_text',
            'default_value'
        ];
    }

    async connectedCallback() {
         // Load the component-specific CSS
         const csstext = await fetch('./components/toggle-button.css');
         const css = await csstext.text();

         // Render the component with loaded CSS
         this.render(css);
         this.setupEventListeners();
    }

    // Parse configuration from attributes
    getConfig() {
        return {
            autoRelease:    this.getAttribute('auto_release')   || ToggleButton.defaultConfig.autoRelease,
            offText:        this.getAttribute('off_text')       || ToggleButton.defaultConfig.offText,
            onText:         this.getAttribute('on_text')        || ToggleButton.defaultConfig.onText,
            waitingText:    this.getAttribute('waiting_text')   || ToggleButton.defaultConfig.waitingText,
            defaultValue:   this.getAttribute('default_value')  || ToggleButton.defaultConfig.defaultValue,
        };
    }

    render(css) {
        const config = this.getConfig();

        this.shadowRoot.innerHTML = `
            <style>${css}</style>
            <div>

            </div>
        `;
    }

    setupEventListeners() {
        // Event listeners go here
    }
}

// Define the custom element
customElements.define('toggle-button', ToggleButton);

export default ToggleButton;