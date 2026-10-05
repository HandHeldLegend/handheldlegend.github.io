/**
 * bridge.js — In-page assistant bridge.
 *
 * Exposes the app to AI assistants that run *inside the browser* (agentic browsers, extensions,
 * DevTools automation) in two ways:
 *
 *   1. `window.hhl` — a small promise-based API:
 *        hhl.version                      app version ('dev' until loaded)
 *        hhl.status()                     connection state, controller info, capabilities, unsaved blocks, route
 *        hhl.listPages()                  pages with availability for the connected controller
 *        hhl.listSettings(section?)       setting definitions (+ current value when connected)
 *        hhl.getSetting(key)              one setting (+ current value when connected)
 *        hhl.navigate(page, params?)      open a page (validated against the registry)
 *        hhl.proposeSettings({key: v}, {save?})
 *                                         validates, then opens the SAME confirmation dialog as #/apply links.
 *                                         Resolves with the report once the user decides. Never applies
 *                                         anything without the user pressing Apply.
 *
 *   2. WebMCP — when the browser exposes `navigator.modelContext`, the same functions are registered
 *      as tools (`registerTool`, or `provideContext({ tools })` on older previews). Absent API = no-op.
 *
 * The Node-side counterpart for desktop assistants is mcp/server.mjs.
 */
import { SECTIONS, getSection } from '../sections/registry.js';
import { SETTINGS, getSetting as getDef, settingsForSection, formatValue } from '../settings/schema.js';
import { planChanges, confirmAndApply } from '../settings/apply.js';
import { session } from '../device/session.js';
import { navigate as routerNavigate, currentRoute, buildRoute } from '../app/router.js';
import { unavailableReason } from '../app/shell.js';
import { pwa } from '../app/pwa.js';
import { isDemo } from '../device/mock.js';

const API_VERSION = 1;

// ---- Plain-data helpers ------------------------------------------------------------------------

/** SettingDef without functions (JSON-safe). */
function publicDef(def) {
  const out = { section: def.key.split('.')[0] };
  for (const [k, v] of Object.entries(def)) if (typeof v !== 'function' && v !== undefined) out[k] = v;
  out.requires = def.requires || null;
  return out;
}

/** Public def + live value when a controller is connected and has the hardware. */
function settingInfo(def) {
  const info = publicDef(def);
  const supported = !def.requires || !!session.caps[def.requires];
  info.supported = session.connected ? supported : null;
  if (session.connected && supported) {
    try {
      info.value = def.get(session);
      info.display = formatValue(def, info.value);
    } catch (err) {
      info.value = null;
      info.error = `Could not read: ${err?.message || err}`;
    }
  }
  return info;
}

function pageInfo(s) {
  const reason = unavailableReason(s);
  return {
    id: s.id, title: s.title, summary: s.summary, group: s.group,
    needsController: !!s.device, requires: s.requires || null,
    keywords: s.keywords || [], params: s.params || {},
    available: !reason, unavailableReason: reason,
    hash: buildRoute(s.id),
    settingKeys: settingsForSection(s.id).map((d) => d.key),
  };
}

// ---- API ---------------------------------------------------------------------------------------

function status() {
  return {
    api: API_VERSION,
    app: 'HHL Gamepad Config',
    version: pwa.version || 'dev',
    state: session.state,
    connected: session.connected,
    demo: isDemo(),
    controller: session.connected ? { ...session.info } : null,
    caps: session.connected ? { ...session.caps } : null,
    unsaved: [...session.dirty],
    attention: { ...session.attention },
    route: { ...currentRoute() },
    webusb: typeof navigator !== 'undefined' && !!navigator.usb,
  };
}

function listPages() {
  return SECTIONS.map(pageInfo);
}

function listSettings(section) {
  if (section != null && !getSection(section)) throw new Error(`Unknown section "${section}"`);
  return (section ? settingsForSection(section) : SETTINGS).map(settingInfo);
}

function getSetting(key) {
  const def = getDef(key);
  if (!def) throw new Error(`Unknown setting "${key}"`);
  return settingInfo(def);
}

/** Validate and open a page. Unknown params are rejected so assistants learn the real ones. */
function navigate(page, params = {}) {
  const s = getSection(page);
  if (!s) throw new Error(`Unknown page "${page}". Valid: ${SECTIONS.map((x) => x.id).join(', ')}`);
  const allowed = Object.keys(s.params || {});
  const bad = Object.keys(params || {}).filter((k) => !allowed.includes(k));
  if (bad.length) throw new Error(`Page "${page}" doesn't take ${bad.join(', ')}. Valid params: ${allowed.join(', ') || 'none'}`);
  const clean = Object.fromEntries(Object.entries(params || {}).filter(([, v]) => v != null && v !== '').map(([k, v]) => [k, String(v)]));
  routerNavigate(page, clean);
  return { ok: true, hash: buildRoute(page, clean), available: !unavailableReason(s), unavailableReason: unavailableReason(s) };
}

let proposalOpen = false;

/**
 * Ask the user to confirm and apply settings. Resolves with
 *   { confirmed, choice: 'apply'|'save'|null, applied, skipped, saved, errors }
 * `save: true` (default) highlights "Apply & save"; the user always makes the final choice.
 */
