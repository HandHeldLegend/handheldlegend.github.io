class AnalogStickVisual extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.state = {
            mode: 'round', // Default mode
            x: 0,
            y: 0,
            angle: 0,
            distance: 0,
            deadzone: 200, // Deadzone in the -2048 to +2048 range
            polygonVertices: [] // For polygon mode
        };
    }

    static get observedAttributes() {
        return [
            'mode',
            'deadzone',
            'polygon-vertices'
        ];
    }

    connectedCallback() {
        this.render();
        this.setupStyles();
        this.drawAnalogStick();
    }

    attributeChangedCallback(name, oldValue, newValue) {
        switch (name) {
            case 'mode':
                this.state.mode = newValue;
                this.drawAnalogStick();
                break;
            case 'deadzone':
                this.state.deadzone = parseInt(newValue);
                this.drawAnalogStick();
                break;
            case 'polygon-vertices':
                // Expect format like "angle1,distance1;angle2,distance2;..."
                this.state.polygonVertices = this.parseVertices(newValue);
                this.drawAnalogStick();
                break;
        }
    }

    parseVertices(verticesString) {
        return verticesString.split(';').map(vertex => {
            const [angle, distance] = vertex.split(',').map(Number);
            return { angle, distance };
        });
    }

    render() {
        this.shadowRoot.innerHTML = `
            <div class="analog-stick-container">
                <div class="coordinates-display">
                    <span class="xy-coords">X: 0, Y: 0</span>
                </div>
                <div class="angle-distance-display">
                    <span class="polar-coords">∠: 0°, R: 0</span>
                </div>
                <canvas class="analog-stick-canvas"></canvas>
            </div>
        `;
    }

    setupStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .analog-stick-container {
                position: relative;
                width: 385px;
                height: 385px;
                border: 4px solid #333;
            }
            .analog-stick-canvas {
                width: 100%;
                height: 100%;
            }
            .coordinates-display {
                position: absolute;
                top: 5px;
                left: 5px;
                font-size: 12px;
            }
            .angle-distance-display {
                position: absolute;
                top: 5px;
                right: 5px;
                font-size: 12px;
            }
        `;
        this.shadowRoot.appendChild(style);
    }

    drawAnalogStick() {
        try {
            const canvas = this.shadowRoot.querySelector('.analog-stick-canvas');
            const ctx = canvas.getContext('2d');
            const width = canvas.width = canvas.clientWidth;
            const height = canvas.height = canvas.clientHeight;
            const centerX = width / 2;
            const centerY = height / 2;
            const maxStickRange = 2048; // Full range of analog stick

            // Clear canvas
            ctx.clearRect(0, 0, width, height);

            // Draw analog stick boundary
            if (this.state.mode === 'round') {
                ctx.beginPath();
                ctx.arc(centerX, centerY, Math.min(centerX, centerY) - 10, 0, 2 * Math.PI);
                ctx.strokeStyle = 'darkgray';
                ctx.stroke();
                ctx.fillStyle = 'rgba(167, 206, 255, 0.5)';
                ctx.fill();
            } else if (this.state.mode === 'polygon' && this.state.polygonVertices.length) {
                this.drawPolygonBoundary(ctx, centerX, centerY, maxStickRange);
            }

            // Draw deadzone (now proportional to the full range)
            const deadzoneRadius = (this.state.deadzone / maxStickRange) * Math.min(centerX, centerY);
            ctx.beginPath();
            ctx.arc(centerX, centerY, deadzoneRadius, 0, 2 * Math.PI);
            ctx.strokeStyle = 'darkgray';
            ctx.fillStyle = 'rgba(255, 167, 212, 0.5)';
            ctx.stroke();
            ctx.fill();

            // Draw current position marker
            this.drawCurrentPosition(ctx, centerX, centerY, maxStickRange);

            // Update coordinate displays
            this.updateDisplays();
        }
        catch (err) {

        }
    }

    drawPolygonBoundary(ctx, centerX, centerY, maxStickRange) {
        const maxRadius = Math.min(centerX, centerY) - 10;
        ctx.beginPath();

        this.state.polygonVertices.forEach((vertex, index) => {
            // Scale the distance based on the full analog stick range
            const scaledDistance = (vertex.distance / maxStickRange) * maxRadius;
            const x = centerX + scaledDistance * Math.cos(vertex.angle * Math.PI / 180);
            const y = centerY + scaledDistance * Math.sin(vertex.angle * Math.PI / 180);

            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });

        ctx.closePath();
        ctx.strokeStyle = 'darkgray';
        ctx.stroke();

        ctx.fillStyle = 'rgba(167, 206, 255, 0.5)';
        ctx.fill();
    }

    drawCurrentPosition(ctx, centerX, centerY, maxStickRange) {
        const { x, y } = this.state;
        // Scale the position based on the full analog stick range
        const posX = centerX + (x / maxStickRange) * (Math.min(centerX, centerY) - 10);
        // Invert the Y coordinate by subtracting instead of adding
        const posY = centerY + (y / maxStickRange) * (Math.min(centerX, centerY) - 10);
    
        // Determine marker color based on deadzone
        ctx.beginPath();
        ctx.arc(posX, posY, 7, 0, 2 * Math.PI);
        ctx.fillStyle = Math.abs(x) > this.state.deadzone || Math.abs(y) > this.state.deadzone
            ? 'rgba(74, 40, 255, 0.79)'  // Blue when outside deadzone
            : 'rgba(255, 51, 40, 0.79)'; // Red when inside deadzone
        ctx.fill();
    }

    updateDisplays() {
        const xyCoords = this.shadowRoot.querySelector('.xy-coords');
        const polarCoords = this.shadowRoot.querySelector('.polar-coords');

        xyCoords.textContent = `X: ${this.state.x}, Y: ${this.state.y}`;
        polarCoords.textContent = `A: ${this.state.angle.toFixed(2)}°, D: ${this.state.distance.toFixed(2)}`;
    }

    // Public method to set analog input
    setAnalogInput(x, y) {
        // Clamp values
        x = Math.max(-2048, Math.min(2048, x));
        y = Math.max(-2048, Math.min(2048, y));

        this.state.x = x;
        this.state.y = y;

        // Calculate polar coordinates
        this.state.distance = Math.sqrt(x * x + y * y);
        this.state.angle = Math.atan2(y, x) * 180 / Math.PI;

        this.drawAnalogStick();
    }

    #sortAndFilterAnglemap(anglemapArray) {
        // Filter out objects where the distance is less than 1000
        const filteredArray = anglemapArray.filter(item => item.distance >= 1000);
    
        // Sort the filtered array by the output (angle)
        const sortedArray = filteredArray.sort((a, b) => a.output - b.output);
    
        // Structure the result into a single array of objects
        return sortedArray.map(item => ({
            angle: item.output,    // Rename output to angle
            distance: item.distance // Rename distance to vertex
        }));
    }

    // Public method to set polygon vertices
    setPolygonVertices(anglemapArray) {
        let vertices = this.#sortAndFilterAnglemap(anglemapArray);
        this.state.polygonVertices = vertices;
        this.drawAnalogStick();
    }

    // Public method to set mode
    setMode(mode) {
        this.setAttribute('mode', mode);
    }

    // Public method to set deadzone
    setDeadzone(size) {
        this.setAttribute('deadzone', size);
    }
}

// Define the custom element
customElements.define('analog-stick', AnalogStickVisual);

export default AnalogStickVisual;