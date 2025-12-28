class WaveformDisplay extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });

        // Configuration
        this._axisNames = ['LX', 'LY', 'RX', 'RY'];
        this._axisColors = ['#ff4444', '#44ff44', '#4444ff', '#ff8844'];
        this._axisClasses = ['lx', 'ly', 'rx', 'ry'];

        // Current state
        this._currentAxis = 0;
        this._waveformData = [];
        this._peaks = { positive: 0, negative: 0 };
        
        // Canvas and animation
        this._canvas = null;
        this._ctx = null;
        this._animationProgress = 0;
        this._isAnimating = false;
        this._animationId = null;

        // Shadow DOM ready flag
        this._shadowReady = false;
        this._pendingData = null;
    }

    static get observedAttributes() {
        return ['width', 'height'];
    }

    async connectedCallback() {
        // Load the component-specific CSS
        try {
            const cssResponse = await fetch('./components/waveform-display.css');
            const css = await cssResponse.text();
            this.render(css);
        } catch (error) {
            // Fallback to inline styles if CSS file not found
            this.render('');
        }
        
        this._shadowReady = true;
        
        // Process any pending data
        if (this._pendingData) {
            this.loadData(this._pendingData);
            this._pendingData = null;
        }
    }

    render(css) {
        const width = this.getAttribute('width') || '400';
        const height = this.getAttribute('height') || '200';

        this.shadowRoot.innerHTML = `
            <style>
                ${css}
                :host {
                    max-width:98vw;
                    width: ${width}px;
                    height: ${height}px;
                }
            </style>
            <div class="waveform-container">
                <div class="waveform-header">
                    <div class="axis-label ${this._axisClasses[this._currentAxis]}">${this._axisNames[this._currentAxis]}</div>
                    <div class="peak-info">
                        <span class="peak-value">Peak+: <span id="peak-pos">0</span></span>
                        <span class="peak-value">Peak-: <span id="peak-neg">0</span></span>
                    </div>
                </div>
                <div class="waveform-canvas-container">
                    <canvas class="waveform-canvas" id="waveform-canvas"></canvas>
                    <div class="center-line"></div>
                </div>
            </div>
        `;

        this._canvas = this.shadowRoot.getElementById('waveform-canvas');
        this._ctx = this._canvas.getContext('2d');
        
        // Set up canvas dimensions
        this.setupCanvas();
    }

    setupCanvas() {
        if (!this._canvas) return;
        
        const rect = this._canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        this._canvas.width = rect.width * dpr;
        this._canvas.height = rect.height * dpr;
        
        this._ctx.scale(dpr, dpr);
        this._canvas.style.width = rect.width + 'px';
        this._canvas.style.height = rect.height + 'px';
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (this._shadowReady && (name === 'width' || name === 'height')) {
            this.render(this.shadowRoot.querySelector('style').textContent);
        }
    }

    // Public method to load waveform data
    loadData(buffer) {
        // If shadow DOM isn't ready, store data for later
        if (!this._shadowReady) {
            this._pendingData = buffer;
            return;
        }

        // Validate buffer
        if (!buffer || buffer.length !== 64) {
            console.warn('Invalid buffer: expected 64 bytes');
            return;
        }

        // Extract axis index (byte 1)
        const axisIndex = buffer[1];
        if (axisIndex < 0 || axisIndex > 3) {
            console.warn('Invalid axis index:', axisIndex);
            return;
        }

        // Extract waveform data (bytes 2-63 = 62 data points)
        const newWaveformData = Array.from(buffer.slice(2));
        
        // Update current axis and data
        this._currentAxis = axisIndex;
        this._waveformData = newWaveformData;
        
        // Calculate peaks (deviation from center value 128)
        this.calculatePeaks();
        
        // Update UI
        this.updateAxisLabel();
        this.updatePeakDisplay();
        
        // Animate the waveform
        this.animateWaveform();
    }

    calculatePeaks() {
        let maxPositive = 0;
        let maxNegative = 0;

        for (const value of this._waveformData) {
            const deviation = value - 128;
            if (deviation > maxPositive) {
                maxPositive = deviation;
            }
            if (deviation < maxNegative) {
                maxNegative = deviation;
            }
        }

        this._peaks = {
            positive: maxPositive,
            negative: Math.abs(maxNegative)
        };
    }

    updateAxisLabel() {
        const axisLabel = this.shadowRoot.querySelector('.axis-label');
        if (axisLabel) {
            axisLabel.textContent = this._axisNames[this._currentAxis];
            axisLabel.className = `axis-label ${this._axisClasses[this._currentAxis]}`;
        }
    }

    updatePeakDisplay() {
        const peakPos = this.shadowRoot.getElementById('peak-pos');
        const peakNeg = this.shadowRoot.getElementById('peak-neg');
        
        if (peakPos) peakPos.textContent = this._peaks.positive.toString();
        if (peakNeg) peakNeg.textContent = this._peaks.negative.toString();
    }

    animateWaveform() {
        if (this._isAnimating) {
            cancelAnimationFrame(this._animationId);
        }

        this._isAnimating = true;
        this._animationProgress = 0;

        const animate = () => {
            this._animationProgress += 0.05; // Animation speed
            
            if (this._animationProgress >= 1) {
                this._animationProgress = 1;
                this._isAnimating = false;
            }

            this.drawWaveform();

            if (this._isAnimating) {
                this._animationId = requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    }

    drawWaveform() {
        if (!this._ctx || !this._canvas) return;

        const canvasWidth = this._canvas.clientWidth;
        const canvasHeight = this._canvas.clientHeight;

        // Clear canvas
        this._ctx.clearRect(0, 0, canvasWidth, canvasHeight);

        if (this._waveformData.length === 0) return;

        // Calculate drawing parameters
        const dataPoints = this._waveformData.length;
        const stepX = canvasWidth / (dataPoints - 1);
        const centerY = canvasHeight / 2;
        const maxAmplitude = canvasHeight / 2 - 10; // Leave some margin

        // Set line style
        this._ctx.strokeStyle = this._axisColors[this._currentAxis];
        this._ctx.lineWidth = 2;
        this._ctx.lineCap = 'round';
        this._ctx.lineJoin = 'round';

        // Draw animated waveform (left to right reveal)
        const visiblePoints = Math.floor(this._animationProgress * dataPoints);
        
        if (visiblePoints > 1) {
            this._ctx.beginPath();
            
            for (let i = 0; i < visiblePoints; i++) {
                const x = i * stepX;
                const normalizedValue = (this._waveformData[i] - 128) / 127; // Normalize to -1 to 1
                const y = centerY - (normalizedValue * maxAmplitude);
                
                if (i === 0) {
                    this._ctx.moveTo(x, y);
                } else {
                    this._ctx.lineTo(x, y);
                }
            }
            
            this._ctx.stroke();
        }

        // Draw data points
        this._ctx.fillStyle = this._axisColors[this._currentAxis];
        for (let i = 0; i < visiblePoints; i++) {
            const x = i * stepX;
            const normalizedValue = (this._waveformData[i] - 128) / 127;
            const y = centerY - (normalizedValue * maxAmplitude);
            
            this._ctx.beginPath();
            this._ctx.arc(x, y, 2, 0, Math.PI * 2);
            this._ctx.fill();
        }
    }

    disconnectedCallback() {
        if (this._animationId) {
            cancelAnimationFrame(this._animationId);
        }
    }
}

// Define the custom element
customElements.define('waveform-display', WaveformDisplay);

export default WaveformDisplay;