async function proposeSettings(values, { save = true } = {}) {
  if (!values || typeof values !== 'object' || Array.isArray(values)) throw new Error('proposeSettings expects an object of { "section.key": value }');
  if (proposalOpen) throw new Error('Another settings proposal is already waiting for the user.');
  const { changes, errors } = planChanges(values);
  if (!changes.length) return { confirmed: false, choice: null, applied: [], skipped: [], saved: false, errors };
  proposalOpen = true;
  try {
    const report = await confirmAndApply(changes, errors, { source: 'assistant', save });
    return { ...report, errors };
  } finally {
    proposalOpen = false;
  }
}

// ---- WebMCP ------------------------------------------------------------------------------------

const RO = { readOnlyHint: true };

/** Tool definitions in the WebMCP shape ({name, description, inputSchema, execute}). */
function webMcpTools() {
  const wrap = (fn) => async (args = {}) => {
    try {
      const data = await fn(args || {});
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }], structuredContent: data };
    } catch (err) {
      return { content: [{ type: 'text', text: err?.message || String(err) }], isError: true };
    }
  };
  const sectionIds = SECTIONS.map((s) => s.id);
  return [
    {
      name: 'hhl_status',
      description: 'HHL Gamepad Config: connection state, connected controller (name, firmware), hardware capabilities, unsaved changes and the current page.',
      inputSchema: { type: 'object', properties: {} },
      annotations: RO,
      execute: wrap(() => status()),
    },
    {
      name: 'hhl_list_pages',
      description: 'List the app pages with summaries, deep-link params and whether each is available for the connected controller.',
      inputSchema: { type: 'object', properties: {} },
      annotations: RO,
      execute: wrap(() => listPages()),
    },
    {
      name: 'hhl_list_settings',
      description: 'List controller settings (type, range/options, required capability) with current values when a controller is connected. Optionally filter by page id.',
      inputSchema: { type: 'object', properties: { section: { type: 'string', enum: sectionIds, description: 'Page id to filter by.' } } },
      annotations: RO,
      execute: wrap(({ section }) => listSettings(section)),
    },
    {
      name: 'hhl_get_setting',
      description: 'Get one setting definition and its current value (when connected), by key like "haptics.intensity".',
      inputSchema: { type: 'object', properties: { key: { type: 'string' } }, required: ['key'] },
      annotations: RO,
      execute: wrap(({ key }) => getSetting(key)),
    },
    {
      name: 'hhl_navigate',
      description: 'Open a page of the app, optionally with documented deep-link params (e.g. page "joysticks", params {stick: "left"}). Does not change the controller.',
      inputSchema: {
        type: 'object',
        properties: { page: { type: 'string', enum: sectionIds }, params: { type: 'object', additionalProperties: { type: 'string' } } },
        required: ['page'],
      },
      execute: wrap(({ page, params }) => navigate(page, params)),
    },
    {
      name: 'hhl_propose_settings',
      description: 'Propose new setting values. Opens a confirmation dialog showing current → new values; the user must press Apply or Apply & save. Resolves with what was applied (or confirmed:false if canceled). Never claim a change before this returns confirmed:true.',
      inputSchema: {
        type: 'object',
        properties: {
          settings: { type: 'object', description: 'Map of setting key → value, e.g. {"haptics.intensity": 60}.', additionalProperties: { type: ['string', 'number', 'boolean'] } },
          save: { type: 'boolean', description: 'Highlight "Apply & save" (persist to flash). Default true; the user decides.' },
        },
        required: ['settings'],
      },
      execute: wrap(({ settings, save }) => proposeSettings(settings, { save: save !== false })),
    },
  ];
}

/** Register the tools with navigator.modelContext if present. Safe to call more than once. */
let registrations = [];
function registerWebMcp() {
  const mc = typeof navigator !== 'undefined' ? navigator.modelContext : undefined;
  if (!mc) return false;
  for (const r of registrations) { try { r?.unregister?.(); } catch { /* ignore */ } }
  registrations = [];
  const tools = webMcpTools();
  try {
    if (typeof mc.registerTool === 'function') {
      for (const tool of tools) {
        try { registrations.push(mc.registerTool(tool)); } catch (err) { console.warn('[hhl] WebMCP registerTool failed for', tool.name, err); }
      }
      return true;
    }
    if (typeof mc.provideContext === 'function') {
      const r = mc.provideContext({ tools });
      Promise.resolve(r).catch((err) => console.warn('[hhl] WebMCP provideContext failed', err));
      return true;
    }
  } catch (err) {
    console.warn('[hhl] WebMCP registration failed', err);
  }
  return false;
}

// ---- Install -----------------------------------------------------------------------------------

export function installBridge() {
  if (typeof window === 'undefined') return;
  const api = {
    get version() { return pwa.version || 'dev'; },
    api: API_VERSION,
    status,
    listPages,
    listSettings,
    getSetting,
    navigate,
    proposeSettings,
    /** Re-run WebMCP registration (e.g. after a polyfill loads). Returns true if an API was found. */
    registerWebMcp,
    help: 'HHL Gamepad Config assistant bridge. Read-only: status(), listPages(), listSettings(section?), getSetting(key). ' +
      'Actions: navigate(page, params) and proposeSettings({key: value}) — the user must confirm every change. ' +
      'Docs: llms.txt and docs/DEEPLINKS.md next to this page.',
  };
  try {
    Object.defineProperty(window, 'hhl', { value: Object.freeze(api), configurable: true, enumerable: false });
  } catch {
    window.hhl = api;
  }
  registerWebMcp();
}
