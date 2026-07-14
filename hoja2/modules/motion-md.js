import HojaGamepad from '../js/gamepad.js';

import SensorVisualization from '../components/sensor-visualization.js';
import IMUDataDisplay from '../components/imu-data-display.js';

import TristateButton from '../components/tristate-button.js';
import SingleShotButton from '../components/single-shot-button.js';
import MultiPositionButton from '../components/multi-position-button.js';
import NumberSelector from '../components/number-selector.js';

import { enableTooltips } from '../js/tooltips.js';

/** @type {HojaGamepad} */
let gamepad = HojaGamepad.getInstance();
const gyroCfgBlockNumber = 5;
const SENSITIVITY_MIN = 50;
const SENSITIVITY_MAX = 200;
const GYRO_SENSITIVITY_DEFAULT = 120;
const ACCEL_SENSITIVITY_DEFAULT = 100;
let sensorVis = null;
let imuDisplay = null;

let debugInterval = null;
let debugTime = 0;

const AXIS_IDS = ['x', 'y', 'z'];

async function writeRemapMemBlock() {
    await gamepad.sendBlock(gyroCfgBlockNumber);
}

function clampSensitivity(value, fallback) {
    if (!value) return fallback;
    return Math.max(SENSITIVITY_MIN, Math.min(SENSITIVITY_MAX, value));
}

function readSensitivityAxes(values, fallback) {
    return AXIS_IDS.map((_, i) => clampSensitivity(values?.[i], fallback));
}

function setSensitivityAxis(getter, setter, axisIndex, value, fallback) {
    const current = readSensitivityAxes(getter(), fallback);
    current[axisIndex] = Math.max(SENSITIVITY_MIN, Math.min(SENSITIVITY_MAX, Math.round(value)));
    setter(new Uint8Array(current));
}

function sensitivityAxisRows(idPrefix, values) {
    return AXIS_IDS.map((axis, i) => `
        <div class="app-row">
            <h3 style="width: 24px;">${axis.toUpperCase()}</h3>
            <div class="vert-separator"></div>
            <number-selector 
                id="${idPrefix}-${axis}"
                type="integer"
                min="${SENSITIVITY_MIN}"
                max="${SENSITIVITY_MAX}"
                step="1"
                value="${values[i]}"
                width="300"
            ></number-selector>
        </div>
    `).join('');
}

function startSensorDebug(sensorVis, options = {}) {
    const {
        frequency = 50,
        amplitude = 2000,
        noiseLevel = 100
    } = options;

    // Stop any existing debug
    if (debugInterval) {
        clearInterval(debugInterval);
    }

    debugTime = 0;
    const buffer = new ArrayBuffer(6);

    debugInterval = setInterval(() => {
        const view = new DataView(buffer);

        // Generate smooth circular motion with some random noise
        const x = Math.sin(debugTime * 0.5) * amplitude + 
                 (Math.random() - 0.5) * noiseLevel;
        const y = Math.sin(debugTime * 0.7) * amplitude + 
                 (Math.random() - 0.5) * noiseLevel;
        const z = Math.sin(debugTime * 0.3) * amplitude + 
                 (Math.random() - 0.5) * noiseLevel;

        view.setInt16(0, x, true);
        view.setInt16(2, y, true);
        view.setInt16(4, z, true);

        sensorVis.updateSensorData(buffer);
        debugTime += 0.1;
    }, frequency);

    // Return stop function
    return () => {
        if (debugInterval) {
            clearInterval(debugInterval);
            debugInterval = null;
        }
    };
}

let angles = { x: 0, y: 0, z: 0 };
const dt = 0.001; // Time step in seconds (adjust based on your report rate)
const alpha = 0.96; // Complementary filter coefficient (96% gyro, 4% accel)

