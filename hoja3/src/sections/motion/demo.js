/**
 * Demo-controller hooks for the "motion" section (used only with ?demo; see src/device/mock.js).
 *   seed(device)            adjust device.config / device.static after the base demo data is set
 *   command(block, cmd, device)  return { status, data } (or a Promise of it) to customize a config
 *                           command's reply, or undefined for the default success.
 *
 * The base mock already sets the IMU capability flags, default sensitivities and streams a gentle
 * accel/gyro wobble.
 */
import { fwDefine } from '../../device/struct.js';

export function seed(device) {
  const imu = device.config.imu;
  imu.imu_config_version = fwDefine('CFG_BLOCK_IMU_VERSION', 0);
  imu.imu_disabled = 0;
  imu.imu_a_gyro_offsets = [3, -2, 1]; // a lightly drifting, uncalibrated gyro
}

export function command(block, cmd, device) {
  if (block === 'imu' && cmd === 'CALIBRATE_START') {
    // The real firmware averages 2000 samples (~6 s) before replying; the mock already waited 0.4 s.
    return new Promise((resolve) => setTimeout(() => {
      device.config.imu.imu_a_gyro_offsets = [0, 0, 0];
      resolve({ status: true, data: null });
    }, 5600));
  }
  return undefined;
}
