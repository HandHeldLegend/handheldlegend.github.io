class MultiPositionButton extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    // Observed attributes to configure labels dynamically
    static get observedAttributes() {
        return ['labels', 'default-selected', 'label'];
    }

    async connectedCallback() {

        // Load the component-specific CSS
        const csstext = await fetch('./components/multiposition-button.css');
        const css = await csstext.text();

        this.render(css);
        this.setupEventListeners();
        this.applyDefaultSelection();
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'labels' && oldValue !== newValue) {
            this.render();
        }
    }

    // Get labels from the `labels` attribute or default to empty
    getLabels() {
        const labels = this.getAttribute('labels');
        return labels ? labels.split(',').map((label) => label.trim()) : [];
    }

    // Get the default-selected index, defaulting to 0
    getDefaultSelectedIndex() {
        const index = parseInt(this.getAttribute('default-selected'), 10);
        const labels = this.getLabels();
        return isNaN(index) || index < 0 || index >= labels.length ? 0 : index;
    }

    getLabel() {
        return this.getAttribute('label') || ''
    }

    // Render the component
    render(css) {
        const labels = this.getLabels();
        const olabel = this.getLabel();
        this.shadowRoot.innerHTML = `
            <style>${css}</style>
            ${olabel ? `<div class="label">${olabel}</div>` : ''}
            <div class="multi-position-button">
                ${labels
                  .map(
                    (label, index) => `
                    <div class="button-item" data-index="${index}">${label}</div>
                `
                  )
                  .join('')}
            </div>
        `;
    }

    // Apply default selection based on the `default-selected` attribute
    applyDefaultSelection() {
        const buttons = this.shadowRoot.querySelectorAll('.button-item');
        const defaultIndex = this.getDefaultSelectedIndex();

        if (buttons.length > 0 && buttons[defaultIndex]) {
            this.clearActiveState();
            buttons[defaultIndex].classList.add('active');

            // Emit the initial change event for the default selection
            this.dispatchEvent(
                new CustomEvent('change', {
                    detail: {
                        selectedIndex: defaultIndex,
                        selectedLabel: buttons[defaultIndex].textContent,
                    },
                })
            );
        }
    }

    setState(index) {
        const buttons = this.shadowRoot.querySelectorAll('.button-item');
        if (index < 0 || index >= buttons.length) return;

        this.clearActiveState();
        const targetButton = buttons[index];
        targetButton.classList.add('active');

        this.dispatchEvent(
            new CustomEvent('change', {
                detail: {
                    selectedIndex: index,
                    selectedLabel: targetButton.textContent,
                },
            })
        );
    }

    // Setup event listeners for button clicks
    setupEventListeners() {
        const buttons = this.shadowRoot.querySelectorAll('.button-item');
        buttons.forEach((button) => {
            button.addEventListener('click', (event) => {
                this.clearActiveState();
                button.classList.add('active');
                const index = button.dataset.index;
                this.dispatchEvent(
                    new CustomEvent('change', {
                        detail: {
                            selectedIndex: parseInt(index, 10),
                            selectedLabel: button.textContent,
                        },
                    })
                );
            });
        });
    }

    // Remove the active class from all buttons
    clearActiveState() {
        const buttons = this.shadowRoot.querySelectorAll('.button-item');
        buttons.forEach((button) => button.classList.remove('active'));
    }
}

// Define the custom element
customElements.define('multi-position-button', MultiPositionButton);

export default MultiPositionButton;