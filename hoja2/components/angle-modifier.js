class AngleModifier extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.points = [];
    }

    async connectedCallback() {
        const csstext = await fetch('./components/angle-modifier.css');
        const css = await csstext.text();
        this.render(css);
    }

    addPoint(inAngle = 0, inDist = 0) {
        if (this.points.length >= 16) return;
        this.points.push({
            inAngle,
            inDist,
            outAngle: inAngle,
            outDist: 2048,
            deadzone: 2.0
        });
        this.refresh();
        this.dispatchEvent(new CustomEvent('add', { detail: { index: this.points.length - 1 } }));
    }

    resetAll() {
        this.points = this.points.map(p => ({
            ...p,
            outAngle: p.inAngle,
            outDist: p.inDist,
            deadzone: 2.0
        }));
        this.refresh();
    }

    updateCapture(index, inAngle, inDist) {
        if (this.points[index]) {
            this.points[index].inAngle = inAngle;
            this.points[index].inDist = inDist;
            this.refresh();
        }
    }

    refresh() {
        const container = this.shadowRoot.querySelector('.rows-list');
        if (!container) return;

        container.innerHTML = this.points.map((p, i) => `
            <div class="angle-row" data-index="${i}">
                <button class="btn-action btn-cap" title="Capture Input Angle & Distance">⤓</button>
                
                <div class="in-data-grid">
                    <span class="label-micro">∠ In</span>
                    <input type="number" step="0.01" class="edit-input val-micro in-a" value="${p.inAngle.toFixed(2)}">
                    
                    <span class="label-micro">D In</span>
                    <input type="number" step="0.01" class="edit-input val-micro in-d" value="${p.inDist.toFixed(2)}">
                </div>

                <div class="input-col">
                    <span class="input-label">∠ Out</span>
                    <input title="Output Angle" type="number" step="0.01" class="edit-input out-a" value="${p.outAngle.toFixed(2)}">
                </div>

                <div class="input-col">
                    <span class="input-label">D Out</span>
                    <input title="Output Distance" type="number" step="0.01" class="edit-input out-d" value="${p.outDist.toFixed(2)}">
                </div>

                <div class="input-col">
                    <span class="input-label">∠ DZ</span>
                    <input title="Angular Deadzone (Sticky Angles)" type="number" step="0.1" class="edit-input out-z" value="${p.deadzone.toFixed(2)}">
                </div>

                <button class="btn-action btn-delete ${this.points.length <= 8 ? 'disabled' : ''}" 
                title="Remove" 
                ${this.points.length <= 8 ? 'disabled' : ''}>✕</button>
            </div>
        `).join('');

        this.bindEvents();
    }

    bindEvents() {
        this.shadowRoot.querySelectorAll('.angle-row').forEach(row => {
            const i = parseInt(row.dataset.index);

            row.querySelector('.btn-cap').onclick = () => {
                this.dispatchEvent(new CustomEvent('capture', { detail: { index: i } }));
            };

            row.querySelector('.btn-delete').onclick = () => {
                this.dispatchEvent(new CustomEvent('delete', { detail: { index: i } }));
            };

            const update = (key, val) => {
                this.points[i][key] = parseFloat(val) || 0;
                this.dispatchEvent(new CustomEvent('change', { 
                    detail: { 
                        index: i, 
                        data: this.points[i] 
                    } 
                }));
            };

            // Input Listeners
            row.querySelector('.in-a').onchange = (e) => update('inAngle', e.target.value);
            row.querySelector('.in-d').onchange = (e) => update('inDist', e.target.value);
            row.querySelector('.out-a').onchange = (e) => update('outAngle', e.target.value);
            row.querySelector('.out-d').onchange = (e) => update('outDist', e.target.value);
            row.querySelector('.out-z').onchange = (e) => update('deadzone', e.target.value);
        });
    }

    render(css) {
        this.shadowRoot.innerHTML = `
            <style>${css}</style>
            <div class="panel-container">
                <div class="rows-list"></div>
            </div>
        `;
        this.refresh();
    }
}

customElements.define('angle-modifier', AngleModifier);
export default AngleModifier;