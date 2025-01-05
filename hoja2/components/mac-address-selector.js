class MacAddressSelector extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._isInternalUpdate = false;
    }

    static get observedAttributes() {
        return ['default-value'];
    }

    async connectedCallback() {
        // Load the component-specific CSS
        const csstext = await fetch('./components/mac-address-selector.css');
        const css = await csstext.text();

        this.render(css);
        this.setupEventListeners();
    }

    getDefaultValues() {
        const defaultAttr = this.getAttribute('default-value');
        if (defaultAttr) {
            return defaultAttr.split(',').map(val => val.trim());
        }
        return Array(6).fill('00');
    }

    render(styles) {
        const defaultValues = this.getDefaultValues();
        
        this.shadowRoot.innerHTML = `
            <style>${styles}</style>
            <div class="mac-input-container">
                ${Array(6).fill(0).map((_, i) => `
                    ${i > 0 ? '<span class="separator">:</span>' : ''}
                    <input 
                        type="text" 
                        class="mac-input" 
                        maxlength="2" 
                        value="${defaultValues[i]}"
                        pattern="[0-9A-Fa-f]{2}"
                        data-index="${i}"
                    >
                `).join('')}
            </div>
        `;
    }

    setupEventListeners() {
        const inputs = this.shadowRoot.querySelectorAll('.mac-input');

        inputs.forEach(input => {
            input.addEventListener('input', (e) => {
                const value = e.target.value.toUpperCase();
                const validHex = /^[0-9A-F]*$/;
                
                if (!validHex.test(value)) {
                    e.target.value = value.replace(/[^0-9A-F]/g, '');
                    return;
                }

                if (value.length === 2) {
                    const nextInput = input.nextElementSibling?.nextElementSibling;
                    if (nextInput) {
                        nextInput.focus();
                        nextInput.select();
                    }
                }

                if (!this._isInternalUpdate) {
                    this.dispatchEvent(
                        new CustomEvent('change', {
                            detail: { 
                                value: this.getValue(),
                                formattedValue: this.getFormattedValue()
                            }
                        })
                    );
                }
            });

            input.addEventListener('keydown', (e) => {
                const currentIndex = parseInt(input.dataset.index);

                // Handle backspace when input is empty
                if (e.key === 'Backspace' && input.value === '') {
                    const prevInput = input.previousElementSibling?.previousElementSibling;
                    if (prevInput) {
                        e.preventDefault();
                        prevInput.focus();
                        prevInput.select();
                    }
                }
                
                // Handle left/right arrow navigation
                if (e.key === 'ArrowLeft') {
                    const prevInput = input.previousElementSibling?.previousElementSibling;
                    if (prevInput) {
                        e.preventDefault();
                        prevInput.focus();
                        prevInput.select();
                    }
                }
                if (e.key === 'ArrowRight') {
                    const nextInput = input.nextElementSibling?.nextElementSibling;
                    if (nextInput) {
                        e.preventDefault();
                        nextInput.focus();
                        nextInput.select();
                    }
                }
            });

            // Select all text when focused
            input.addEventListener('focus', (e) => {
                e.target.select();
            });

            // Handle paste events for the entire MAC address
            input.addEventListener('paste', (e) => {
                e.preventDefault();
                const paste = (e.clipboardData || window.clipboardData).getData('text');
                const mac = paste.replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
                
                if (mac.length > 0) {
                    const values = mac.match(/.{1,2}/g) || [];
                    this.setState(values.join(','));
                }
            });
        });
    }

    getValue() {
        const inputs = this.shadowRoot.querySelectorAll('.mac-input');
        return Array.from(inputs).map(input => input.value.padStart(2, '0')).join(',');
    }

    getFormattedValue() {
        const inputs = this.shadowRoot.querySelectorAll('.mac-input');
        return Array.from(inputs).map(input => input.value.padStart(2, '0')).join(':');
    }

    setState(value) {
        this._isInternalUpdate = true;
        const values = value.split(',').map(v => v.trim());
        const inputs = this.shadowRoot.querySelectorAll('.mac-input');
        
        inputs.forEach((input, index) => {
            if (values[index]) {
                input.value = values[index].substring(0, 2).toUpperCase();
            }
        });
        
        this._isInternalUpdate = false;
    }
}

customElements.define('mac-address-selector', MacAddressSelector);

export default MacAddressSelector;