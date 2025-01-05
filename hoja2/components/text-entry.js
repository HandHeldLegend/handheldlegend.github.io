class TextEntry extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._isInternalUpdate = false;
    }

    static get observedAttributes() {
        return ['default-value', 'placeholder'];
    }

    async connectedCallback() {
        // Load the component-specific CSS
        const csstext = await fetch('./components/text-entry.css');
        const css = await csstext.text();

        this.render(css);
        this.setupEventListeners();
    }

    getDefaultValue() {
        return this.getAttribute('default-value') || '';
    }

    getPlaceholder() {
        return this.getAttribute('placeholder') || '';
    }

    render(styles) {
        const defaultValue = this.getDefaultValue();
        const placeholder = this.getPlaceholder();
        
        this.shadowRoot.innerHTML = `
            <style>${styles}</style>
            <div class="text-entry-container">
                <input 
                    type="text" 
                    class="text-input"
                    value="${defaultValue}"
                    placeholder="${placeholder}"
                >
            </div>
        `;
    }

    setupEventListeners() {
        const input = this.shadowRoot.querySelector('.text-input');

        input.addEventListener('input', (e) => {
            if (!this._isInternalUpdate) {
                this.dispatchEvent(
                    new CustomEvent('change', {
                        detail: { 
                            value: this.getValue()
                        }
                    })
                );
            }
        });

        // Select all text when focused
        input.addEventListener('focus', (e) => {
            e.target.select();
        });
    }

    getValue() {
        const input = this.shadowRoot.querySelector('.text-input');
        return input.value;
    }

    setState(value) {
        this._isInternalUpdate = true;
        const input = this.shadowRoot.querySelector('.text-input');
        input.value = value;
        this._isInternalUpdate = false;
    }

    setPlaceholder(placeholder) {
        const input = this.shadowRoot.querySelector('.text-input');
        input.placeholder = placeholder;
    }
}

customElements.define('text-entry', TextEntry);

export default TextEntry;