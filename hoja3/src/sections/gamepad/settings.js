/**
 * Gamepad settings (gamepadConfig_s) — default output mode, Switch colors and WebUSB popup.
 *
 * Pure data + pure functions only — this file is imported by Node for the MCP server.
 *
 * Not exposed here (hand-written editors in view.js instead):
 *   - gamepad_mac_address: a 6-byte structured value with a parity rule; editing it by deep link
 *     or assistant would be error-prone and can break existing pairings.
 *   - wlan_dongle_key: owned by the Wireless section ('wireless.dongleKey').
 */
import LAYOUT from '../../device/generated/fw-layout.js';
import { u32ToHex, hexToU32 } from '../../settings/schema.js';

/** Look up a core_reportformat_t value by name so we never hard-code firmware numbers. */
/** Marks text for tools/test-i18n.mjs (translated where rendered); local so Node needn't load i18n. */
const N_ = (text) => text;

const fmt = (name) => (LAYOUT.enums.core_reportformat_t || []).find((e) => e.name === `CORE_REPORTFORMAT_${name}`)?.value;

/**
 * Output modes in firmware order. Labels match hoja2 (with tidier capitalization); `about` is a
 * short explanation used by the Gamepad page's mode picker.
 */
export const DEFAULT_MODES = [
  { value: fmt('SWPRO'), label: 'Switch', aliases: ['switch', 'swpro', 'pro', 'nintendo switch', 'switch pro'], about: N_('Nintendo Switch Pro Controller. Works with this app.') },
  { value: fmt('XINPUT'), label: 'XInput', aliases: ['xinput', 'xbox', 'x-input', 'pc'], about: N_('Xbox-style controller for Windows PCs.') },
  { value: fmt('SLIPPI'), label: 'Slippi', aliases: ['slippi', 'dolphin', 'melee'], about: N_('GameCube adapter mode for Slippi / Dolphin.') },
  { value: fmt('GAMECUBE'), label: 'GCube', aliases: ['gamecube', 'gc', 'gcube', 'ngc'], about: N_('Native GameCube (Joybus) output.') },
  { value: fmt('N64'), label: 'N64', aliases: ['n64', 'nintendo 64'], about: N_('Native Nintendo 64 (Joybus) output.') },
  { value: fmt('SNES'), label: 'SNES', aliases: ['snes', 'sfc', 'super famicom', 'super nintendo', 'nes'], about: N_('Native SNES / Super Famicom output.') },
  { value: fmt('SINPUT'), label: 'Steam', aliases: ['steam', 'sinput', 's-input'], about: N_('Steam mode, for Steam and SDL games on PC. Works with this app.') },
].filter((m) => m.value != null);

/** Switch color fields, in the order hoja2 showed them. */
const COLORS = [
  ['bodyColor', 'gamepad_color_body', 'Body', 'Main shell color the Switch shows in its menus and some games.'],
  ['buttonsColor', 'gamepad_color_buttons', 'Buttons', 'Color of the buttons as drawn by the Switch.'],
  ['leftGripColor', 'gamepad_color_grip_left', 'Left grip', 'Left handle color as drawn by the Switch.'],
  ['rightGripColor', 'gamepad_color_grip_right', 'Right grip', 'Right handle color as drawn by the Switch.'],
];

export default [
  {
    key: 'gamepad.defaultMode',
    label: 'Default mode',
    description: 'The output mode the controller starts in when plugged in or powered on. Only Switch and Steam modes work with this config app — after changing it, hold A (South) while plugging in to come back here.',
    block: 'gamepad',
    type: 'enum',
    options: DEFAULT_MODES.map(({ value, label, aliases }) => ({ value, label, aliases })),
    get: (s) => s.config.gamepad.gamepad_default_mode,
    set: (s, v) => { s.config.gamepad.gamepad_default_mode = v; },
  },
  ...COLORS.map(([name, fieldName, label, description]) => ({
    key: `gamepad.${name}`,
    label: `${label} color`,
    description,
    tip: 'Switch only: these colors tell the console how to draw the controller in its menus. They do not change any LEDs (see the RGB page for those).',
    block: 'gamepad',
    type: 'color',
    // Stored as a 0x00RRGGBB u32 (top byte ignored), like hoja2.
    get: (s) => u32ToHex(s.config.gamepad[fieldName]),
    set: (s, v) => { s.config.gamepad[fieldName] = hexToU32(v); },
  })),
  {
    key: 'gamepad.webusbPopup',
    label: 'WebUSB popup',
    description: 'Show the browser’s “open the config app” notification when the controller is plugged in.',
    block: 'gamepad',
    type: 'boolean',
    get: (s) => !!s.config.gamepad.webusb_enable_popup,
    set: (s, v) => { s.config.gamepad.webusb_enable_popup = v ? 1 : 0; },
  },
];
