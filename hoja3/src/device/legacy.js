/**
 * legacy.js — Firmware URLs for controllers still running pre-HOJA2 ("legacy") firmware.
 *
 * Legacy firmware answers the 0xAF version probe with a 16-bit device id. We can't configure
 * those devices, but we can offer the matching modern firmware.
 */
const FW = 'https://github.com/HandHeldLegend/hoja-device-fw/raw/refs/heads/main/builds';

export const LEGACY_DEVICES = {
  0xa001: { name: 'ProGCC 3', build: 'progcc_3' },
  0xa002: { name: 'ProGCC 3+', build: 'progcc_3p' },
  0xa004: { name: 'ProGCC 3.1', build: 'progcc_3.1' },
  0xa005: { name: 'ProGCC 3.2', build: 'progcc_3.2' },
  0xb001: { name: 'Super Gamepad+', build: 'super_gamepad' },
  0xc001: { name: 'GC Ultimate', build: 'gcu_proto' },
  0xc003: { name: 'GC Ultimate R4K', build: 'gcu_r4k' },
};

export function legacyFirmwareUrl(deviceId) {
  const d = LEGACY_DEVICES[deviceId];
  return d ? `${FW}/${d.build}/${d.build}.uf2` : undefined;
}

export function legacyDeviceName(deviceId) {
  return LEGACY_DEVICES[deviceId]?.name ?? `Unknown (0x${deviceId.toString(16)})`;
}
