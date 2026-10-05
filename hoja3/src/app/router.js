/**
 * router.js — Hash routes and deep links.
 *
 *   #/                                    Home
 *   #/<section>[/<sub>...][?k=v&...]      A page, e.g. #/joysticks?stick=left&tab=calibrate
 *   #/apply?<settingKey>=<value>&...      Apply settings from a link (asks for confirmation first)
 *
 * Hash routing keeps the app fully static (works from any folder, offline, and inside the
 * installed PWA) and makes the Android/browser back button behave naturally.
 * See docs/DEEPLINKS.md for the full catalog (also exposed to assistants via mcp/server.mjs).
 */

/** @typedef {{ section: string, sub: string[], params: Record<string,string>, raw: string }} Route */

/** Parse a hash like "#/joysticks/left?tab=calibrate". */
export function parseRoute(hash = location.hash) {
  const raw = hash.replace(/^#\/?/, '');
  const [path, query = ''] = raw.split('?');
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  const params = Object.fromEntries(new URLSearchParams(query));
  return { section: parts[0] || 'home', sub: parts.slice(1), params, raw };
}

/** Build a hash from parts: buildRoute('joysticks', { stick: 'left' }) -> '#/joysticks?stick=left' */
export function buildRoute(section, params = {}, sub = []) {
  const path = [section === 'home' ? '' : section, ...sub].filter(Boolean).map(encodeURIComponent).join('/');
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '')).toString();
  return `#/${path}${q ? `?${q}` : ''}`;
}

const listeners = new Set();

/** Subscribe to route changes. fn(route, previousRoute). */
export function onRoute(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

let current = parseRoute();
window.addEventListener('hashchange', () => {
  const prev = current;
  current = parseRoute();
  for (const fn of listeners) fn(current, prev);
});

export const currentRoute = () => current;

/** Navigate to a hash or section id. */
export function navigate(target, params, { replace = false } = {}) {
  const hash = target.startsWith('#') ? target : buildRoute(target, params);
  if (hash === location.hash) return;
  if (replace) {
    history.replaceState(null, '', hash);
    const prev = current;
    current = parseRoute();
    for (const fn of listeners) fn(current, prev);
  } else {
    location.hash = hash;
  }
}

/** Update the current route's query params without re-rendering the page (keeps links shareable). */
export function setParams(params) {
  const next = { ...current.params, ...params };
  for (const k of Object.keys(next)) if (next[k] == null || next[k] === '') delete next[k];
  const hash = buildRoute(current.section, next, current.sub);
  if (hash === location.hash) return;
  history.replaceState(null, '', hash);
  current = parseRoute();
}