function motionReportHook(data) {
    const view = new DataView(data.buffer);
    
    // Create a new buffer to hold both gyro and accelerometer data
    const combinedBuffer = new ArrayBuffer(12); // 6 bytes for gyro + 6 bytes for accel
    const combinedView = new DataView(combinedBuffer);
    
    // Get gyroscope data and write to first 6 bytes
    const gx = view.getInt16(9, true);
    const gy = view.getInt16(11, true);
    const gz = view.getInt16(13, true);
    
    combinedView.setInt16(0, gx, true); // X rotation
    combinedView.setInt16(2, gy, true); // Y rotation
    combinedView.setInt16(4, gz, true); // Z rotation
    
    // Get accelerometer data and write to next 6 bytes
    const ax = view.getInt16(3, true);
    const ay = view.getInt16(5, true);
    const az = view.getInt16(7, true);
    
    combinedView.setInt16(6, ax, true); // X acceleration
    combinedView.setInt16(8, ay, true); // Y acceleration
    combinedView.setInt16(10, az, true); // Z acceleration

    // Update the sensor visualization with the combined data
    if (sensorVis) {
        sensorVis.updateSensorData(combinedBuffer);
    }

    // Also update the new IMU display if it exists
    if (imuDisplay) {
        // LSM6DSR Sensitivity values
        const GYRO_SENSITIVITY = 70.0 / 100.0;  // 70 mdps/LSB to dps/LSB
        const ACCEL_SENSITIVITY = 0.488 / 100.0; // 0.488 mg/LSB to g/LSB
        
        // Convert raw values to units and update IMU display
        imuDisplay.updateValues('gyro', 
            gx * GYRO_SENSITIVITY,
            gy * GYRO_SENSITIVITY,
            gz * GYRO_SENSITIVITY
        );
        imuDisplay.updateValues('accel',
            ax * ACCEL_SENSITIVITY,
            ay * ACCEL_SENSITIVITY,
            az * ACCEL_SENSITIVITY
        );
    }
}

async function calibrateImuHandler() {
    // CFG_BLOCK_IMU=5 IMU_CMD_CALIBRATE_START=1
    let {status, data} = await gamepad.sendConfigCommand(5, 1, 100000);
    return status;
}

function uint32ToRgbHex(uint32) {
    // Mask out everything except the RGB components (last 3 bytes)
    uint32 &= 0x00FFFFFF;  // Mask the last byte (keeping the RGB part)
    //uint32 >>>= 8;         // Unsigned right shift to get only the RGB components
    
    // Convert to hex string and pad with leading zeros if necessary
    let hexString = uint32.toString(16).padStart(6, '0');
    
    // Ensure it's exactly 6 characters long
    return hexString;
}

function bindSensitivitySliders(container, idPrefix, getter, setter, fallback) {
    AXIS_IDS.forEach((axis, axisIndex) => {
        /** @type {NumberSelector} */
        const slider = container.querySelector(`number-selector[id="${idPrefix}-${axis}"]`);
        slider.addEventListener('change', async (e) => {
            setSensitivityAxis(getter, setter, axisIndex, e.detail.value, fallback);
            await writeRemapMemBlock();
        });
    });
}

function applySensitivityToSliders(container, idPrefix, values) {
    AXIS_IDS.forEach((axis, i) => {
        /** @type {NumberSelector} */
        const slider = container.querySelector(`number-selector[id="${idPrefix}-${axis}"]`);
        slider.setState(values[i]);
    });
}

