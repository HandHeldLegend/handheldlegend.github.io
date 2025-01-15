class AxisInvertSelector extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    // Observed attributes for default inversion states
    static get observedAttributes() {
        return ['default-lx', 'default-ly', 'default-rx', 'default-ry'];
    }

    async connectedCallback() {
        // Load the component-specific CSS
        const csstext = await fetch('./components/axis-invert-selector.css');
        
        const cssHostResponse = await fetch('./components/host-template.css');
        const cssHost = await cssHostResponse.text();
        const css = cssHost + await csstext.text();

        this.render(css);
        this.setupEventListeners();
        this.applyDefaultStates();
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue !== newValue && this.shadowRoot.innerHTML) {
            this.applyDefaultStates();
        }
    }

    // Get default state for each axis
    getDefaultState(axis) {
        const value = this.getAttribute(`default-${axis.toLowerCase()}`);
        return value === 'true';
    }

    // Render the component
    render(css) {
        const axes = ['LX', 'LY', 'RX', 'RY'];
        
        this.shadowRoot.innerHTML = `
            <style>${css}</style>
            <div class="axis-container">
                ${axes.map(axis => `
                    <div class="axis-item">
                        <span class="axis-label">${axis}</span>
                        <div class="toggle-button" data-axis="${axis}">
                            <div class="toggle-state">Normal</div>
                            <div class="toggle-state">Inverted</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // Apply default states based on attributes
    applyDefaultStates() {
        const toggleButtons = this.shadowRoot.querySelectorAll('.toggle-button');
        toggleButtons.forEach(button => {
            const axis = button.dataset.axis;
            const isInverted = this.getDefaultState(axis);
            if (isInverted) {
                button.classList.add('inverted');
            } else {
                button.classList.remove('inverted');
            }
        });
    }

    // Set state for a specific axis
    setState(axis, inverted) {
        const button = this.shadowRoot.querySelector(`[data-axis="${axis}"]`);
        if (!button) return;

        if (inverted) {
            button.classList.add('inverted');
        } else {
            button.classList.remove('inverted');
        }
    }

    // Get current state of all axes
    getState() {
        const state = {};
        const toggleButtons = this.shadowRoot.querySelectorAll('.toggle-button');
        
        toggleButtons.forEach(button => {
            const axis = button.dataset.axis;
            state[axis] = button.classList.contains('inverted');
        });

        return state;
    }

    // Setup event listeners for toggle buttons
    setupEventListeners() {
        const toggleButtons = this.shadowRoot.querySelectorAll('.toggle-button');
        toggleButtons.forEach(button => {
            button.addEventListener('click', () => {
                button.classList.toggle('inverted');
                const axis = button.dataset.axis;
                const isInverted = button.classList.contains('inverted');
                
                this.dispatchEvent(new CustomEvent('change', {
                    detail: {
                        axis: axis,
                        inverted: isInverted
                    }
                }));
            });
        });
    }
}

// Define the custom element
customElements.define('axis-invert-selector', AxisInvertSelector);

export default AxisInvertSelector;