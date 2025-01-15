import { enableTooltips } from "../js/tooltips.js";

class GroupRgbPicker extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    static get observedAttributes() {
        return ['group-name', 'color'];
    }

    async connectedCallback() {
        // Load the component-specific CSS
        const csstext = await fetch('./components/group-rgb-picker.css');

        const cssHostResponse = await fetch('./components/host-template.css');
        const cssHost = await cssHostResponse.text();
        const css = cssHost + await csstext.text();

        this.render(css);
        this.setupEventListeners();

        enableTooltips(this.shadowRoot);
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'group-name' && oldValue !== newValue) {
            this.updateGroupName();
        } else if (name === 'color' && oldValue !== newValue) {
            this.updateColor(newValue);
        }
    }

    // Render the component
    render(css) {
        const initialColor = this.getAttribute('color') || '000000';
        this.shadowRoot.innerHTML = `
            <style>${css}</style>
                <div class="group-name">${this.getAttribute('group-name') || 'Group'}</div>
                <div class="pound">#</div>
                <input 
                    tooltip="Hex format color"
                    maxlength="6"
                    pattern="[0-9A-Fa-f]*"
                    type="text" 
                    class="color-hex" 
                    value="${initialColor.toUpperCase()}" 
                />
                <div class="color-wrapper" style="background: #${initialColor};">
                    <input 
                        tooltip="Color picker"
                        type="color" 
                        class="color-picker" 
                        value="#${initialColor}" 
                    />
                </div>
        `;
    }

    // Synchronize color picker and hex input
    setupEventListeners() {
        const hexInput = this.shadowRoot.querySelector('.color-hex');
        const colorPicker = this.shadowRoot.querySelector('.color-wrapper .color-picker');
        const colorWrapper = this.shadowRoot.querySelector('.color-wrapper');

        // Real-time input enforcement
        hexInput.addEventListener('input', (event) => {
            let value = event.target.value.toUpperCase(); // Convert to uppercase for uniformity
            // Remove invalid characters
            value = value.replace(/[^0-9A-F]/g, '');
            event.target.value = value;

            if (value.length === 6) {
                const color = `#${value}`;
                colorPicker.value = color;
                colorWrapper.style.background = color;
                this.setAttribute('color', value);
                this.emitChangeEvent(value);
            }
        });

        // Update hex input and wrapper when color picker changes
        colorPicker.addEventListener('change', (event) => {
            const value = event.target.value.replace('#', '').toUpperCase();
            hexInput.value = value;
            colorWrapper.style.background = event.target.value;
            this.setAttribute('color', value);
            this.emitChangeEvent(value);
        });
    }

    // Update the group name dynamically
    updateGroupName() {
        const groupNameElement = this.shadowRoot.querySelector('.group-name');
        if (groupNameElement) {
            const groupName = this.getAttribute('group-name');
            groupNameElement.textContent = groupName;
        }
    }

    // Update the color dynamically
    updateColor(color) {
        const hexInput = this.shadowRoot.querySelector('.color-hex');
        const colorPicker = this.shadowRoot.querySelector('.color-wrapper .color-picker');
        const colorWrapper = this.shadowRoot.querySelector('.color-wrapper');

        if (hexInput && colorPicker && colorWrapper) {
            hexInput.value = color.toUpperCase();
            colorPicker.value = `#${color}`;
            colorWrapper.style.background = `#${color}`;
        }
    }

    // Emit a change event when the color changes
    emitChangeEvent(color) {
        this.dispatchEvent(
            new CustomEvent('color-change', {
                detail: { color },
            })
        );
    }

    // Set the group name programmatically
    setGroupName(name) {
        this.setAttribute('group-name', name);
    }

    // Set the color programmatically
    setColor(color) {
        if (/^[0-9A-Fa-f]{6}$/.test(color)) {
            this.setAttribute('color', color);
        }
    }
}

// Define the custom element
customElements.define('group-rgb-picker', GroupRgbPicker);

export default GroupRgbPicker;
