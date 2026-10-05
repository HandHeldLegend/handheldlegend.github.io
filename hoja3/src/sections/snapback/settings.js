/**
 * Snapback settings (analogConfig_s) — the filter that removes stick "bounce" when you let go.
 * Pure data + pure functions only — this file is imported by Node for the MCP server.
 *
 * Fields (HOJA-LIB-RP2040 src/input/snapback.c, snapback/snapback_lpf.c):
 *   l/r_snapback_type       u8 — how snapback.c actually dispatches it (and what hoja2 showed):
 *                             0 = low-pass filter (default), 1 = auto (rebound detection), 2 = off.
 *                           NOTE: the header enum `snapback_type_t` names these DISABLED/ZERO/POST, which does
 *                           not match the runtime switch; we follow the runtime behavior, like hoja2 did.
 *   l/r_snapback_intensity  u16 — low-pass cutoff in tenths of a Hz (600 = 60.0 Hz). The firmware clamps it
 *                           to 300..1500 (30–150 Hz). Only used by the low-pass mode.
 */
import { clampInt } from '../../settings/schema.js';

/** Snapback modes in firmware order (index = stored value). */
export const SNAPBACK_TYPES = [
  { value: 0, label: 'Low-pass', aliases: ['lpf', 'low-pass filter', 'lowpass', 'filter', 'default'] },
  { value: 1, label: 'Auto', aliases: ['automatic', 'detect'] },
  { value: 2, label: 'Off', aliases: ['disabled', 'none', 'raw'] },
];

export const CUTOFF = { min: 30, max: 150, step: 0.5, default: 60 };

const P = { left: 'l', right: 'r' };
const CAP = { left: 'leftStick', right: 'rightStick' };

function stickSettings(stick) {
  const p = P[stick];
  return [
    {
      key: `snapback.${stick}Type`,
      label: 'Filter mode',
      description: `How the ${stick} stick suppresses the rebound past center after you let go.`,
      tip: 'Low-pass: smooths fast movement near the center (adjust with the cutoff). Auto: detects a release and holds back the rebound only when it happens. Off: raw stick output — use this to see your stick’s natural snapback.',
      block: 'analog',
      type: 'enum',
      options: SNAPBACK_TYPES,
      requires: CAP[stick],
      get: (s) => {
        const v = s.config.analog[`${p}_snapback_type`];
        return v <= 2 ? v : 0; // firmware treats unknown values as low-pass (switch default)
      },
      set: (s, v) => { s.config.analog[`${p}_snapback_type`] = clampInt(v, 0, 2); },
    },
    {
      key: `snapback.${stick}Intensity`,
      label: 'Filter cutoff',
      description: `Low-pass cutoff frequency for the ${stick} stick. Lower = stronger smoothing.`,
      tip: 'Lower values remove more bounce but add a touch of delay to fast flicks near the center; higher values feel snappier but let more rebound through. Default 60 Hz. Only used in Low-pass mode.',
      block: 'analog',
      type: 'number', min: CUTOFF.min, max: CUTOFF.max, step: CUTOFF.step, unit: 'Hz',
      requires: CAP[stick],
      // Stored in tenths of a Hz.
      get: (s) => s.config.analog[`${p}_snapback_intensity`] / 10,
      set: (s, v) => { s.config.analog[`${p}_snapback_intensity`] = clampInt(v * 10, CUTOFF.min * 10, CUTOFF.max * 10); },
    },
  ];
}

export default [...stickSettings('left'), ...stickSettings('right')];
