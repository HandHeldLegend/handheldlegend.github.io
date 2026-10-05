/**
 * Demo-controller hooks for the "battery" section (used only with ?demo; see src/device/mock.js).
 *   seed(device)            adjust device.config / device.static after the base demo data is set
 *   command(block, cmd, device)  return { status, data } to customize a config command's reply,
 *                           or undefined for the default success. May dispatch events on device.
 *
 * The base mock seeds the battery statics (1000 mAh, BQ25180 PMIC with pack present, MAX17048 fuel
 * gauge) and streams "charging, 76 %". Here the fuel gauge is reported as connected (status 2) so
 * the demo shows the normal, healthy state rather than "Inactive".
 */
export function seed(device) {
  device.static.battery.fuelgauge_status = 2;
}

export function command(block, cmd, device) { return undefined; }
