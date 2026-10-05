/**
 * Scalar settings for the "wireless" section (see src/settings/schema.js for the SettingDef format).
 * Pure data + pure functions only — this file is imported by Node for the MCP server.
 *
 * The Wireless page is the authoritative editor for the WLAN dongle PIN. Its view renders a
 * 4-digit PIN box bound to this definition (a 0–9999 slider would be awkward for a PIN), while
 * deep links (#/apply?wireless.dongleKey=420) and assistants use the definition directly.
 */
import { clampInt } from '../../settings/schema.js';

export default [
  {
    key: 'wireless.dongleKey',
    label: 'WLAN dongle PIN',
    description: 'Four-digit pairing PIN (0000–9999). Set the same PIN on your WLAN dongle so they pair.',
    tip: 'Only controllers that support the Raspberry Pi WLAN dongle use this. The PIN keeps your dongle from '
      + 'pairing with someone else’s controller nearby. Leading zeros count: 0420 is stored as 420.',
    block: 'gamepad',
    type: 'number', min: 0, max: 9999, step: 1,
    requires: 'wlan',
    // Firmware stores a uint16 and clamps it with `% 10000` whenever the gamepad block is written.
    get: (s) => (s.config.gamepad.wlan_dongle_key ?? 0) % 10000,
    set: (s, v) => { s.config.gamepad.wlan_dongle_key = clampInt(v, 0, 9999); },
  },
];
