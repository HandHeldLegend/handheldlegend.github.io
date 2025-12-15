class JoystickVisualizer extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.state = {
            rawX: 2048,
            rawY: 2048,
            scaledX: 2048,
            scaledY: 2048,
            angle: 0,
            distance: 0,
            scaledDistance: 0,
            tracePoints: [],
            isTracing: false,
            activeDropdown: null,
            // New state for deadzones
            deadzoneInner: 0.2, // 0.0 to 1.0
            deadzoneOuter: 0.2  // 0.0 to 1.0
        };
    }

    async connectedCallback() {
        // Load the component-specific CSS
        const csstext = await fetch('./components/joystick-visual.css');
        const cssHostResponse = await fetch('./components/host-template.css');
        const cssHost = await cssHostResponse.text();
        const css = cssHost + await csstext.text();

        // Render the component with loaded CSS
        this.render(css);
        this.setupEventListeners();
        this.drawJoystick();
    }

    render(css) {
        this.shadowRoot.innerHTML = `
            <style>${css}</style>

            <div class="joystick-container">
                <div class="joystick-display">
                    <div class="info-overlay">
                        <div class="info-left">
                            <span class="raw-coords">X: 2048, Y: 2048</span>
                        </div>
                        <div class="info-right">
                            <span class="polar-coords">∠: 0°, D: 0.00</span>
                        </div>
                    </div>
                    <canvas class="joystick-canvas"></canvas>
                </div>
                
                <div class="controls-section">
                    <div class="dropdown-container">
                        <button class="dropdown-toggle" data-dropdown="angles">
                            <span class="dropdown-label">Angles</span>
                            <span class="dropdown-arrow">▼</span>
                        </button>
                        <div class="dropdown-content" data-dropdown="angles"></div>
                    </div>
                    
                    <div class="dropdown-container">
                        <button class="dropdown-toggle" data-dropdown="settings">
                            <span class="dropdown-label">Settings</span>
                            <span class="dropdown-arrow">▼</span>
                        </button>
                        <div class="dropdown-content" data-dropdown="settings"></div>
                    </div>
                </div>
            </div>
        `;
    }

    setupEventListeners() {
        const toggleButtons = this.shadowRoot.querySelectorAll('.dropdown-toggle');
        toggleButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const dropdownType = button.getAttribute('data-dropdown');
                this.toggleDropdown(dropdownType);
            });
        });
    }

    toggleDropdown(dropdownType) {
        const allContents = this.shadowRoot.querySelectorAll('.dropdown-content');
        const allToggles = this.shadowRoot.querySelectorAll('.dropdown-toggle');
        const targetContent = this.shadowRoot.querySelector(`.dropdown-content[data-dropdown="${dropdownType}"]`);
        const targetToggle = this.shadowRoot.querySelector(`.dropdown-toggle[data-dropdown="${dropdownType}"]`);

        if (this.state.activeDropdown === dropdownType) {
            targetContent.classList.remove('open');
            targetToggle.classList.remove('active');
            this.state.activeDropdown = null;
        } else {
            allContents.forEach(content => content.classList.remove('open'));
            allToggles.forEach(toggle => toggle.classList.remove('active'));
            targetContent.classList.add('open');
            targetToggle.classList.add('active');
            this.state.activeDropdown = dropdownType;
        }
    }

    drawJoystick() {
        try {
            const canvas = this.shadowRoot.querySelector('.joystick-canvas');
            if (!canvas) return;
            
            const ctx = canvas.getContext('2d');
            const width = canvas.width = 275;
            const height = canvas.height = 275;
            const centerX = width / 2;
            const centerY = height / 2;
            const maxRadius = Math.min(centerX, centerY) - 20;

            ctx.clearRect(0, 0, width, height);

            // Draw background circle
            ctx.beginPath();
            ctx.arc(centerX, centerY, maxRadius, 0, 2 * Math.PI);
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.fillStyle = 'rgba(240, 240, 240, 0.5)';
            ctx.fill();

            // Draw Deadzones (New Function Call)
            this.drawDeadzones(ctx, centerX, centerY, maxRadius);

            // Draw center cross
            ctx.strokeStyle = '#999';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(centerX - 10, centerY);
            ctx.lineTo(centerX + 10, centerY);
            ctx.moveTo(centerX, centerY - 10);
            ctx.lineTo(centerX, centerY + 10);
            ctx.stroke();

            // Draw traced polygon
            if (this.state.tracePoints.length > 2) {
                this.drawTracedPolygon(ctx, centerX, centerY, maxRadius);
            }

            // Draw positions
            this.drawPosition(ctx, centerX, centerY, maxRadius, this.state.rawX, this.state.rawY, 'rgba(255, 51, 40, 0.79)', 8);
            this.drawPosition(ctx, centerX, centerY, maxRadius, this.state.scaledX, this.state.scaledY, 'rgba(74, 40, 255, 0.79)', 8);

            this.updateDisplays();
        } catch (err) {
            console.error('Error drawing joystick:', err);
        }
    }

    // New Helper to draw Deadzones
    drawDeadzones(ctx, centerX, centerY, maxRadius) {
        // Inner Deadzone
        if (this.state.deadzoneInner > 0) {
            const innerRadius = maxRadius * this.state.deadzoneInner;
            ctx.beginPath();
            ctx.arc(centerX, centerY, innerRadius, 0, 2 * Math.PI);
            ctx.fillStyle = 'rgba(200, 50, 50, 0.15)'; // Light red shade
            ctx.fill();
            ctx.strokeStyle = 'rgba(200, 50, 50, 0.3)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        // Outer Deadzone
        if (this.state.deadzoneOuter > 0) {
            const outerStartRadius = maxRadius * (1 - this.state.deadzoneOuter);
            
            ctx.beginPath();
            ctx.arc(centerX, centerY, maxRadius, 0, 2 * Math.PI); // Outer edge
            ctx.arc(centerX, centerY, outerStartRadius, 0, 2 * Math.PI, true); // Inner edge (anticlockwise to create hole)
            ctx.fillStyle = 'rgba(200, 50, 50, 0.15)'; // Light red shade
            ctx.fill();
            
            // Optional: Stroke the inner boundary of the outer deadzone
            ctx.beginPath();
            ctx.arc(centerX, centerY, outerStartRadius, 0, 2 * Math.PI);
            ctx.strokeStyle = 'rgba(200, 50, 50, 0.3)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    }

    drawPosition(ctx, centerX, centerY, maxRadius, x, y, color, size) {
        const normalizedX = (x - 2048) / 2048;
        const normalizedY = (y - 2048) / 2048;
        const posX = centerX + normalizedX * maxRadius;
        const posY = centerY - normalizedY * maxRadius;

        ctx.beginPath();
        ctx.arc(posX, posY, size, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    drawTracedPolygon(ctx, centerX, centerY, maxRadius) {
        if (this.state.tracePoints.length < 3) return;

        ctx.beginPath();
        this.state.tracePoints.forEach((point, index) => {
            const normalizedX = (point.x - 2048) / 2048;
            const normalizedY = (point.y - 2048) / 2048;
            const posX = centerX + normalizedX * maxRadius;
            const posY = centerY - normalizedY * maxRadius;

            if (index === 0) {
                ctx.moveTo(posX, posY);
            } else {
                ctx.lineTo(posX, posY);
            }
        });
        ctx.closePath();

        ctx.fillStyle = 'rgba(100, 200, 100, 0.3)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(50, 150, 50, 0.8)';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    updateDisplays() {
        const rawCoords = this.shadowRoot.querySelector('.raw-coords');
        const polarCoords = this.shadowRoot.querySelector('.polar-coords');

        if (rawCoords) {
            rawCoords.textContent = `X: ${this.state.rawX}, Y: ${this.state.rawY}`;
        }
        if (polarCoords) {
            polarCoords.textContent = `∠: ${this.state.angle.toFixed(2)}°, D: ${this.state.scaledDistance.toFixed(2)}`;
        }
    }

    setInput(rawX, rawY, scaledX, scaledY) {
        this.state.rawX = Math.max(0, Math.min(4096, rawX));
        this.state.rawY = Math.max(0, Math.min(4096, rawY));
        this.state.scaledX = Math.max(0, Math.min(4096, scaledX));
        this.state.scaledY = Math.max(0, Math.min(4096, scaledY));

        const dx = scaledX - 2048;
        const dy = scaledY - 2048;
        this.state.distance = Math.sqrt(dx * dx + dy * dy);
        this.state.scaledDistance = this.state.distance / 2048;

        this.state.angle = Math.atan2(dy, dx) * 180 / Math.PI;
        if (this.state.angle < 0) {
            this.state.angle += 360;
        }

        if (this.state.isTracing) {
            this.addTracePoint(scaledX, scaledY);
        }

        this.drawJoystick();
    }

    // New Public Method to Set Deadzones
    setDeadzones(inner, outer) {
        // Clamp values between 0 and 1
        this.state.deadzoneInner = Math.max(0, Math.min(1, inner));
        this.state.deadzoneOuter = Math.max(0, Math.min(1, outer));
        this.drawJoystick();
    }

    addTracePoint(x, y) {
        const newPoint = { x, y };
        
        if (this.state.tracePoints.length > 0) {
            const lastPoint = this.state.tracePoints[this.state.tracePoints.length - 1];
            const distance = Math.sqrt(
                Math.pow(x - lastPoint.x, 2) + Math.pow(y - lastPoint.y, 2)
            );
            
            if (distance < 50) return;
        }

        this.state.tracePoints.push(newPoint);
    }

    startTracing() {
        this.state.isTracing = true;
        this.state.tracePoints = [];
    }

    stopTracing() {
        this.state.isTracing = false;
    }

    resetTrace() {
        this.state.tracePoints = [];
        this.drawJoystick();
    }

    setDropdownContent(dropdownType, content) {
        const dropdown = this.shadowRoot.querySelector(`.dropdown-content[data-dropdown="${dropdownType}"]`);
        if (dropdown) {
            if (typeof content === 'string') {
                dropdown.innerHTML = content;
            } else if (content instanceof HTMLElement) {
                dropdown.innerHTML = '';
                dropdown.appendChild(content);
            }
        }
    }

    getDropdownContent(dropdownType) {
        return this.shadowRoot.querySelector(`.dropdown-content[data-dropdown="${dropdownType}"]`);
    }
}

customElements.define('joystick-visualizer', JoystickVisualizer);

export default JoystickVisualizer;