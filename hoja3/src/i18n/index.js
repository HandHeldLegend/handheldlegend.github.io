/**
 * i18n — translations and locale-aware formatting.
 *
 * Languages: English (source), Spanish (Latin American, neutral), Japanese.
 *
 *   import { t, plural, fmt } from '../i18n/index.js';
 *   t('Connect controller')                         // → 'Conectar control' in Spanish
 *   t('Connected to {name}', { name })              // placeholders in {braces}
 *   plural(n, '{n} setting applied', '{n} settings applied', { n })
 *   fmt.number(0.5, { style: 'percent' })           // Intl formatting in the active locale
 *
 * English text IS the key (gettext style): code stays readable, a missing translation simply shows
 * English, and `node tools/test-i18n.mjs` lists every string that still needs translating.
 * Data-only modules (registry.js, settings.js) keep plain English; it is translated where rendered,
 * e.g. t(def.label). Dictionaries live in src/i18n/locales/<lang>/<area>.js — one file per app area
 * so several people can translate at once. Terminology: src/i18n/GLOSSARY.md.
 *
 * Detection (preference 'auto'): the browser/OS language list first (navigator.languages); if none
 * of them is supported, the time zone as a hint (e.g. Asia/Tokyo → Japanese); otherwise English.
 * No network lookups. `?lang=es` in the URL overrides for the current visit (handy for support links).
 */
import { prefs } from '../app/prefs.js';

export const LANGUAGES = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'es', name: 'Spanish', native: 'Español' },
  { code: 'ja', name: 'Japanese', native: '日本語' },
];
const SUPPORTED = LANGUAGES.map((l) => l.code);

/** Time zones whose population mostly reads Spanish (used only when the browser language isn't supported). */
const SPANISH_TZ = /^(Europe\/Madrid|Atlantic\/Canary|Africa\/Ceuta|America\/(Mexico_City|Monterrey|Merida|Cancun|Chihuahua|Hermosillo|Mazatlan|Tijuana|Matamoros|Bahia_Banderas|Ojinaga|Bogota|Lima|Santiago|Punta_Arenas|Argentina\/.*|Buenos_Aires|Caracas|Guatemala|El_Salvador|Tegucigalpa|Managua|Costa_Rica|Panama|Havana|Santo_Domingo|Puerto_Rico|Montevideo|Asuncion|La_Paz|Guayaquil))$/;

/** Pick a supported language from the browser/OS, falling back to the time zone, then English. */
export function detectLanguage(languages = navigator.languages || [navigator.language], timeZone) {
  for (const tag of languages) {
    const base = String(tag || '').toLowerCase().split('-')[0];
    if (SUPPORTED.includes(base)) return base;
  }
  let tz = timeZone;
  try { tz ??= Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { /* ignore */ }
  if (tz === 'Asia/Tokyo') return 'ja';
  if (tz && SPANISH_TZ.test(tz)) return 'es';
  return 'en';
}

const urlLang = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('lang');

/** The language currently in effect. */
export function currentLanguage() {
  if (urlLang && SUPPORTED.includes(urlLang)) return urlLang;
  const pref = prefs.get('language') || 'auto';
  return pref === 'auto' ? detectLanguage() : pref;
}

let lang = 'en';
let dict = {};
const listeners = new Set();

async function loadDictionary(code) {
  if (code === 'en') return {};
  try {
    const mod = await import(`./locales/${code}/index.js`);
    return mod.default || {};
  } catch (err) {
    console.warn(`[i18n] could not load ${code}`, err);
    return {};
  }
}

function interpolate(text, params) {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m));
}

/** Mark a literal for extraction without translating it yet (translate later with t()). */
export const N_ = (text) => text;

/** Translate an English source string. Unknown strings fall back to English. */
export function t(text, params) {
  if (text == null) return '';
  const s = String(text);
  return interpolate(dict[s] ?? s, params);
}

/** Pluralized translation. Spanish/English use one/other; Japanese uses the `other` form. */
export function plural(n, one, other, params = {}) {
  const rule = new Intl.PluralRules(lang).select(n);
  return t(rule === 'one' ? one : other, { n, ...params });
}

/** Locale-aware formatting helpers. */
export const fmt = {
  number: (v, o) => new Intl.NumberFormat(lang, o).format(v),
  percent: (v, o) => new Intl.NumberFormat(lang, { style: 'percent', maximumFractionDigits: 0, ...o }).format(v),
  date: (d, o = { year: 'numeric', month: 'short', day: 'numeric' }) => new Intl.DateTimeFormat(lang, o).format(d),
  list: (items) => new Intl.ListFormat(lang, { type: 'conjunction' }).format(items),
};

export const i18n = {
  get lang() { return lang; },
  /** Subscribe to language changes (after the new dictionary has loaded). Returns unsubscribe. */
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
};

async function apply() {
  const next = currentLanguage();
  const nextDict = await loadDictionary(next);
  const changed = next !== lang;
  lang = next;
  dict = nextDict;
  document.documentElement.lang = lang;
  if (changed) for (const fn of listeners) fn(lang);
}

/** Load the active language before the first render. Re-applies whenever the preference changes. */
export async function initI18n() {
  await apply();
  prefs.on('language', () => apply());
  // Re-detect if the OS/browser language changes while the app is open (auto mode only).
  window.addEventListener('languagechange', () => { if ((prefs.get('language') || 'auto') === 'auto') apply(); });
}