export function render(container) {

    let hexColorBody = uint32ToRgbHex(gamepad.gamepad_cfg.gamepad_color_body);
    const gyroSensitivity = readSensitivityAxes(
        gamepad.imu_cfg.imu_gyro_sensitivity,
        GYRO_SENSITIVITY_DEFAULT
    );
    const accelSensitivity = readSensitivityAxes(
        gamepad.imu_cfg.imu_accel_sensitivity,
        ACCEL_SENSITIVITY_DEFAULT
    );

    container.innerHTML = `
        <h2>Motion Settings</h2>
        <div class="app-row">
            <single-shot-button 
                id="calibrate-imu-button" 
                width="60"
                state="ready" 
                ready-text="Calibrate" 
                disabled-text="Calibrate"
                pending-text="Calibrating..."
                success-text="Complete!"
                failure-text="Failure..."
                tooltip="Start IMU calibration. Place controller on a flat, solid surface and press this button to calibrate."
            ></single-shot-button>
            <multi-position-button 
                id="gyro-disable-select" 
                options="Enabled, Disabled"
                selected="${gamepad.imu_cfg.imu_disabled}"
                width="150"
            ></multi-position-button>
        </div>

        <div class="separator"></div>
        <h2>Visualizer</h2>
        <sensor-visualization
            model="./assets/3d/supergamepad.stl"
            scale="2.5"
            rotation-offset="0,0,0"
            color="#${hexColorBody}"
            reflectivity="0.16"
        ></sensor-visualization>
        <div class="separator"></div>
        <imu-data-display></imu-data-display>

        <div class="separator"></div>
        <h2>Gyro Sensitivity</h2>
        ${sensitivityAxisRows('gyro-sensitivity', gyroSensitivity)}

        <h2>Accelerometer Sensitivity</h2>
        ${sensitivityAxisRows('accel-sensitivity', accelSensitivity)}

        <div class="separator"></div>
        <div class="app-row">
            <h3>Defaults</h3>
            <single-shot-button 
                id="reset-sensitivity-button"
                state="ready"
                ready-text="Reset"
                disabled-text="Reset"
                pending-text="Resetting..."
                success-text="Success"
                failure-text="Error"
                tooltip="Reset gyro and accelerometer sensitivity to defaults."
            ></single-shot-button>
        </div>
    `;

    sensorVis = container.querySelector('sensor-visualization');
    imuDisplay = container.querySelector('imu-data-display');
    // Start debug animation
    //const stopDebug = startSensorDebug(sensorVis);
    gamepad.setReportHook(motionReportHook);

    const calibrateButton = container.querySelector('single-shot-button[id="calibrate-imu-button"]');
    calibrateButton.setOnClick(calibrateImuHandler);

    /** @type {MultiPositionButton} */
    const enableSelector = container.querySelector('multi-position-button[id="gyro-disable-select"]');
    enableSelector.addEventListener('change', async (e) => {
        console.log("IMU Disable Changed.");
        gamepad.imu_cfg.imu_disabled = e.detail.selectedIndex;
        await writeRemapMemBlock();
    });

    bindSensitivitySliders(
        container,
        'gyro-sensitivity',
        () => gamepad.imu_cfg.imu_gyro_sensitivity,
        (value) => { gamepad.imu_cfg.imu_gyro_sensitivity = value; },
        GYRO_SENSITIVITY_DEFAULT
    );

    bindSensitivitySliders(
        container,
        'accel-sensitivity',
        () => gamepad.imu_cfg.imu_accel_sensitivity,
        (value) => { gamepad.imu_cfg.imu_accel_sensitivity = value; },
        ACCEL_SENSITIVITY_DEFAULT
    );

    const resetButton = container.querySelector('single-shot-button[id="reset-sensitivity-button"]');
    resetButton.setOnClick(async () => {
        const gyroDefaults = [GYRO_SENSITIVITY_DEFAULT, GYRO_SENSITIVITY_DEFAULT, GYRO_SENSITIVITY_DEFAULT];
        const accelDefaults = [ACCEL_SENSITIVITY_DEFAULT, ACCEL_SENSITIVITY_DEFAULT, ACCEL_SENSITIVITY_DEFAULT];

        gamepad.imu_cfg.imu_gyro_sensitivity = new Uint8Array(gyroDefaults);
        gamepad.imu_cfg.imu_accel_sensitivity = new Uint8Array(accelDefaults);
        applySensitivityToSliders(container, 'gyro-sensitivity', gyroDefaults);
        applySensitivityToSliders(container, 'accel-sensitivity', accelDefaults);
        await writeRemapMemBlock();
        return true;
    });

    enableTooltips(container);
}