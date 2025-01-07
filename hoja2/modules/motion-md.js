import HojaGamepad from '../gamepad/gamepad.js';

import SensorVisualization from '../components/sensor-visualization.js';
import IMUDataDisplay from '../components/imu-data-display.js';

import TristateButton from '../components/tristate-button.js';
import SingleShotButton from '../components/single-shot-button.js';
import MultiPositionButton from '../components/multi-position-button.js';

import { enableTooltips } from '../tooltips.js';

/** @type {HojaGamepad} */
let gamepad = HojaGamepad.getInstance();
const gyroCfgBlockNumber = 5;
let sensorVis = null;
let imuDisplay = null;

let debugInterval = null;
let debugTime = 0;

async function writeRemapMemBlock() {
    await gamepad.sendBlock(gyroCfgBlockNumber);
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
    const gx = view.getInt16(20, true);
    const gy = view.getInt16(22, true);
    const gz = view.getInt16(24, true);
    
    combinedView.setInt16(0, gx, true); // X rotation
    combinedView.setInt16(2, gy, true); // Y rotation
    combinedView.setInt16(4, gz, true); // Z rotation
    
    // Get accelerometer data and write to next 6 bytes
    const ax = view.getInt16(14, true);
    const ay = view.getInt16(16, true);
    const az = view.getInt16(18, true);
    
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

export function render(container) {

    let hexColorBody = uint32ToRgbHex(gamepad.gamepad_cfg.gamepad_color_body);

    container.innerHTML = `
        <h2>Primary Options</h2>
        <div class="app-row">
            <single-shot-button 
                id="calibrate-imu-button" 
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
                labels="Enabled, Disabled"
                default-selected="${gamepad.imu_cfg.imu_disabled}"
            ></multi-position-button>
        </div>
        <h2>Visualizer</h2>
        <sensor-visualization
            model="./assets/3d/supergamepad.stl"
            scale="2.5"
            rotation-offset="0,0,0"
            color="#${hexColorBody}"
            reflectivity="0.16"
        ></sensor-visualization>
        <imu-data-display></imu-data-display>
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

    enableTooltips(container);
}