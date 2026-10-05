/**
 * Demo-controller hooks for the "gamepad" section (used only with ?demo; see src/device/mock.js).
 *   seed(device)            adjust device.config / device.static after the base demo data is set
 *   command(block, cmd, device)  return { status, data } to customize a config command's reply,
 *                           or undefined for the default success. May dispatch events on device.
 *
 * Nothing extra needed: the base mock seeds mode, MAC, Switch colors and the WebUSB popup, and
 * wireless/demo.js seeds host_mac_switch and wlan_dongle_key.
 */
export function seed(device) {}

export function command(block, cmd, device) { return undefined; }
