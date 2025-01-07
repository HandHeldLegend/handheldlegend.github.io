class IMUDataDisplay extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });

        // Configuration for the sensors
        this._config = {
            gyro: {
                x: { min: -2000, max: 2000, color: '#ff4444' },
                y: { min: -2000, max: 2000, color: '#44ff44' },
                z: { min: -2000, max: 2000, color: '#4444ff' }
            },
            accel: {
                x: { min: -16, max: 16, color: '#ff8888' },
                y: { min: -16, max: 16, color: '#88ff88' },
                z: { min: -16, max: 16, color: '#8888ff' }
            }
        };

        // Current sensor values
        this._values = {
            gyro: { x: 0, y: 0, z: 0 },
            accel: { x: 0, y: 0, z: 0 }
        };
    }

    async connectedCallback() {
        // Load the component-specific CSS
        const csstext = await fetch('./components/imu-data-display.css');
        const css = await csstext.text();
        this.render(css);
        this.setupAnimationFrame();
    }

    render(css) {
        this.shadowRoot.innerHTML = `
            <style>${css}</style>
            <div class="imu-display">
                <div class="sensor-group gyro">
                    <h3>Gyroscope</h3>
                    <div class="bar-container">
                        <div class="axis-label">X</div>
                        <div class="bar-wrapper">
                            <div class="bar-scale"></div>
                            <div class="bar gyro-x">
                                <div class="bar-fill negative"></div>
                                <div class="bar-fill positive"></div>
                                <div class="center-line"></div>
                            </div>
                        </div>

                    </div>
                    <div class="bar-container">
                        <div class="axis-label">Y</div>
                        <div class="bar-wrapper">
                            <div class="bar-scale"></div>
                            <div class="bar gyro-y">
                                <div class="bar-fill negative"></div>
                                <div class="bar-fill positive"></div>
                                <div class="center-line"></div>
                            </div>
                        </div>

                    </div>
                    <div class="bar-container">
                        <div class="axis-label">Z</div>
                        <div class="bar-wrapper">
                            <div class="bar-scale"></div>
                            <div class="bar gyro-z">
                                <div class="bar-fill negative"></div>
                                <div class="bar-fill positive"></div>
                                <div class="center-line"></div>
                            </div>
                        </div>

                    </div>
                </div>

                <div class="sensor-group accel">
                    <h3>Accelerometer</h3>
                    <div class="bar-container">
                        <div class="axis-label">X</div>
                        <div class="bar-wrapper">
                            <div class="bar-scale"></div>
                            <div class="bar accel-x">
                                <div class="bar-fill negative"></div>
                                <div class="bar-fill positive"></div>
                                <div class="center-line"></div>
                            </div>
                        </div>

                    </div>
                    <div class="bar-container">
                        <div class="axis-label">Y</div>
                        <div class="bar-wrapper">
                            <div class="bar-scale"></div>
                            <div class="bar accel-y">
                                <div class="bar-fill negative"></div>
                                <div class="bar-fill positive"></div>
                                <div class="center-line"></div>
                            </div>
                        </div>

                    </div>
                    <div class="bar-container">
                        <div class="axis-label">Z</div>
                        <div class="bar-wrapper">
                            <div class="bar-scale"></div>
                            <div class="bar accel-z">
                                <div class="bar-fill negative"></div>
                                <div class="bar-fill positive"></div>
                                <div class="center-line"></div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        `;
    }

    setupAnimationFrame() {
        const updateDisplay = () => {
            this.updateBars();
            requestAnimationFrame(updateDisplay);
        };
        requestAnimationFrame(updateDisplay);
    }

    updateBars() {
        for (const sensorType of ['gyro', 'accel']) {
            for (const axis of ['x', 'y', 'z']) {
                const value = this._values[sensorType][axis];
                const config = this._config[sensorType][axis];
                const bar = this.shadowRoot.querySelector(`.${sensorType}-${axis}`);
                const valueLabel = bar.parentElement.parentElement.querySelector('.value-label');
                
                if (bar) {
                    const negFill = bar.querySelector('.bar-fill.negative');
                    const posFill = bar.querySelector('.bar-fill.positive');
                    
                    // Calculate percentage for positive and negative fills
                    const maxRange = Math.max(Math.abs(config.min), Math.abs(config.max));
                    const percentage = (Math.abs(value) / maxRange) * 50; // 50% is half the bar

                    // Update the appropriate fill based on value sign
                    if (value >= 0) {
                        posFill.style.width = `${percentage}%`;
                        negFill.style.width = '0%';
                    } else {
                        posFill.style.width = '0%';
                        negFill.style.width = `${percentage}%`;
                    }
                }
            }
        }
    }

    // Public method to update sensor values
    updateValues(sensorType, x, y, z) {
        if (this._values[sensorType]) {
            this._values[sensorType].x = x;
            this._values[sensorType].y = y;
            this._values[sensorType].z = z;
        }
    }

    disconnectedCallback() {
        // Cleanup if needed
    }
}

// Define the custom element
customElements.define('imu-data-display', IMUDataDisplay);

export default IMUDataDisplay;