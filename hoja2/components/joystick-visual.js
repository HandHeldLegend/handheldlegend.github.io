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
            tracePoints: {}, // Object with index keys (0 to 359)
            isTracing: false,
            // New state for deadzones
            deadzoneInner: 0.2, // 0.0 to 1.0
            deadzoneOuter: 0.2  // 0.0 to 1.0 
        };
        this._axisOutputScaler = 1.0;
        this._axisOutputRoundingPoints = 0;
        this._meleeMode = false;
    }

    async connectedCallback() {
        // Load the component-specific CSS
        const csstext = await fetch('./components/joystick-visual.css');
        const css = await csstext.text();

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
            </div>
        `;
    }

    setupEventListeners() {

    }

    drawJoystick() {
        try {
            const canvas = this.shadowRoot.querySelector('.joystick-canvas');
            if (!canvas) return;

            const ctx = canvas.getContext('2d');
            const width = canvas.width = 330;
            const height = canvas.height = 330;
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

            // Draw traced polygon
            if (Object.keys(this.state.tracePoints).length > 2) {
                this.drawTracedPolygon(ctx, centerX, centerY, maxRadius);
            }

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



            // Draw positions
            this.drawPosition(ctx, centerX, centerY, maxRadius, this.state.rawX, this.state.rawY, 'rgba(255, 51, 40, 0.79)', 6);
            this.drawPosition(ctx, centerX, centerY, maxRadius, this.state.scaledX, this.state.scaledY, 'rgba(74, 40, 255, 0.79)', 6);

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
        ctx.strokeStyle = 'none';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    drawTracedPolygon(ctx, centerX, centerY, maxRadius) {
        const indices = Object.keys(this.state.tracePoints).map(k => parseInt(k));
        if (indices.length < 3) return;

        // Sort indices numerically
        const sortedIndices = indices.sort((a, b) => a - b);

        ctx.beginPath();
        sortedIndices.forEach((index, i) => {
            const point = this.state.tracePoints[index];
            const normalizedX = (point.x - 2048) / 2048;
            const normalizedY = (point.y - 2048) / 2048;
            const posX = centerX + normalizedX * maxRadius;
            const posY = centerY - normalizedY * maxRadius;

            if (i === 0) {
                ctx.moveTo(posX, posY);
            } else {
                ctx.lineTo(posX, posY);
            }
        });
        ctx.closePath();

        // Fill the polygon
        ctx.fillStyle = 'rgba(100, 200, 100, 0.3)';
        ctx.fill();

        // Stroke the outer perimeter only
        ctx.strokeStyle = 'rgba(100, 200, 100, 0.8)';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    getMeleeCoordinates(x, y) {
        const CLAMP_RADIUS = 80;

        // 1. Calculate magnitude to check if clamping is necessary
        const magnitude = Math.sqrt(x * x + y * y);

        // 2. Clamp to the CLAMP_RADIUS (80) if the input exceeds it
        const scale = magnitude > CLAMP_RADIUS ? (CLAMP_RADIUS / magnitude) : 1.0;

        // 3. Truncate toward zero (as per the clampCoordinates logic in stickmap.js)
        const clampedX = Math.trunc(x * scale);
        const clampedY = Math.trunc(y * scale);

        // 4. Convert to Melee's 0.0125 unit format (input / 80)
        // and format to exactly 4 decimal places.
        const finalX = (clampedX / CLAMP_RADIUS).toFixed(4);
        const finalY = (clampedY / CLAMP_RADIUS).toFixed(4);

        return {
            x: finalX,
            y: finalY
        };
    }

    updateDisplays() {
        const rawCoords = this.shadowRoot.querySelector('.raw-coords');
        const polarCoords = this.shadowRoot.querySelector('.polar-coords');

        if (rawCoords) {
            const fullX = this.state.scaledX - 2048;
            const fullY = this.state.scaledY - 2048;

            let scaledX;
            let scaledY;

            let outX
            let outY;

            if (this._meleeMode == true) {
                scaledX = fullX * 0.0537109375;
                scaledY = fullY * 0.0537109375;

                // Round to no decimal places
                scaledX = Math.round(scaledX);
                scaledY = Math.round(scaledY);

                // Cut off values higher than 80 or lower than -80
                if (scaledX < -80) scaledX = -80;
                if (scaledY < -80) scaledY = -80;

                if (scaledX > 80) scaledX = 80;
                if (scaledY > 80) scaledY = 80;

                let {x, y} = this.getMeleeCoordinates(scaledX, scaledY);

                outX = x;
                outY = y;
            }
            else {
                // Apply scaling
                scaledX = fullX * this._axisOutputScaler;
                scaledY = fullY * this._axisOutputScaler;

                // Add scaled center 
                // Round according to rounding points
                outX = Math.round(scaledX * Math.pow(10, this._axisOutputRoundingPoints)) / Math.pow(10, this._axisOutputRoundingPoints);
                outY = Math.round(scaledY * Math.pow(10, this._axisOutputRoundingPoints)) / Math.pow(10, this._axisOutputRoundingPoints);
            }

            // If not melee mode, show the rounded values
            outX = outX.toString();
            outY = outY.toString();
            rawCoords.textContent = `X: ${outX}, Y: ${outY}`;
        }

        let angle = this.state.angle.toFixed(1);
        if (angle === '360.0') angle = '0.0'; // Snaps 360 back to 0

        if (polarCoords) {
            polarCoords.textContent = `∠: ${angle}°, D: ${this.state.scaledDistance.toFixed(2)}`;
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

        let angle = Math.atan2(dy, dx) * 180 / Math.PI;
        if (angle < 0) angle += 360;

        // Snaps 360 back to 0
        this.state.angle = angle % 360;

        if (this.state.isTracing) {
            this.addTracePoint(scaledX, scaledY);
        }

        this.drawJoystick();
    }

    // New Public Method to Set Deadzones
    setDeadzones(inner, outer) {
        // Scale deadzones from 
        let inZone = inner / 2048.0;
        let outZone = outer / 2048.0;

        // Clamp values between 0 and 1
        this.state.deadzoneInner = Math.max(0, Math.min(1, inZone));
        this.state.deadzoneOuter = Math.max(0, Math.min(1, outZone));
        this.drawJoystick();
    }

    addTracePoint(x, y) {
        const dx = x - 2048;
        const dy = y - 2048;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Calculate angle (0 to 359.99...)
        let angle = Math.atan2(dy, dx) * 180 / Math.PI;
        if (angle < 0) angle += 360;

        // FIX: Map 360 degrees into 180 buckets (0-179)
        // We divide by 2 FIRST, then floor it.
        const normalizedIndex = Math.floor(angle / 2);

        const existingPoint = this.state.tracePoints[normalizedIndex];

        // Only update if the new point is further out than the current recorded point
        if (!existingPoint || distance > existingPoint.distance) {
            this.state.tracePoints[normalizedIndex] = { x, y, distance };
        }
    }

    setAxisOutputScaler(value) {
        this._axisOutputScaler = value;
        this.updateDisplays();
    }

    setAxisOutputRoundingPoints(value) {
        this._axisOutputRoundingPoints = value;
        this.updateDisplays();
    }

    setMeleeMode(value) {
        this._meleeMode = value == true ? true : false;
    }

    startTracing() {
        this.state.isTracing = true;
        this.state.tracePoints = {};
    }

    stopTracing() {
        this.state.isTracing = false;
    }

    resetTrace() {
        this.state.tracePoints = {};
        this.drawJoystick();
    }

    // Get the number of unique angles tracked
    getTracePointCount() {
        return Object.keys(this.state.tracePoints).length;
    }
}

customElements.define('joystick-visualizer', JoystickVisualizer);

export default JoystickVisualizer;