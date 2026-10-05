/**
 * catalog.mjs — The app's pages and settings, loaded straight from the app source (Node side).
 *
 * Shared by mcp/server.mjs, tools/gen-docs.mjs and tools/test-mcp.mjs. Everything here is derived
 * from src/sections/registry.js and src/settings/schema.js at runtime, so assistants always see
 * exactly what the app ships — nothing is copied by hand.
 *
 *   const cat = await loadCatalog();
 *   cat.pages            public page descriptions (no functions)
 *   cat.settings         public SettingDefs (no get/set)
 *   cat.pageUrl('joysticks', { stick: 'left' })
 *   cat.planSettingsLink({ 'haptics.intensity': 80 }, { then: 'haptics' })
 *   cat.warnings         problems found while loading (e.g. a settings.js that can't run in Node)
 */
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const APP_ROOT = fileURLToPath(new URL('../', import.meta.url));
export const DEFAULT_APP_URL = 'https://handheldlegend.github.io/hoja3/';

const SCHEMA_URL = new URL('../src/settings/schema.js', import.meta.url).href;
const REGISTRY_URL = new URL('../src/sections/registry.js', import.meta.url).href;
const BUILDS_URL = new URL('../src/firmware/builds.js', import.meta.url).href;

/** Query params on #/apply that are not setting keys (mirror of RESERVED in src/settings/apply.js). */
export const APPLY_RESERVED = ['then', 'source'];

/**
 * Plain-language meaning of each capability flag (see computeCaps() in src/device/session.js,
 * which can't be imported in Node because it pulls in the WebUSB driver). Unknown flags fall back
 * to the flag name, so new capabilities never break anything.
 */
export const CAPABILITY_NOTES = {
  analog: 'the controller has at least one analog stick',
  leftStick: 'the controller has a left analog stick',
  rightStick: 'the controller has a right analog stick',
  triggers: 'the controller has analog triggers',
  invertAllowed: 'the firmware allows inverting stick axes',
  rgb: 'the controller has RGB LEDs',
  imu: 'the controller has a gyro/accelerometer (IMU)',
  haptics: 'the controller has rumble (HD or standard)',
  hapticHD: 'the controller has HD (linear) haptics',
  battery: 'the controller has a battery',
  bluetooth: 'the controller has Bluetooth',
  wlan: 'the controller supports the WLAN dongle',
  wireless: 'the controller has wireless (Bluetooth) hardware',
  externalBaseband: 'the controller has an updatable external wireless module (ESP32)',
  snes: 'the controller supports SNES output',
  joybus: 'the controller supports N64/GameCube (Joybus) output',
};

export const capabilityNote = (flag) => (flag ? CAPABILITY_NOTES[flag] || `capability "${flag}"` : null);

// ---- Hash routes (mirror of buildRoute() in src/app/router.js, which needs `window`) -------------

/** buildRoute('joysticks', { stick: 'left' }) → '#/joysticks?stick=left' */
export function buildRoute(section, params = {}, sub = []) {
  const p = [section === 'home' ? '' : section, ...sub].filter(Boolean).map(encodeURIComponent).join('/');
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => [k, String(v)])).toString();
  return `#/${p}${q ? `?${q}` : ''}`;
}

/** Normalize the app base URL: no hash, no query, trailing slash on directory URLs. */
export function normalizeBase(url) {
  const u = new URL(url || DEFAULT_APP_URL);
  u.hash = '';
  u.search = '';
  if (!u.pathname.endsWith('/') && !/\.[a-z0-9]+$/i.test(u.pathname)) u.pathname += '/';
  return u.href;
}

/**
 * Pull the fixed choices out of a param description, e.g.
 *   'left | right'                                   → ['left', 'right']
 *   'Output profile to edit: switch | xinput | snes' → ['switch', 'xinput', 'snes']
 * Returns null for free-form params.
 */
export function paramChoices(description) {
  const tail = String(description || '').split(':').pop().replace(/\(.*?\)/g, '').trim();
  if (!/^[\w.-]+(\s*\|\s*[\w.-]+)+$/.test(tail)) return null;
  return tail.split('|').map((s) => s.trim());
}

