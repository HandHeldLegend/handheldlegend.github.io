class SensorVisualization extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._isAnimating = false;
        this._scene = null;
        this._camera = null;
        this._renderer = null;
        this._model = null;
        this._lastData = {
            gyro: { x: 0, y: 0, z: 0 },
            accel: { x: 0, y: 0, z: 0 }
        };
        this._returnSpeed = 0.01; // Speed at which model returns to center
    }

    static get observedAttributes() {
        return ['model', 'scale', 'rotation-offset', 'color', 'reflectivity'];
    }

    getColor() {
        const color = this.getAttribute('color');
        if (!color) return 0x00ff00; // Default green
        // Remove # if present and convert to hex number
        return parseInt(color.replace('#', ''), 16);
    }

    getReflectivity() {
        const reflectivity = this.getAttribute('reflectivity');
        if (reflectivity === null) return 0.5;
        return Math.max(0, Math.min(1, parseFloat(reflectivity)));
    }

    createMaterial() {
        return new THREE.MeshPhongMaterial({
            color: this.getColor(),
            shininess: this.getReflectivity() * 100,
            specular: 0x111111
        });
    }

    async connectedCallback() {
        const cssText = await fetch('./components/sensor-visualization.css');
        const css = await cssText.text();

        //const threeScript = await fetch('./libs/three.min.js');
        //const stlScript = await fetch('./libs/STLLoader.js');

        await this.loadThreeJS();
        this.render(css);
        await this.setupScene();
        this.setupEventListeners();
        this.startAnimation();
    }

    disconnectedCallback() {
        this.stopAnimation();

        // Properly dispose of Three.js resources
        if (this._scene) {
            // Dispose of materials and geometries
            this._scene.traverse((object) => {
                if (object.isMesh) {
                    if (object.geometry) {
                        object.geometry.dispose();
                    }
                    if (object.material) {
                        if (Array.isArray(object.material)) {
                            object.material.forEach(material => material.dispose());
                        } else {
                            object.material.dispose();
                        }
                    }
                }
            });

            // Clear the scene
            while (this._scene.children.length > 0) {
                this._scene.remove(this._scene.children[0]);
            }
        }

        // Dispose of the renderer
        if (this._renderer) {
            this._renderer.dispose();
            this._renderer = null;
        }

        // Clear references
        this._scene = null;
        this._camera = null;
        this._model = null;
    }

    async loadThreeJS() {
        // First load Three.js core from CDN
        await new Promise((resolve, reject) => {
            if (window.THREE) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            // Use absolute path - adjust these URLs to match your server's structure
            // Assuming scripts are in a 'libs' directory relative to where this component is served
            script.src = './libs/three.min.js';
            script.onload = () => resolve();
            script.onerror = (e) => {
                console.error('Failed to load Three.js:', e);
                reject(new Error('Failed to load Three.js'));
            };
            document.head.appendChild(script);
        });

        // Then load STL loader
        await new Promise((resolve, reject) => {
            if (window.THREE.STLLoader) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            // Use absolute path
            script.src = './libs/STLLoader.js';
            script.onload = () => resolve();
            script.onerror = (e) => {
                console.error('Failed to load STLLoader:', e);
                reject(new Error('Failed to load STLLoader'));
            };
            document.head.appendChild(script);
        });
    }

    getModelPath() {
        return this.getAttribute('model') || null;
    }

    getScale() {
        const scale = this.getAttribute('scale');
        return scale ? parseFloat(scale) : 1.0;
    }

    getRotationOffset() {
        const offset = this.getAttribute('rotation-offset');
        if (!offset) return { x: 0, y: 0, z: 0 };

        const [x, y, z] = offset.split(',').map(v => parseFloat(v) || 0);
        return { x, y, z };
    }

    render(styles) {
        this.shadowRoot.innerHTML = `
            <style>${styles}</style>
            <div class="sensor-visualization-container">
                <canvas class="visualization-canvas"></canvas>
            </div>
        `;
    }

    async loadModel(modelPath, scale) {
        if (!modelPath) return null;

        const loader = new THREE.STLLoader();
        try {
            const geometry = await new Promise((resolve, reject) => {
                loader.load(
                    modelPath,
                    resolve,
                    undefined,
                    reject
                );
            });

            const mesh = new THREE.Mesh(geometry, this.createMaterial());
            mesh.scale.set(scale, scale, scale);

            // Center the model
            geometry.computeBoundingBox();
            const center = new THREE.Vector3();
            geometry.boundingBox.getCenter(center);
            geometry.translate(-center.x, -center.y, -center.z);

            return mesh;
        } catch (error) {
            console.error('Failed to load STL model:', error);
            return this.createFallbackCube();
        }
    }

    createFallbackCube() {
        const geometry = new THREE.BoxGeometry(2, 2, 2);
        return new THREE.Mesh(geometry, this.createMaterial());
    }

    async setupScene() {
        const container = this.shadowRoot.querySelector('.visualization-canvas');

        this._scene = new THREE.Scene();

        //this._camera = new THREE.PerspectiveCamera(
        //    75,
        //    container.clientWidth / container.clientHeight,
        //    0.1,
        //    1000
        //);

        const frustumSize = 10; // Adjust this value to control how much of the scene is visible
        const aspect = container.clientWidth / container.clientHeight;

        this._camera = new THREE.OrthographicCamera(
            frustumSize * aspect / -2, // left
            frustumSize * aspect / 2,  // right
            frustumSize / 2,          // top
            frustumSize / -2,         // bottom
            0.1,                      // near
            1000                      // far
        );

        this._camera.position.z = 10;

        this._renderer = new THREE.WebGLRenderer({
            canvas: container,
            alpha: true,
            antialias: true
        });
        this._renderer.setSize(container.clientWidth, container.clientHeight);

        // Load model or fallback to cube
        const modelPath = this.getModelPath();
        const scale = this.getScale();
        this._model = await this.loadModel(modelPath, scale);

        if (!this._model) {
            this._model = this.createFallbackCube();
        }

        // Apply initial rotation offset
        const offset = this.getRotationOffset();
        this._model.rotation.x = THREE.MathUtils.degToRad(offset.x);
        this._model.rotation.y = THREE.MathUtils.degToRad(offset.y);
        this._model.rotation.z = THREE.MathUtils.degToRad(offset.z);

        this._scene.add(this._model);

        // Add lights
        // Brighter ambient light for better base visibility
        const ambientLight = new THREE.AmbientLight(0x666666);

        // Main directional light from front
        const frontLight = new THREE.DirectionalLight(0xffffff, 0.5);
        frontLight.position.set(0, 0, 10);

        // Secondary lights for better coverage during rotation
        const leftLight = new THREE.DirectionalLight(0xffffff, 0.5);
        leftLight.position.set(-8, 0, 8);

        const rightLight = new THREE.DirectionalLight(0xffffff, 0.5);
        rightLight.position.set(8, 0, 8);

        const topLight = new THREE.DirectionalLight(0xffffff, 0.5);
        topLight.position.set(0, 8, 8);

        // Add all lights to scene
        this._scene.add(ambientLight);
        this._scene.add(frontLight);
        this._scene.add(leftLight);
        this._scene.add(rightLight);
        this._scene.add(topLight);
    }

    async attributeChangedCallback(name, oldValue, newValue) {
        if (!this._scene || !this._model) return;

        switch (name) {
            case 'model':
                if (oldValue !== newValue) {
                    const newModel = await this.loadModel(newValue, this.getScale());
                    if (newModel) {
                        this._scene.remove(this._model);
                        this._model = newModel;
                        this._scene.add(this._model);
                    }
                }
                break;
            case 'scale':
                const scale = this.getScale();
                this._model.scale.set(scale, scale, scale);
                break;
            case 'rotation-offset':
                const offset = this.getRotationOffset();
                this._model.rotation.x = THREE.MathUtils.degToRad(offset.x);
                this._model.rotation.y = THREE.MathUtils.degToRad(offset.y);
                this._model.rotation.z = THREE.MathUtils.degToRad(offset.z);
                break;
            case 'color':
            case 'reflectivity':
                // Update material properties
                if (this._model.material) {
                    this._model.material.color.setHex(this.getColor());
                    this._model.material.shininess = this.getReflectivity() * 100;
                    this._model.material.needsUpdate = true;
                }
                break;
        }
    }

    setupEventListeners() {
        window.addEventListener('resize', this.handleResize.bind(this));
    }

    handleResize() {
        // In your resize handler:
        const container = this.shadowRoot.querySelector('.visualization-canvas');
        const aspect = container.clientWidth / container.clientHeight;
        const frustumSize = 10;

        this._camera.left = frustumSize * aspect / -2;
        this._camera.right = frustumSize * aspect / 2;
        this._camera.top = frustumSize / 2;
        this._camera.bottom = frustumSize / -2;
        this._camera.updateProjectionMatrix(); // Important! Call this after changing parameters
    }

    startAnimation() {
        if (!this._isAnimating) {
            this._isAnimating = true;
            this.animate();
        }
    }

    stopAnimation() {
        this._isAnimating = false;
    }

    animate() {
        if (!this._isAnimating) return;

        requestAnimationFrame(this.animate.bind(this));

        const offset = this.getRotationOffset();

        // Add sensitivity multiplier (0.5 = half as sensitive, 0.25 = quarter as sensitive)
        const sensitivityMultiplier = 0.25;

        // Apply smooth rotation based on scaled gyro data
        this._model.rotation.x = THREE.MathUtils.lerp(
            this._model.rotation.x,
            THREE.MathUtils.degToRad((this._lastData.gyro.x * sensitivityMultiplier) + offset.x),
            0.05
        );
        this._model.rotation.y = THREE.MathUtils.lerp(
            this._model.rotation.y,
            THREE.MathUtils.degToRad((this._lastData.gyro.y * sensitivityMultiplier) + offset.y),
            0.05
        );
        this._model.rotation.z = THREE.MathUtils.lerp(
            this._model.rotation.z,
            THREE.MathUtils.degToRad((this._lastData.gyro.z * sensitivityMultiplier) + offset.z),
            0.05
        );

        // Apply return-to-center behavior using returnSpeed directly as the lerp factor
        this._lastData.gyro.x = THREE.MathUtils.lerp(this._lastData.gyro.x, 0, this._returnSpeed);
        this._lastData.gyro.y = THREE.MathUtils.lerp(this._lastData.gyro.y, 0, this._returnSpeed);
        this._lastData.gyro.z = THREE.MathUtils.lerp(this._lastData.gyro.z, 0, this._returnSpeed);

        this._renderer.render(this._scene, this._camera);
    }

    updateSensorData(buffer) {
        if (!buffer) return;

        const view = new DataView(buffer);
        const gyroScale = 70.0; // LSM6DSR scale factor for ±2000dps in mdps
        const accelScale = 0.061; // LSM6DSR scale factor for ±2g in mg

        // Update gyroscope data (first 6 bytes)
        this._lastData.gyro = {
            x: -view.getInt16(0, true) * gyroScale / 1000, // Convert to dps
            y: view.getInt16(2, true) * gyroScale / 1000,
            z: view.getInt16(4, true) * gyroScale / 1000
        };

        // Update accelerometer data (next 6 bytes)
        this._lastData.accel = {
            x: view.getInt16(6, true) * accelScale / 1000, // Convert to g
            y: view.getInt16(8, true) * accelScale / 1000,
            z: view.getInt16(10, true) * accelScale / 1000
        };
    }

}

customElements.define('sensor-visualization', SensorVisualization);

export default SensorVisualization;