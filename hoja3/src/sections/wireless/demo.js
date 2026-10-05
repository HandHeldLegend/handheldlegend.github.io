/**
 * Demo-controller hooks for the "wireless" section (used only with ?demo; see src/device/mock.js).
 *   seed(device)            adjust device.config / device.static after the base demo data is set
 *   command(block, cmd, device)  return { status, data } to customize a config command's reply,
 *                           or undefined for the default success. May dispatch events on device.
 *
 * mock.js already seeds an ESP32-C3 with external updates and WLAN supported. Here we:
 *   - report an older baseband version so "Update available" (and the nav badge) show when online;
 *   - give the controller a paired Switch (SInput left unpaired) and a WLAN PIN;
 *   - make ENABLE_BLUETOOTH_UPLOAD behave like hardware: the controller drops off USB shortly after,
 *     so the update dialog's survive-the-unmount path can be seen. The flash itself is simulated
 *     by module-updater.js / esp-flasher.js when isDemo() was true at the start of the update.
 */
export function seed(device) {
  device.static.bluetooth.external_version_number = 41000;
  const c = device.config.gamepad;
  c.host_mac_switch = [0x98, 0xb6, 0xe9, 0x4a, 0x2c, 0x11];
  c.host_mac_sinput = [0, 0, 0, 0, 0, 0];
  c.wlan_dongle_key = 420;
}

export function command(block, cmd, device) {
  if (block === 'gamepad' && cmd === 'ENABLE_BLUETOOTH_UPLOAD') {
    // Real firmware reboots into ALTFLASH without replying; simulate the USB drop.
    setTimeout(() => device.disconnect(), 600);
    return { status: false, data: null };
  }
  return undefined;
}
