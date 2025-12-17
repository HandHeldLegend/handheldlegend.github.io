class TextEntry extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._isInternalUpdate = false;
    }

    static get observedAttributes() {
        return ['value', 'placeholder', 'maxlength'];
    }

    async connectedCallback() {
        // Load the component-specific CSS
        const csstext = await fetch('./components/text-entry.css');
        const css = await csstext.text();

        this.render(css);
        this.setupEventListeners();
    }

    getDefaultValue() {
        return this.getAttribute('value') || '';
    }

    getPlaceholder() {
        return this.getAttribute('placeholder') || '';
    }

    getMaxLength() {
        const maxLength = this.getAttribute('maxlength');
        return maxLength ? parseInt(maxLength) : null;
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
                    placeholder="✎ ${placeholder}"
                    data-maxbytes="${this.getMaxLength() || ''}"
                >
            </div>
        `;
    }

    setupEventListeners() {
        const input = this.shadowRoot.querySelector('.text-input');

        input.addEventListener('change', (e) => {
            const value = e.target.value;
            const maxBytes = this.getMaxLength();
            
            // Validate UTF-8 encoding
            try {
                // Try to encode and decode the string to verify UTF-8 compatibility
                const encoded = new TextEncoder().encode(value);
                const decoded = new TextDecoder('utf-8', {fatal: true}).decode(encoded);
                
                if (value !== decoded) {
                    // If the decoded string doesn't match the input, invalid UTF-8
                    e.target.value = this.getValue(); // Revert to last valid value
                    return;
                }

                // Check UTF-8 byte length against maxBytes
                if (maxBytes && encoded.length > maxBytes) {
                    // If the new value would exceed the byte limit, find the largest valid substring
                    let validValue = value;
                    while (validValue.length > 0) {
                        const encodedValid = new TextEncoder().encode(validValue);
                        if (encodedValid.length <= maxBytes) {
                            break;
                        }
                        validValue = validValue.slice(0, -1);
                    }
                    e.target.value = validValue;
                    return;
                }

                if (!this._isInternalUpdate) {
                    this.dispatchEvent(
                        new CustomEvent('change', {
                            detail: { 
                                value: e.target.value,
                                encodedLength: encoded.length
                            }
                        })
                    );
                }
            } catch (err) {
                // If decoding fails, the input contains invalid UTF-8
                e.target.value = this.getValue(); // Revert to last valid value
                return;
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
        // Validate UTF-8 before setting
        try {
            const encoded = new TextEncoder().encode(value);
            const decoded = new TextDecoder('utf-8', {fatal: true}).decode(encoded);
            
            const maxBytes = this.getMaxLength();
            if (maxBytes && encoded.length > maxBytes) {
                console.warn('Value exceeds maximum UTF-8 byte length');
                return false;
            }
            
            if (value === decoded) {
                this._isInternalUpdate = true;
                const input = this.shadowRoot.querySelector('.text-input');
                input.value = value;
                this._isInternalUpdate = false;
                return true;
            }
        } catch (err) {
            console.warn('Invalid UTF-8 string provided to setState');
        }
        return false;
    }

    // Get the UTF-8 byte length of the current value
    getByteLength() {
        const value = this.getValue();
        return new TextEncoder().encode(value).length;
    }

    setPlaceholder(placeholder) {
        const input = this.shadowRoot.querySelector('.text-input');
        input.placeholder = placeholder;
    }
}

customElements.define('text-entry', TextEntry);

export default TextEntry;