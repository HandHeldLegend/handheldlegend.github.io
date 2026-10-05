/**
 * Joystick settings (analogConfig_s) — deadzones, response curve and axis inversion per stick.
 * Pure data + pure functions only — this file is imported by Node for the MCP server.
 *
 * Units on the controller (HOJA-LIB-RP2040 src/input/stick_deadzone.c):
 *   l/r_deadzone, l/r_deadzone_outer   u16 in stick units, where 2048 = full deflection (stick radius).
 *                                      Shown here as a percentage of the radius.
 *                                      Output distance = (d − inner) · 2048 / (2048 − inner − outer).
 *   l/r_exp_scaler                     u8, offset-encoded exponent (ANALOG_EXP_* defines):
 *                                      exponent = (stored + ANALOG_EXP_SENSITIVITY_OFFSET) / 100,
 *                                      stored 1..251 → 0.50..3.00, 51 = 1.00 (linear). 0/0xFF = unset → linear.
 *                                      Applied after the deadzone remap: out = 2048 · (d / 2048) ^ exponent.
 *   lx/ly/rx/ry_invert                 1-bit flags (only when the build reports analog invert_allowed).
 *   lx/ly/rx/ry_center                 15-bit resting centers captured by the firmware at calibration start
 *                                      (read-only here, shown on the Axes tab).
 */
import { clampInt } from '../../settings/schema.js';
import { fwDefine } from '../../device/struct.js';

/** Offset-encoded response-curve constants from the firmware headers (with hoja2's fallbacks). */
export const EXP = {
  storedMin: fwDefine('ANALOG_EXP_STORED_MIN', 1),
  storedMax: fwDefine('ANALOG_EXP_STORED_MAX', 251),
  storedDefault: fwDefine('ANALOG_EXP_STORED_DEFAULT', 51),
  offset: fwDefine('ANALOG_EXP_SENSITIVITY_OFFSET', 49),
  min: fwDefine('ANALOG_EXP_SENSITIVITY_MIN', 50) / 100,
  max: fwDefine('ANALOG_EXP_SENSITIVITY_MAX', 300) / 100,
};

/** Stored u8 → exponent multiplier (0.50–3.00). Out-of-range (unset flash) reads as the default. */
export function expStoredToMultiplier(stored) {
  const s = stored < EXP.storedMin || stored > EXP.storedMax ? EXP.storedDefault : stored;
  return (s + EXP.offset) / 100;
}

/** Exponent multiplier → stored u8 (clamped to the firmware range). */
export function expMultiplierToStored(multiplier) {
  const m = Math.min(EXP.max, Math.max(EXP.min, Number(multiplier) || 1));
  return clampInt(Math.round(m * 100) - EXP.offset, EXP.storedMin, EXP.storedMax);
}

/** Full stick deflection in firmware units. */
export const STICK_RADIUS = 2048;
/** Max deadzone (%). Keeps inner + outer < 100 % so the firmware's scaler never divides by zero. */
export const DEADZONE_MAX_PCT = 48;

const toPct = (raw) => Math.round((raw / STICK_RADIUS) * 1000) / 10;
const fromPct = (pct) => clampInt((pct / 100) * STICK_RADIUS, 0, Math.round((DEADZONE_MAX_PCT / 100) * STICK_RADIUS));

/** Field-name prefix for a stick: 'l' | 'r'. */
const P = { left: 'l', right: 'r' };
const CAP = { left: 'leftStick', right: 'rightStick' };
const NAME = { left: 'Left', right: 'Right' };

function stickSettings(stick) {
  const p = P[stick];
  const name = NAME[stick];
  return [
    {
      key: `joysticks.${stick}Deadzone`,
      label: 'Center deadzone',
      description: `How far the ${stick} stick must move before it registers, as a % of full travel.`,
      tip: 'Raise this if the stick drifts or twitches when you let go. Lower it for a more responsive center. The firmware default is about 7 %.',
      block: 'analog',
      type: 'number', min: 0, max: DEADZONE_MAX_PCT, step: 0.1, unit: '%',
      requires: CAP[stick],
      get: (s) => toPct(s.config.analog[`${p}_deadzone`]),
      set: (s, v) => { s.config.analog[`${p}_deadzone`] = fromPct(v); },
    },
    {
      key: `joysticks.${stick}OuterDeadzone`,
      label: 'Edge deadzone',
      description: `How close to the rim the ${stick} stick reaches full output, as a % of full travel.`,
      tip: 'Raise this if the stick can’t quite reach 100 % at the edge (e.g. worn gates or diagonals). The firmware default is about 3.5 %.',
      block: 'analog',
      type: 'number', min: 0, max: DEADZONE_MAX_PCT, step: 0.1, unit: '%',
      requires: CAP[stick],
      get: (s) => toPct(s.config.analog[`${p}_deadzone_outer`]),
      set: (s, v) => { s.config.analog[`${p}_deadzone_outer`] = fromPct(v); },
    },
    {
      key: `joysticks.${stick}Curve`,
      label: 'Response curve',
      description: `Exponent applied to the ${stick} stick’s output. 1.00 is linear.`,
      tip: 'Above 1.00 the output rises slowly near the center and catches up at the edge — finer aim for small movements. Below 1.00 the stick is more sensitive near the center. Range 0.50–3.00. Calibrating resets this to 1.00.',
      block: 'analog',
      type: 'number', min: EXP.min, max: EXP.max, step: 0.01, unit: '×',
      requires: CAP[stick],
      get: (s) => expStoredToMultiplier(s.config.analog[`${p}_exp_scaler`]),
      set: (s, v) => { s.config.analog[`${p}_exp_scaler`] = expMultiplierToStored(v); },
    },
    ...['x', 'y'].map((axis) => ({
      key: `joysticks.${stick}Invert${axis.toUpperCase()}`,
      label: `Invert ${name.charAt(0)}${axis.toUpperCase()}`,
      description: `Flip the ${stick} stick’s ${axis === 'x' ? 'horizontal (left ↔ right)' : 'vertical (up ↔ down)'} direction.`,
      tip: 'Only needed for sticks mounted the other way round (some custom builds). Recalibrate after changing it.',
      block: 'analog',
      type: 'boolean',
      requires: 'invertAllowed',
      get: (s) => !!s.config.analog[`${p}${axis}_invert`],
      set: (s, v) => { s.config.analog[`${p}${axis}_invert`] = v ? 1 : 0; },
    })),
  ];
}

export default [...stickSettings('left'), ...stickSettings('right')];
