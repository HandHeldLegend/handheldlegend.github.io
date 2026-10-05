/**
 * schema.js — The declarative catalog of user-facing controller settings.
 *
 * Each section contributes simple ("scalar") settings in src/sections/<id>/settings.js. The same
 * definitions drive three things, so they can never drift apart:
 *   1. the UI — settingField(def) renders a bound control (src/settings/field.js);
 *   2. deep links — #/apply?haptics.intensity=80 validates and applies values (src/settings/apply.js);
 *   3. AI assistants — the MCP server and window.hhl bridge list/validate them.
 *
 * Complex editors (button remapping, stick calibration, angle maps...) stay hand-written in the
 * section views; deep links can still *navigate* to them via route params.
 *
 * NO DOM CODE in this file or in any settings.js — it is imported by Node (mcp/server.mjs).
 *
 * @typedef {Object} SettingDef
 * @property {string} key           Unique id, "<section>.<name>" (camelCase name). Used in deep links.
 * @property {string} label         Short UI label.
 * @property {string} [description] One sentence; shown under the label and to assistants.
 * @property {string} [tip]         Longer help shown in the "?" bubble.
 * @property {string} block         Config block the value lives in ('gamepad', 'haptic', ...).
 * @property {'number'|'boolean'|'enum'|'color'|'text'} type
 * @property {number} [min] @property {number} [max] @property {number} [step] @property {string} [unit]
 * @property {Array<{value: (number|string), label: string, aliases?: string[]}>} [options]  for 'enum'
 * @property {number} [maxLength]   for 'text'
 * @property {string|null} [requires] capability flag (session.caps) needed for this setting
 * @property {(s: {config: object, static: object, caps: object}) => any} get   read UI value from structs
 * @property {(s: {config: object, static: object, caps: object}, v: any) => void} set  write UI value into structs
 */
import gamepad from '../sections/gamepad/settings.js';
import input from '../sections/input/settings.js';
import joysticks from '../sections/joysticks/settings.js';
import snapback from '../sections/snapback/settings.js';
import motion from '../sections/motion/settings.js';
import rgb from '../sections/rgb/settings.js';
import haptics from '../sections/haptics/settings.js';
import battery from '../sections/battery/settings.js';
import wireless from '../sections/wireless/settings.js';
import user from '../sections/user/settings.js';

/** @type {SettingDef[]} */
export const SETTINGS = [
  ...gamepad, ...input, ...joysticks, ...snapback, ...motion, ...rgb, ...haptics, ...battery, ...wireless, ...user,
];

export function getSetting(key) {
  return SETTINGS.find((d) => d.key === key);
}

export function settingsForSection(sectionId) {
  return SETTINGS.filter((d) => d.key.startsWith(`${sectionId}.`));
}

/**
 * Validate and coerce a user/assistant-supplied value for a setting.
 * Accepts strings (deep links) as well as native values.
 * @returns {{ok: true, value: any} | {ok: false, error: string}}
 */
export function coerceValue(def, raw) {
  switch (def.type) {
    case 'number': {
      const n = typeof raw === 'number' ? raw : Number(String(raw).trim().replace(/%$/, ''));
      if (!Number.isFinite(n)) return { ok: false, error: `${def.key}: "${raw}" is not a number` };
      if (def.min != null && n < def.min) return { ok: false, error: `${def.key}: ${n} is below the minimum ${def.min}` };
      if (def.max != null && n > def.max) return { ok: false, error: `${def.key}: ${n} is above the maximum ${def.max}` };
      const step = def.step || 1;
      const base = def.min ?? 0;
      return { ok: true, value: Number((Math.round((n - base) / step) * step + base).toFixed(6)) };
    }
    case 'boolean': {
      if (typeof raw === 'boolean') return { ok: true, value: raw };
      const s = String(raw).trim().toLowerCase();
      if (['1', 'true', 'on', 'yes', 'enabled', 'enable'].includes(s)) return { ok: true, value: true };
      if (['0', 'false', 'off', 'no', 'disabled', 'disable'].includes(s)) return { ok: true, value: false };
      return { ok: false, error: `${def.key}: "${raw}" is not on/off` };
    }
    case 'enum': {
      const s = String(raw).trim().toLowerCase();
      const opt = def.options.find((o) => String(o.value).toLowerCase() === s ||
        o.label.toLowerCase() === s || (o.aliases || []).some((a) => a.toLowerCase() === s));
      if (!opt) return { ok: false, error: `${def.key}: "${raw}" is not one of ${def.options.map((o) => o.label).join(', ')}` };
      return { ok: true, value: opt.value };
    }
    case 'color': {
      const m = String(raw).trim().replace(/^#/, '').match(/^([0-9a-f]{6}|[0-9a-f]{3})$/i);
      if (!m) return { ok: false, error: `${def.key}: "${raw}" is not a hex color like #ff8800` };
      const hex = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
      return { ok: true, value: `#${hex.toLowerCase()}` };
    }
    case 'text': {
      const s = String(raw);
      if (def.maxLength && new TextEncoder().encode(s).length > def.maxLength) {
        return { ok: false, error: `${def.key}: text is longer than ${def.maxLength} bytes` };
      }
      return { ok: true, value: s };
    }
    default:
      return { ok: false, error: `${def.key}: unsupported type ${def.type}` };
  }
}

/** Human-readable rendering of a value (for confirmations and assistant replies). */
export function formatValue(def, value) {
  if (def.type === 'enum') return def.options.find((o) => o.value === value)?.label ?? String(value);
  if (def.type === 'boolean') return value ? 'On' : 'Off';
  if (def.type === 'number') return `${value}${def.unit ? (def.unit === '%' ? '%' : ` ${def.unit}`) : ''}`;
  if (def.type === 'color') return String(value).toUpperCase();
  return String(value);
}

// ---- Small shared converters used by settings.js files -------------------------------------

/** 0x00RRGGBB integer <-> '#rrggbb' */
export const u32ToHex = (n) => `#${((n >>> 0) & 0xffffff).toString(16).padStart(6, '0')}`;
export const hexToU32 = (hex) => parseInt(String(hex).replace('#', ''), 16) >>> 0;
export const clampInt = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.round(v)));
