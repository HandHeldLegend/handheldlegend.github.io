class ButtonGrid extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });

        // Component state
        this._buttons = []; // Array of button labels
        this._onClick = null; // Callback function
    }

    static get observedAttributes() {
        return ['buttons'];
    }

    async connectedCallback() {
        // Load the component-specific CSS
        const csstext = await fetch('./components/button-grid.css');
        const css = await csstext.text();

        const modulecss = await fetch('./css/modules.css');
        const moduleStyles = await modulecss.text();
        
        const combined = css + moduleStyles;
        this.render(combined);
        this.setupEventListeners();
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'buttons' && oldValue !== newValue) {
            try {
                this._buttons = JSON.parse(newValue) || [];
            } catch (e) {
                console.error('Invalid buttons JSON:', e);
                this._buttons = [];
            }
            this.updateButtons();
        }
    }

    render(css) {
        this.shadowRoot.innerHTML = `
            <style>${css}</style>
            <div class="button-grid-container">
                <button class="grid-button cancel-button clickable hoverable" data-index="${-2}" data-label="Cancel">Cancel</button>
                <button class="grid-button disable-button clickable hoverable" data-index="${-1}" data-label="Unmap">None</button>
                ${this._buttons.map((label, index) => `
                    <button class="grid-button clickable hoverable" data-index="${index}" data-label="${label}">
                        ${label}
                    </button>
                `).join('')}
            </div>
        `;
    }

    setupEventListeners() {
        const buttons = this.shadowRoot.querySelectorAll('.grid-button');
        
        buttons.forEach(button => {
            button.addEventListener('click', (e) => {
                const index = parseInt(e.currentTarget.getAttribute('data-index'));
                const label = e.currentTarget.getAttribute('data-label');
                
                if (this._onClick) {
                    this._onClick({
                        index: index,
                        label: label
                    });
                }
            });
        });
    }

    updateButtons() {
        const css = this.shadowRoot.querySelector('style')?.textContent;
        if (css) {
            this.render(css);
            this.setupEventListeners();
        }
    }

    // Public API methods
    setButtons(buttonArray) {
        this._buttons = Array.isArray(buttonArray) ? buttonArray : [];
        this.setAttribute('buttons', JSON.stringify(this._buttons));
    }

    getButtons() {
        return [...this._buttons];
    }

    addButton(label) {
        this._buttons.push(label);
        this.setAttribute('buttons', JSON.stringify(this._buttons));
    }

    removeButton(index) {
        if (index >= 0 && index < this._buttons.length) {
            this._buttons.splice(index, 1);
            this.setAttribute('buttons', JSON.stringify(this._buttons));
        }
    }

    clearButtons() {
        this._buttons = [];
        this.setAttribute('buttons', JSON.stringify(this._buttons));
    }

    setOnClick(handler) {
        this._onClick = handler;
    }
}

// Define the custom element
customElements.define('button-grid', ButtonGrid);

export default ButtonGrid;