// ---- Settings → public, JSON-safe shape ----------------------------------------------------------

/** Copy every JSON-safe property of a SettingDef (drops get/set and any other functions). */
export function publicSetting(def) {
  const out = { section: def.key.split('.')[0] };
  for (const [k, v] of Object.entries(def)) {
    if (typeof v === 'function' || v === undefined) continue;
    out[k] = k === 'options' && Array.isArray(v)
      ? v.map((o) => Object.fromEntries(Object.entries(o).filter(([, x]) => typeof x !== 'function')))
      : v;
  }
  out.requires = def.requires || null;
  return out;
}

/** One-line human description of a setting's accepted values. */
export function describeRange(def) {
  switch (def.type) {
    case 'number': {
      const unit = def.unit ? (def.unit === '%' ? '%' : ` ${def.unit}`) : '';
      const lo = def.min != null ? `${def.min}${unit}` : '−∞';
      const hi = def.max != null ? `${def.max}${unit}` : '∞';
      return `number ${lo} – ${hi}${def.step && def.step !== 1 ? `, step ${def.step}` : ''}`;
    }
    case 'boolean': return 'on | off';
    case 'enum': return (def.options || []).map((o) => {
      const alias = (o.aliases || []).length ? ` (also: ${o.aliases.join(', ')})` : '';
      return `${o.value} = ${o.label}${alias}`;
    }).join('; ');
    case 'color': return 'hex color like #ff8800';
    case 'text': return `text${def.maxLength ? `, up to ${def.maxLength} bytes` : ''}`;
    default: return def.type;
  }
}

/** Basic structural check so one malformed def can't break the server. Returns an error or null. */
function defProblem(def) {
  if (!def || typeof def !== 'object') return 'not an object';
  if (typeof def.key !== 'string' || !/^[a-z0-9]+\.[A-Za-z0-9_.]+$/.test(def.key)) return `bad key ${JSON.stringify(def.key)}`;
  if (typeof def.label !== 'string') return `${def.key}: missing label`;
  if (!['number', 'boolean', 'enum', 'color', 'text'].includes(def.type)) return `${def.key}: unknown type ${def.type}`;
  if (def.type === 'enum' && !(Array.isArray(def.options) && def.options.length)) return `${def.key}: enum without options`;
  return null;
}

// ---- Loading ----------------------------------------------------------------------------------------

/** Section ids that have a settings.js file on disk. */
function sectionsWithSettings() {
  const dir = path.join(APP_ROOT, 'src', 'sections');
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(path.join(dir, d.name, 'settings.js')))
    .map((d) => d.name);
}

const firstLine = (err) => String(err?.message || err).split('\n')[0];

/**
 * Import schema.js. If it throws (usually one section's settings.js using browser-only APIs),
 * find the offending sections by importing fresh copies of the graph with sections stubbed out,
 * then import once more with only the offenders stubbed. See safe-import-hooks.mjs.
 * @returns {Promise<{schema: object|null, skipped: Array<{section: string, error: string}>, error?: string}>}
 */
async function importSchemaSafely() {
  try {
    return { schema: await import(SCHEMA_URL), skipped: [] };
  } catch (firstErr) {
    const { register } = await import('node:module');
    register('./safe-import-hooks.mjs', import.meta.url);
    const ids = sectionsWithSettings();
    let nonce = 0;
    const attempt = (stub) => import(`${SCHEMA_URL}?hhl-safe=${++nonce}&hhl-stub=${stub.join(',')}`);

    const skipped = [];
    for (const id of ids) {
      try { await attempt(ids.filter((x) => x !== id)); } catch (err) { skipped.push({ section: id, error: firstLine(err) }); }
    }
    try {
      return { schema: await attempt(skipped.map((s) => s.section)), skipped };
    } catch (err) {
      return { schema: null, skipped, error: `schema.js could not be loaded: ${firstLine(firstErr)} / ${firstLine(err)}` };
    }
  }
}

