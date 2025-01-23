class AxisInvertSelector extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    static get observedAttributes() {
        return ['default-lx', 'default-ly', 'default-rx', 'default-ry'];
    }

    async connectedCallback() {
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

    getDefaultState(axis) {
        const value = this.getAttribute(`default-${axis.toLowerCase()}`);
        return value === 'true';
    }

    render(css) {
        const axes = ['LX', 'LY', 'RX', 'RY'];
        
        this.shadowRoot.innerHTML = `
            <style>${css}</style>
            <div class="axis-container">
                ${axes.map(axis => `
                    <div class="axis-item">
                        <span class="axis-label">${axis}</span>
                        <label class="checkbox-container" data-axis="${axis}">
                            <input type="checkbox" class="axis-checkbox">
                            <span class="checkmark"></span>
                        </label>
                    </div>
                `).join('')}
            </div>
        `;
    }

    applyDefaultStates() {
        const checkboxContainers = this.shadowRoot.querySelectorAll('.checkbox-container');
        checkboxContainers.forEach(container => {
            const axis = container.dataset.axis;
            const checkbox = container.querySelector('.axis-checkbox');
            checkbox.checked = this.getDefaultState(axis);
        });
    }

    setState(axis, inverted) {
        const checkbox = this.shadowRoot.querySelector(`[data-axis="${axis}"] .axis-checkbox`);
        if (checkbox) {
            checkbox.checked = inverted;
        }
    }

    getState() {
        const state = {};
        const checkboxContainers = this.shadowRoot.querySelectorAll('.checkbox-container');
        
        checkboxContainers.forEach(container => {
            const axis = container.dataset.axis;
            const checkbox = container.querySelector('.axis-checkbox');
            state[axis] = checkbox.checked;
        });

        return state;
    }

    setupEventListeners() {
        const checkboxContainers = this.shadowRoot.querySelectorAll('.checkbox-container');
        checkboxContainers.forEach(container => {
            const checkbox = container.querySelector('.axis-checkbox');
            checkbox.addEventListener('change', () => {
                const axis = container.dataset.axis;
                
                this.dispatchEvent(new CustomEvent('change', {
                    detail: {
                        axis: axis,
                        inverted: checkbox.checked
                    }
                }));
            });
        });
    }
}

customElements.define('axis-invert-selector', AxisInvertSelector);

export default AxisInvertSelector;