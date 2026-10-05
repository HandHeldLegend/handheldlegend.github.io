/**
 * Demo-controller hooks for the "rgb" section (used only with ?demo; see src/device/mock.js).
 *   seed(device)            adjust device.config / device.static after the base demo data is set
 *   command(block, cmd, device)  return { status, data } to customize a config command's reply,
 *                           or undefined for the default success. May dispatch events on device.
 *
 * The base mock seeds 4 groups (D-Pad / Face / Start / Logo, player group = Logo), colors, mode,
 * speed and brightness. We only make the idle-glow flag explicit (0 = glow enabled).
 */
export function seed(device) {
  device.config.rgb.rgb_idle_glow = 0;
}

export function command(block, cmd, device) { return undefined; }