/**
 * Load everything assistants need. Never throws for settings problems — they are reported in
 * `warnings` and the affected settings are left out.
 * @param {{ appUrl?: string }} [opts]
 */
export async function loadCatalog({ appUrl = process.env.HHL_APP_URL } = {}) {
  const base = normalizeBase(appUrl);
  const registry = await import(REGISTRY_URL);
  const { schema, skipped, error } = await importSchemaSafely();
  const warnings = [];
  if (error) warnings.push(error);
  for (const s of skipped) warnings.push(`Skipped settings for section "${s.section}" (settings.js failed to import in Node): ${s.error}`);

  // Validate defs individually and drop malformed ones.
  const defs = [];
  const seen = new Set();
  for (const def of schema?.SETTINGS || []) {
    const problem = defProblem(def);
    if (problem) { warnings.push(`Ignored malformed setting: ${problem}`); continue; }
    if (seen.has(def.key)) { warnings.push(`Ignored duplicate setting key ${def.key}`); continue; }
    seen.add(def.key);
    defs.push(def);
  }
  const defByKey = new Map(defs.map((d) => [d.key, d]));

  const pages = registry.SECTIONS.map((s) => ({
    id: s.id,
    title: s.title,
    summary: s.summary,
    group: registry.GROUPS.find((g) => g.id === s.group)?.title || s.group,
    needsController: !!s.device,
    requires: s.requires || null,
    requiresNote: capabilityNote(s.requires),
    keywords: s.keywords || [],
    params: Object.entries(s.params || {}).map(([name, description]) => ({ name, description, choices: paramChoices(description) })),
    settingKeys: defs.filter((d) => d.key.startsWith(`${s.id}.`)).map((d) => d.key),
    url: base + buildRoute(s.id),
  }));
  const pageById = new Map(pages.map((p) => [p.id, p]));

  const coerce = schema?.coerceValue;
  const format = schema?.formatValue || ((def, v) => String(v));

  /** Validate a page + params and build its URL. */
  function pageLink(pageId, params = {}) {
    const page = pageById.get(pageId);
    if (!page) return { ok: false, errors: [`Unknown page "${pageId}". Valid pages: ${pages.map((p) => p.id).join(', ')}`] };
    const errors = [];
    const warn = [];
    const clean = {};
    for (const [name, value] of Object.entries(params || {})) {
      const p = page.params.find((x) => x.name === name);
      if (!p) {
        errors.push(page.params.length
          ? `Page "${pageId}" has no "${name}" parameter. Valid: ${page.params.map((x) => x.name).join(', ')}`
          : `Page "${pageId}" takes no parameters`);
        continue;
      }
      if (value == null || value === '') continue;
      if (p.choices && !p.choices.includes(String(value))) warn.push(`"${value}" is not a documented value for ${name} (${p.choices.join(' | ')})`);
      clean[name] = String(value);
    }
    if (errors.length) return { ok: false, errors, warnings: warn };
    return { ok: true, url: base + buildRoute(pageId, clean), page, params: clean, warnings: warn };
  }

  /** The string used for a value in an #/apply link (readable alias for numeric enums). */
  function linkValue(def, value) {
    if (def.type === 'enum') {
      const opt = def.options.find((o) => o.value === value);
      for (const cand of [...(opt?.aliases || []), opt?.value]) {
        if (cand == null || /\s/.test(String(cand))) continue;
        const r = coerce(def, cand);
        if (r.ok && r.value === value) return String(cand);
      }
    }
    if (def.type === 'boolean') return value ? 'on' : 'off';
    return String(value);
  }

  /**
   * Validate {key: value} pairs and build an #/apply link.
   * @returns {{ ok, url?, changes: Array<{key,label,value,display,requires,page}>, errors: string[], summary: string }}
   */
  function planSettingsLink(values, { then } = {}) {
    const errors = [];
    const changes = [];
    if (!coerce) errors.push('The settings catalog is unavailable on this server (see warnings).');
    else {
      for (const [key, raw] of Object.entries(values || {})) {
        if (APPLY_RESERVED.includes(key)) { errors.push(`"${key}" is reserved and can't be used as a setting key`); continue; }
        const def = defByKey.get(key);
        if (!def) { errors.push(`Unknown setting "${key}". Use list_settings to see valid keys.`); continue; }
        const r = coerce(def, raw);
        if (!r.ok) { errors.push(r.error); continue; }
        changes.push({ key, label: def.label, value: r.value, display: format(def, r.value), requires: def.requires || null, page: key.split('.')[0], link: linkValue(def, r.value) });
      }
    }
    if (then != null && then !== '' && !pageById.has(then)) errors.push(`Unknown "then" page "${then}"`);
    const thenPage = pageById.has(then) ? then : (changes.length ? changes[0].page : 'home');
    const query = Object.fromEntries(changes.map((c) => [c.key, c.link]));
    query.then = thenPage;
    query.source = 'assistant';
    const url = changes.length ? base + buildRoute('apply', query) : null;
    const lines = changes.map((c) => `• ${c.label} (${c.key}) → ${c.display}${c.requires ? ` [needs: ${capabilityNote(c.requires)}]` : ''}`);
    const summary = changes.length
      ? `This link will ask to change ${changes.length} setting${changes.length === 1 ? '' : 's'}:\n${lines.join('\n')}\n` +
        `Afterwards it opens the "${pageById.get(thenPage)?.title || thenPage}" page.`
      : 'No valid changes — no link was created.';
    return { ok: changes.length > 0 && errors.length === 0, url, changes: changes.map(({ link, ...c }) => c), errors, then: thenPage, summary };
  }

  return {
    base,
    groups: registry.GROUPS,
    pages,
    settings: defs.map(publicSetting),
    getPage: (id) => pageById.get(id) || null,
    getSetting: (key) => (defByKey.has(key) ? publicSetting(defByKey.get(key)) : null),
    settingsFor: (sectionId) => defs.filter((d) => d.key.startsWith(`${sectionId}.`)).map(publicSetting),
    describeRange: (key) => (defByKey.has(key) ? describeRange(defByKey.get(key)) : null),
    pageUrl: (id, params) => pageLink(id, params),
    planSettingsLink,
    warnings,
    skippedSections: skipped,
  };
}

