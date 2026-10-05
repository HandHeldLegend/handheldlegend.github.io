/**
 * RGB settings (rgbConfig_s) — lighting effect, speed, brightness, idle glow and per-group colors.
 *
 * Pure data + pure functions only — this file is imported by Node for the MCP server.
 *
 * Firmware notes (HOJA-LIB-RP2040):
 *   - rgb_mode holds an rgb_anim_t (include/devices/animations/rgb_modes.h). That enum isn't in the
 *     generated layout, so the user-selectable values are listed in RGB_MODES below. BREATHE (5) is
 *     reserved/not wired and IDLE (6) is internal, so neither is offered — same as hoja2.
 *   - rgb_brightness is 0..RGB_BRIGHTNESS_MAX (4096); the firmware caps it to a third over wireless.
 *   - rgb_speed is the animation/fade time in ms, clamped by the firmware to 300..5000.
 *   - rgb_idle_glow: 1 = glow DISABLED; 0 (or 0xFF on blank flash) = enabled. hoja2's "On, Off"
 *     selector mapped index 0 → On for this reason.
 *   - rgb_colors[i] is 0x00RRGGBB for LED group i (group names come from static rgb_group_names).
 */
import LAYOUT from '../../device/generated/fw-layout.js';
import { u32ToHex, hexToU32, clampInt } from '../../settings/schema.js';

/** Marks text for tools/test-i18n.mjs (translated where rendered); local so Node needn't load i18n. */
const N_ = (text) => text;

export const BRIGHTNESS_MAX = LAYOUT.defines.RGB_BRIGHTNESS_MAX ?? 4096;
export const SPEED_MIN = 300;
export const SPEED_MAX = 5000;
/** Number of color slots in rgbConfig_s.rgb_colors (RGB_MAX_GROUPS). */
export const MAX_GROUPS = LAYOUT.structs.rgbConfig_s.fields.find((f) => f.name === 'rgb_colors')?.count ?? 32;
/** Fairy mode blends between the first six colors only (FAIRY_NUM_OPTIONS in anm_fairy.c). */
export const FAIRY_COLORS = 6;

/** rgb_anim_t values a user can pick, with plain-language explanations used by the RGB page. */
export const RGB_MODES = [
  { value: 0, id: 'authentic', label: 'Authentic', aliases: ['chroma', 'auto', 'era', 'classic'],
    about: N_('Face buttons light up in the classic colors of the current output mode (Switch/SNES: A red, B yellow, X blue, Y green) and follow your remaps; other LEDs glow soft white. Your colors are only used for the player LEDs.') },
  { value: 1, id: 'static', label: 'Static', aliases: ['user', 'solid', 'none', 'custom'],
    about: N_('Each group glows steadily in the color you pick below.') },
  { value: 2, id: 'rainbow', label: 'Rainbow', aliases: ['cycle', 'spectrum'],
    about: N_('All LEDs (except the player LEDs) fade together through the colors of the rainbow. Animation time sets how long each color step takes.') },
  { value: 3, id: 'react', label: 'React', aliases: ['reactive', 'press'],
    about: N_('Lights flash on in your colors when you press an input, then fade out over the animation time. The player LEDs stay lit in their color.') },
  { value: 4, id: 'fairy', label: 'Fairy', aliases: ['twinkle', 'sparkle'],
    about: N_('Every LED (except the player LEDs) slowly blends between the first six colors below, like fairy lights.') },
];

const colorDefs = Array.from({ length: MAX_GROUPS }, (_, i) => ({
  key: `rgb.group${i + 1}Color`,
  label: `Group ${i + 1} color`,
  description: `Color of LED group ${i + 1} as listed on the RGB page (group names and count depend on the controller, e.g. "D-Pad" or "A").`,
  block: 'rgb',
  type: 'color',
  requires: 'rgb',
  get: (s) => u32ToHex(s.config.rgb.rgb_colors[i]),
  set: (s, v) => { const a = s.config.rgb.rgb_colors; a[i] = hexToU32(v); s.config.rgb.rgb_colors = a; },
}));

export default [
  {
    key: 'rgb.mode',
    label: 'Effect',
    description: 'Lighting effect: Authentic (classic face-button colors for the output mode; called Chroma in older apps), Static (your colors), Rainbow, React (flash on press) or Fairy (blend between your first six colors).',
    block: 'rgb',
    type: 'enum',
    requires: 'rgb',
    options: RGB_MODES.map(({ value, label, id, aliases }) => ({ value, label, aliases: [id, ...aliases] })),
    get: (s) => s.config.rgb.rgb_mode,
    set: (s, v) => { s.config.rgb.rgb_mode = v; },
  },
  {
    key: 'rgb.brightness',
    label: 'Brightness',
    description: 'How bright the LEDs are, from off to full.',
    tip: 'To save battery, the controller limits brightness to about a third while connected wirelessly.',
    block: 'rgb',
    type: 'number', min: 0, max: 100, step: 1, unit: '%',
    requires: 'rgb',
    // Stored as 0..RGB_BRIGHTNESS_MAX, shown as a percentage (hoja2: value / 4096 * 100).
    get: (s) => clampInt((s.config.rgb.rgb_brightness / BRIGHTNESS_MAX) * 100, 0, 100),
    set: (s, v) => { s.config.rgb.rgb_brightness = clampInt((v / 100) * BRIGHTNESS_MAX, 0, BRIGHTNESS_MAX); },
  },
  {
    key: 'rgb.speed',
    label: 'Animation time',
    description: 'How long one animation step or fade takes, in milliseconds. Lower is faster.',
    block: 'rgb',
    type: 'number', min: SPEED_MIN, max: SPEED_MAX, step: 25, unit: 'ms',
    requires: 'rgb',
    get: (s) => clampInt(s.config.rgb.rgb_speed, SPEED_MIN, SPEED_MAX),
    set: (s, v) => { s.config.rgb.rgb_speed = clampInt(v, SPEED_MIN, SPEED_MAX); },
  },
  {
    key: 'rgb.idleGlow',
    label: 'Idle glow',
    description: 'After a while without input the lights go dark and a single LED glows to show battery status. Turn off to keep it dark too.',
    tip: 'Cyan = on battery, orange = charging, green = fully charged.',
    block: 'rgb',
    type: 'boolean',
    requires: 'rgb',
    get: (s) => s.config.rgb.rgb_idle_glow !== 1,
    set: (s, v) => { s.config.rgb.rgb_idle_glow = v ? 0 : 1; },
  },
  {
    key: 'rgb.allColors',
    label: 'All group colors',
    description: 'Set every LED group to the same color at once (like hoja2’s “Paste All”).',
    block: 'rgb',
    type: 'color',
    requires: 'rgb',
    get: (s) => u32ToHex(s.config.rgb.rgb_colors[0]),
    set: (s, v) => {
      const n = Math.max(1, Math.min(MAX_GROUPS, s.static.rgb.rgb_groups || MAX_GROUPS));
      const a = s.config.rgb.rgb_colors;
      for (let i = 0; i < n; i++) a[i] = hexToU32(v);
      s.config.rgb.rgb_colors = a;
    },
  },
  ...colorDefs,
];
