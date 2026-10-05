/**
 * prefs.js — App preferences (stored per browser in localStorage).
 *
 *   prefs.get('theme')            'dark' | 'light' | 'system'   (default 'dark')
 *   prefs.set('theme', 'light')   applies immediately and notifies subscribers
 *   prefs.on('theme', fn)         returns unsubscribe
 *
 * The theme is applied as <html data-theme="..."> (absent = follow the OS; see css/tokens.css).
 * index.html applies the stored theme inline before first paint to avoid a flash.
 */
const KEY = 'hhl-config:prefs';

const DEFAULTS = {
  theme: 'dark',           // 'dark' | 'light' | 'system'
  language: 'auto',        // 'auto' | 'en' | 'es' | 'ja' (see src/i18n/index.js)
  reduceMotion: 'system',  // 'system' | 'on'
  autoUpdateCheck: true,   // check for controller firmware updates on connect
  lastSection: null,
};

let values = { ...DEFAULTS };
try { Object.assign(values, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* private mode etc. */ }

const listeners = new Map();

export const prefs = {
  get: (k) => values[k],
  set(k, v) {
    if (values[k] === v) return;
    values[k] = v;
    try { localStorage.setItem(KEY, JSON.stringify(values)); } catch { /* ignore */ }
    apply();
    for (const fn of listeners.get(k) || []) fn(v);
  },
  on(k, fn) {
    if (!listeners.has(k)) listeners.set(k, new Set());
    listeners.get(k).add(fn);
    return () => listeners.get(k).delete(fn);
  },
};

/** Effective theme right now ('dark' | 'light'), resolving 'system'. */
export function effectiveTheme() {
  if (values.theme !== 'system') return values.theme;
  return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function apply() {
  const root = document.documentElement;
  if (values.theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', values.theme);
  root.classList.toggle('reduce-motion', values.reduceMotion === 'on');
  // Keep the browser/OS chrome color in sync with the theme.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', effectiveTheme() === 'light' ? '#f8f7f4' : '#121117');
}

// Guarded so Node tools (tests, MCP server) can import modules that depend on prefs/i18n.
if (typeof matchMedia !== 'undefined') matchMedia('(prefers-color-scheme: light)').addEventListener('change', apply);

/** True when decorative JS animation should be skipped (OS setting or the in-app switch). */
export function prefersReducedMotion() {
  return values.reduceMotion === 'on' || matchMedia('(prefers-reduced-motion: reduce)').matches;
}