// ---- Firmware builds ----------------------------------------------------------------------------

/**
 * Firmware build list. Offline (default): the friendly-name table in src/firmware/builds.js.
 * live: asks GitHub (via builds.js listBuilds()) and falls back to the offline list on failure.
 */
export async function firmwareBuilds({ live = false, base = normalizeBase(process.env.HHL_APP_URL) } = {}) {
  const builds = await import(BUILDS_URL);
  const link = (id) => base + buildRoute('firmware', { build: id });
  const nuke = { id: builds.NUKE_BUILD.id, label: builds.NUKE_BUILD.label, danger: true,
    note: 'Erases the whole flash (all settings). Recovery only — reinstall the right build afterwards.' };
  if (!live) {
    const list = Object.entries(builds.DISPLAY_NAMES).map(([id, label]) => ({ id, label, installLink: link(id) }))
      .sort((a, b) => a.label.localeCompare(b.label));
    return { source: 'offline (built-in name table)', builds: list, nuke };
  }
  const { builds: list, offline } = await builds.listBuilds();
  return {
    source: offline ? 'offline fallback (GitHub unreachable)' : 'live (github.com/HandHeldLegend/hoja-device-fw)',
    builds: list.map((b) => ({ id: b.id, label: b.label, uf2Url: b.uf2Url, manifestUrl: b.manifestUrl, installLink: link(b.id) })),
    nuke,
  };
}

/** App version from package.json (used as the MCP server version). */
export function appVersion() {
  try { return JSON.parse(readFileSync(path.join(APP_ROOT, 'package.json'), 'utf8')).version || '0.0.0'; } catch { return '0.0.0'; }
}

