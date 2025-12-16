class MultiPositionButton extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.selected = -1;
    }

    // Observed attributes to configure labels dynamically
    static get observedAttributes() {
        return ['options', 'width', 'selected'];
    }

    async connectedCallback() {
        // Initialize selected from attribute if present
        if (this.hasAttribute('selected')) {
            this.selected = parseInt(this.getAttribute('selected'), 10);
        }

        // Load the component-specific CSS
        const csstext = await fetch('./components/multi-position-button.css');
        const css = await csstext.text();

        const modulecss = await fetch('./css/modules.css');
        const moduleStyles = await modulecss.text();

        const combined = css + moduleStyles;

        this.render(combined);
        this.setupEventListeners();
    }

    clearActiveState() {
        const buttons = this.shadowRoot.querySelectorAll('.m-item');
        buttons.forEach((button) => {
            button.classList.remove('active');
        });
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'selected' && oldValue !== newValue) {
            this.selected = parseInt(newValue, 10);
            if (this.shadowRoot.innerHTML) {
                this.setSelected(this.selected);
            }
        }
        if (name === 'options' && oldValue !== newValue) {
            this.render();
        }
    }

    getSelected() {
        return this.selected < 0 ? 0 : this.selected;
    }

    // Get labels from the `labels` attribute or default to empty
    getLabels() {
        const labels = this.getAttribute('options');
        return labels ? labels.split(',').map((label) => label.trim()) : [];
    }

    getWidth() {
        const size = parseInt(this.getAttribute('width'));
        return size ? size : 200;
    }

    getLabel() {
        return this.getAttribute('label') || ''
    }

    // Render the component
    render(css) {
        const labels = this.getLabels();
        const width = this.getWidth() / labels.length;

        const selected = this.getSelected();

        this.shadowRoot.innerHTML = `
        <style>${css}</style>
            <div class="m-container">
            ${labels
                .map(
                    (label, index) => `
                <div class="m-item ${index === selected ? 'active' : ''}" data-index="${index}" style="width:${width}px">${label}</div>
            `
                )
                .join('')}
            </div>

    `;
    }

    setSelected(index) {
        this.selected = index;

        const buttons = this.shadowRoot.querySelectorAll('.m-item');
        if (this.selected < 0 || this.selected >= buttons.length) {
            this.selected = 0;
            return;
        }

        this.clearActiveState();
        buttons[index].classList.add('active');
    }

    // Get the current state of the button
    getState() {
        const buttons = this.shadowRoot.querySelectorAll('.m-item');
        let currentIndex = -1;
        let currentLabel = null;

        buttons.forEach((button, index) => {
            if (index === this.selected) {
                currentIndex = index;
                currentLabel = button.textContent;
            }
        });

        return {
            selectedIndex: currentIndex,
            selectedLabel: currentLabel,
        };
    }

    // Setup event listeners for button clicks
    setupEventListeners() {
        const buttons = this.shadowRoot.querySelectorAll('.m-item');
        buttons.forEach((button) => {
            button.addEventListener('click', (event) => {
                this.clearActiveState();
                button.classList.add('active');
                const index = button.dataset.index;
                this.selected = parseInt(index, 10);
                this.dispatchEvent(
                    new CustomEvent('change', {
                        detail: {
                            selectedIndex: this.selected,
                            selectedLabel: button.textContent,
                        },
                    })
                );
            });
        });
    }

}

// Define the custom element
customElements.define('multi-position-button', MultiPositionButton);

export default MultiPositionButton;