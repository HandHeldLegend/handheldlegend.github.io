#!/usr/bin/env node
/**
 * server.mjs — Model Context Protocol server for HHL Gamepad Config (zero dependencies).
 *
 *   node hoja3/mcp/server.mjs            (stdio transport: newline-delimited JSON-RPC 2.0)
 *
 * Lets an AI assistant help customers configure HOJA controllers: it describes every page and
 * setting of the app, builds validated deep links, and serves the troubleshooting knowledge base.
 *
 * SAFETY MODEL: this server never talks to hardware. It only produces links; the customer opens them
 * in the app with the controller connected and must confirm every change in a dialog.
 *
 * Source of truth: the app itself. Pages come from src/sections/registry.js and settings from
 * src/settings/schema.js (imported directly via catalog.mjs), so the server can't drift from the app.
 *
 * Env:
 *   HHL_APP_URL   base URL of the app for generated links (default https://handheldlegend.github.io/hoja3/)
 *   HHL_MCP_DEBUG set to 1 to log every request/response to stderr
 *
 * stdout carries protocol messages only; all logging goes to stderr.
 */
import { createInterface } from 'node:readline';
import {
  loadCatalog, firmwareBuilds, appVersion, capabilityNote, describeRange, APPLY_RESERVED,
} from './catalog.mjs';
import { renderLlmsTxt, renderDeepLinksMd } from './docs.mjs';
import { loadKnowledge, searchKnowledge } from './knowledge.mjs';

const SUPPORTED_PROTOCOLS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const LATEST_PROTOCOL = SUPPORTED_PROTOCOLS[0];
const DEBUG = process.env.HHL_MCP_DEBUG === '1';

const log = (...a) => process.stderr.write(`[hhl-mcp] ${a.join(' ')}\n`);

// JSON-RPC / MCP error codes
const ERR = { PARSE: -32700, INVALID_REQUEST: -32600, METHOD_NOT_FOUND: -32601, INVALID_PARAMS: -32602, INTERNAL: -32603, RESOURCE_NOT_FOUND: -32002 };

class RpcError extends Error {
  constructor(code, message, data) { super(message); this.code = code; this.data = data; }
}

// ---- Startup ------------------------------------------------------------------------------------

const ready = loadCatalog().then((cat) => {
  for (const w of cat.warnings) log('warning:', w);
  log(`ready — ${cat.pages.length} pages, ${cat.settings.length} settings, links → ${cat.base}`);
  return cat;
});

/** Knowledge base is re-read on demand so edits to docs/KNOWLEDGE.md apply without a restart. */
async function kb() { return loadKnowledge((await ready).base); }

const MODES = ['switch', 'xinput', 'snes', 'n64', 'gamecube', 'sinput'];

const INSTRUCTIONS = `HHL Gamepad Config is Hand Held Legend's web app for configuring HOJA-firmware controllers over USB.
Use these tools to help customers: find the right page (list_pages, build_page_link), explain settings (list_settings,
describe_setting), propose changes as a link (build_settings_link) and troubleshoot (troubleshoot).
This server cannot see or change the controller. Settings links open a confirmation dialog in the app — tell the
customer to open the link in Chrome/Edge (desktop or Android) with the controller plugged in, check the list and press
Apply (or Apply & save). Never claim a change was made. Calibration, remapping, pairing and firmware installs are done
by the customer on the page — link them there and walk them through it.`;

// ---- Tiny JSON-Schema validator (just what our inputSchemas use) ---------------------------------

function validate(schema, value, path = 'arguments') {
  const errors = [];
  const types = [].concat(schema.type || []);
  const typeOf = (v) => (Array.isArray(v) ? 'array' : v === null ? 'null' : Number.isInteger(v) ? 'integer' : typeof v);
  if (types.length && !types.some((t) => t === typeOf(value) || (t === 'number' && typeOf(value) === 'integer'))) {
    return [`${path} must be ${types.join(' or ')}`];
  }
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${path} must be one of ${schema.enum.join(', ')}`);
  if (typeOf(value) === 'object') {
    for (const r of schema.required || []) if (!(r in value)) errors.push(`${path}.${r} is required`);
    const props = schema.properties || {};
    for (const [k, v] of Object.entries(value)) {
      if (props[k]) errors.push(...validate(props[k], v, `${path}.${k}`));
      else if (schema.additionalProperties === false) errors.push(`${path}.${k} is not a known parameter`);
      else if (typeof schema.additionalProperties === 'object') errors.push(...validate(schema.additionalProperties, v, `${path}.${k}`));
    }
    if (schema.minProperties && Object.keys(value).length < schema.minProperties) errors.push(`${path} needs at least ${schema.minProperties} entr${schema.minProperties === 1 ? 'y' : 'ies'}`);
  }
  return errors;
}

// ---- Formatting helpers -------------------------------------------------------------------------

const bullet = (s) => `- ${s}`;
function settingLine(s) {
  const needs = s.requires ? ` — needs ${s.requires}` : '';
  return `- \`${s.key}\` **${s.label}** (${describeRange(s)})${needs}${s.description ? `: ${s.description}` : ''}`;
}

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

// ---- Tools --------------------------------------------------------------------------------------

const TOOLS = [
  {
    name: 'list_pages',
    title: 'List app pages',
    description: 'List every page (section) of HHL Gamepad Config with its summary, whether it needs a connected controller, the hardware capability it requires, its documented deep-link parameters and its URL. Start here to find where a customer should go.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { title: 'List app pages', ...READ_ONLY },
    async run(_args, cat) {
      const pages = cat.pages;
      const text = pages.map((p) => {
        const needs = p.needsController ? `needs a connected controller${p.requires ? ` where ${p.requiresNote}` : ''}` : 'works without a controller';
        const params = p.params.length ? `\n  params: ${p.params.map((x) => `\`${x.name}\` — ${x.description}`).join('; ')}` : '';
        const settings = p.settingKeys.length ? `\n  settings: ${p.settingKeys.length} (list_settings section="${p.id}")` : '';
        return `- **${p.title}** (\`${p.id}\`) — ${p.summary} [${needs}]\n  ${p.url}${params}${settings}`;
      }).join('\n');
      return { text: `${pages.length} pages:\n${text}`, structured: { base: cat.base, pages } };
    },
  },
  {
    name: 'list_settings',
    title: 'List settings',
    description: 'List the controller settings that can be read and proposed by key (type, range or options, unit, required capability, description). Optionally filter by page id (e.g. "joysticks", "rgb") and/or a search query. Settings not listed here (calibration, button remapping, angle maps, pairing) are done interactively on their page.',
    inputSchema: {
      type: 'object',
      properties: {
        section: { type: 'string', description: 'Page id to filter by, e.g. "haptics". See list_pages.' },
        query: { type: 'string', description: 'Optional text to match against key, label and description, e.g. "deadzone".' },
      },
      additionalProperties: false,
    },
    annotations: { title: 'List settings', ...READ_ONLY },
    async run({ section, query }, cat) {
      if (section && !cat.getPage(section)) throw new ToolError(`Unknown section "${section}". Valid: ${cat.pages.map((p) => p.id).join(', ')}`);
      let list = section ? cat.settingsFor(section) : cat.settings;
      if (query) {
        const q = query.toLowerCase();
        list = list.filter((s) => [s.key, s.label, s.description, s.tip].some((x) => x && x.toLowerCase().includes(q)));
      }
      const head = `${list.length} setting${list.length === 1 ? '' : 's'}${section ? ` on ${section}` : ''}${query ? ` matching "${query}"` : ''}:`;
      const note = section && !list.length && !query ? '\n(This page has no link-settable settings; send the customer to the page with build_page_link.)' : '';
      return {
        text: `${head}\n${list.map(settingLine).join('\n')}${note}`,
        structured: { settings: list.map((s) => ({ ...s, values: describeRange(s) })), warnings: cat.warnings },
      };
    },
  },
  {
    name: 'describe_setting',
    title: 'Describe a setting',
    description: 'Full details for one setting key (e.g. "haptics.intensity"): label, description, help tip, accepted values, the capability it needs and the page where the customer can change it by hand.',
    inputSchema: {
      type: 'object',
      properties: { key: { type: 'string', description: 'Setting key "<section>.<name>", from list_settings.' } },
      required: ['key'],
      additionalProperties: false,
    },
    annotations: { title: 'Describe a setting', ...READ_ONLY },
    async run({ key }, cat) {
      const s = cat.getSetting(key);
      if (!s) {
        const q = key.toLowerCase().split('.').pop();
        const near = cat.settings.filter((x) => x.key.toLowerCase().includes(q) || x.label.toLowerCase().includes(q)).slice(0, 8).map((x) => x.key);
        throw new ToolError(`Unknown setting "${key}".${near.length ? ` Did you mean: ${near.join(', ')}?` : ' Use list_settings to see valid keys.'}`);
      }
      const page = cat.getPage(s.section);
      const lines = [
        `**${s.label}** (\`${s.key}\`)`,
        s.description,
        s.tip && `Tip: ${s.tip}`,
        `Values: ${describeRange(s)}`,
        s.requires ? `Needs: ${capabilityNote(s.requires)} (\`${s.requires}\`)` : 'Available on every controller.',
        page && `Page: ${page.title} — ${page.url}`,
        'Propose a value with build_settings_link.',
      ].filter(Boolean);
      return { text: lines.join('\n'), structured: { setting: { ...s, values: describeRange(s) }, page: page ? { id: page.id, title: page.title, url: page.url } : null } };
    },
  },
  {
    name: 'build_page_link',
    title: 'Build a page link',
    description: 'Build a deep link that opens a page of the app, optionally with documented query parameters (e.g. page "joysticks" with {stick: "left", tab: "calibrate"}, or "input" with {mode: "xinput"}). Validates the page id and parameter names. Links are safe: opening a page never changes the controller.',
    inputSchema: {
      type: 'object',
      properties: {
        page: { type: 'string', description: 'Page id from list_pages, e.g. "firmware".' },
        params: { type: 'object', description: 'Documented deep-link params for that page.', additionalProperties: { type: ['string', 'number', 'boolean'] } },
      },
      required: ['page'],
      additionalProperties: false,
    },
    annotations: { title: 'Build a page link', ...READ_ONLY },
    async run({ page, params }, cat) {
      const r = cat.pageUrl(page, params || {});
      if (!r.ok) throw new ToolError(r.errors.join('\n'));
      const p = r.page;
      const lines = [
        r.url,
        `Opens **${p.title}** — ${p.summary}`,
        p.needsController && `The customer must connect the controller over USB (Chrome/Edge on desktop or Android)${p.requires ? `; the page only works if ${p.requiresNote}` : ''}.`,
        ...r.warnings.map((w) => `Warning: ${w}`),
      ].filter(Boolean);
      return { text: lines.join('\n'), structured: { url: r.url, page: p.id, params: r.params, warnings: r.warnings } };
    },
  },
  {
    name: 'build_settings_link',
    title: 'Build a settings link',
    description: 'Validate proposed setting values and build an "#/apply" deep link that pre-fills them, plus a human summary of what it will change. Each value is checked exactly like the app does (range, step, options, color format). The customer must open the link in the app with the controller connected; the app shows a before → after confirmation and nothing changes unless they press Apply (live) or Apply & save (written to flash). Settings the controller lacks hardware for are skipped. Always show the summary to the customer with the link and never say the change has been made.',
    inputSchema: {
      type: 'object',
      properties: {
        settings: {
          type: 'object',
          description: 'Map of setting key → value, e.g. {"haptics.intensity": 60, "rgb.mode": "static", "rgb.allColors": "#ff8800"}. Booleans accept true/false/on/off.',
          additionalProperties: { type: ['string', 'number', 'boolean'] },
          minProperties: 1,
        },
        then: { type: 'string', description: 'Page id to show after the dialog (default: the page of the first setting).' },
      },
      required: ['settings'],
      additionalProperties: false,
    },
    annotations: { title: 'Build a settings link', ...READ_ONLY },
    async run({ settings, then }, cat) {
      const plan = cat.planSettingsLink(settings, { then });
      const parts = [];
      if (plan.url) parts.push(plan.url, '', plan.summary, '',
        'Open this link in Chrome or Edge (desktop or Android) with the controller plugged in. The app lists every change and asks you to confirm; press **Apply & save** to keep the settings after unplugging.');
      if (plan.errors.length) parts.push('', `${plan.url ? 'Some entries were rejected and left out' : 'No link was created'}:`, ...plan.errors.map(bullet));
      const result = { text: parts.join('\n').trim(), structured: plan };
      if (!plan.url) result.isError = true;
      return result;
    },
  },
  {
    name: 'troubleshoot',
    title: 'Troubleshooting guide',
    description: 'Look up customer troubleshooting guidance from the HHL knowledge base. Pass a topic id or a free-text problem description (e.g. "stick drift", "won\'t connect", "update stuck on RPI-RP2").',
    // Topic ids are appended from docs/KNOWLEDGE.md at tools/list time so they never go stale.
    describe: (k) => `Topic ids: ${k.topics.map((t) => t.id).join(', ')}.`,
    inputSchema: {
      type: 'object',
      properties: { topic: { type: 'string', description: 'Topic id or a short description of the problem.' } },
      required: ['topic'],
      additionalProperties: false,
    },
    annotations: { title: 'Troubleshooting guide', ...READ_ONLY },
    async run({ topic }) {
      const base = await kb();
      const hits = searchKnowledge(base, topic);
      if (!hits.length) {
        return {
          text: `No guide matched "${topic}". Available topics:\n${base.topics.map((t) => `- \`${t.id}\` — ${t.title}`).join('\n')}`,
          structured: { matched: [], topics: base.topics.map(({ id, title }) => ({ id, title })) },
        };
      }
      const [best, ...rest] = hits;
      const second = rest[0] && rest[0].score >= best.score * 0.75 ? rest[0] : null;
      const shown = [best, second].filter(Boolean).map((h) => h.topic);
      const related = rest.filter((h) => h !== second).slice(0, 4).map((h) => h.topic);
      const text = shown.map((t) => `## ${t.title} (\`${t.id}\`)\n\n${t.body}`).join('\n\n') +
        (related.length ? `\n\nRelated topics: ${related.map((t) => `\`${t.id}\``).join(', ')}` : '');
      return { text, structured: { matched: shown.map(({ id, title, body }) => ({ id, title, body })), related: related.map(({ id, title }) => ({ id, title })) } };
    },
  },
  {
    name: 'list_firmware_builds',
    title: 'List firmware builds',
    description: 'List HOJA firmware builds (controller models) the app can install, each with an install link that opens the Firmware page with that build preselected, plus the "nuke" full-reset image. Offline by default (built-in names); set live:true to fetch the current list and UF2 download URLs from GitHub.',
    inputSchema: {
      type: 'object',
      properties: { live: { type: 'boolean', description: 'Fetch the live list from GitHub (needs internet). Default false.' } },
      additionalProperties: false,
    },
    annotations: { title: 'List firmware builds', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    async run({ live = false }, cat) {
      const r = await firmwareBuilds({ live, base: cat.base });
      const text = [
        `${r.builds.length} builds (${r.source}):`,
        ...r.builds.map((b) => `- **${b.label}** (\`${b.id}\`) — install: ${b.installLink}${b.uf2Url ? ` — UF2: ${b.uf2Url}` : ''}`),
        '',
        `Recovery: **${r.nuke.label}** (\`${r.nuke.id}\`) — ${r.nuke.note}`,
        'Installing the wrong build can stop a controller working until it is re-flashed from BOOTSEL — confirm the exact model first.',
      ].join('\n');
      return { text, structured: r };
    },
  },
];

class ToolError extends Error {}

// ---- Resources ----------------------------------------------------------------------------------

async function resourceList() {
  const cat = await ready;
  const k = await kb();
  return [
    { uri: 'hhl://docs/llms.txt', name: 'llms.txt', title: 'App overview for LLMs', description: 'What the app is, deep links, pages, the full settings catalog and safety notes.', mimeType: 'text/markdown' },
    { uri: 'hhl://docs/deeplinks.md', name: 'DEEPLINKS.md', title: 'Deep link guide', description: 'Human guide to page and settings links.', mimeType: 'text/markdown' },
    { uri: 'hhl://docs/knowledge.md', name: 'KNOWLEDGE.md', title: 'Troubleshooting knowledge base', description: 'All customer troubleshooting topics.', mimeType: 'text/markdown' },
    { uri: 'hhl://catalog/pages.json', name: 'pages.json', title: 'Pages (JSON)', description: 'Machine-readable page catalog.', mimeType: 'application/json' },
    { uri: 'hhl://catalog/settings.json', name: 'settings.json', title: 'Settings (JSON)', description: `Machine-readable catalog of ${cat.settings.length} settings.`, mimeType: 'application/json' },
    ...k.topics.map((t) => ({ uri: `hhl://knowledge/${t.id}`, name: t.id, title: t.title, description: `Troubleshooting: ${t.title}`, mimeType: 'text/markdown' })),
  ];
}

const RESOURCE_TEMPLATES = [
  { uriTemplate: 'hhl://knowledge/{topic}', name: 'knowledge-topic', title: 'Knowledge base topic', description: 'One troubleshooting topic by id.', mimeType: 'text/markdown' },
  { uriTemplate: 'hhl://settings/{key}', name: 'setting', title: 'Setting definition', description: 'One setting by key, e.g. hhl://settings/haptics.intensity.', mimeType: 'application/json' },
];

async function readResource(uri) {
  const cat = await ready;
  const md = (text) => ({ uri, mimeType: 'text/markdown', text });
  const json = (obj) => ({ uri, mimeType: 'application/json', text: JSON.stringify(obj, null, 2) });
  switch (uri) {
    case 'hhl://docs/llms.txt': return md(renderLlmsTxt(cat));
    case 'hhl://docs/deeplinks.md': return md(renderDeepLinksMd(cat));
    case 'hhl://docs/knowledge.md': return md((await kb()).raw);
    case 'hhl://catalog/pages.json': return json({ base: cat.base, groups: cat.groups, pages: cat.pages });
    case 'hhl://catalog/settings.json': return json({ settings: cat.settings.map((s) => ({ ...s, values: describeRange(s) })), reservedApplyParams: APPLY_RESERVED, warnings: cat.warnings });
    default: break;
  }
  let m = uri.match(/^hhl:\/\/knowledge\/([\w-]+)$/);
  if (m) {
    const t = (await kb()).topics.find((x) => x.id === m[1]);
    if (t) return md(`# ${t.title}\n\n${t.body}`);
  }
  m = uri.match(/^hhl:\/\/settings\/(.+)$/);
  if (m) {
    const s = cat.getSetting(decodeURIComponent(m[1]));
    if (s) return json({ ...s, values: describeRange(s) });
  }
  throw new RpcError(ERR.RESOURCE_NOT_FOUND, `Resource not found: ${uri}`, { uri });
}

// ---- Prompts ------------------------------------------------------------------------------------

async function topicText(id) {
  const t = (await kb()).topics.find((x) => x.id === id);
  return t ? `### ${t.title}\n${t.body}` : '';
}

const PROMPTS = [
  {
    name: 'setup-new-controller',
    title: 'Set up a new controller',
    description: 'Walk a customer through first-time setup: connecting, updating firmware, calibrating and saving.',
    arguments: [{ name: 'controller', description: 'Controller model if known (e.g. "GC Ultimate 2", "ProGCC 3.2").', required: false }],
    async build({ controller }) {
      const cat = await ready;
      return `Help me set up my${controller ? ` ${controller}` : ''} HOJA controller with HHL Gamepad Config (${cat.base}).

Guide me one step at a time and wait for me to confirm each step:
1. Check I'm on a supported browser and connect the controller (use the troubleshoot tool for "connecting" if it fails).
2. Check for and install firmware updates (Firmware page — build_page_link page "firmware").
3. Calibrate the sticks and, if it has analog triggers, the triggers.
4. Offer optional tweaks (default mode, rumble, RGB) — propose them with build_settings_link and explain the confirmation dialog.
5. Remind me to press Save.

Reference:
${await topicText('connecting')}

${await topicText('stick-calibration')}

${await topicText('saving')}`;
    },
  },
  {
    name: 'fix-stick-drift',
    title: 'Fix stick drift',
    description: 'Diagnose and fix joystick drift or range problems: recalibrate, then tune deadzones and snapback.',
    arguments: [{ name: 'stick', description: 'left or right (optional).', required: false }],
    async build({ stick }) {
      const cat = await ready;
      const s = stick === 'left' || stick === 'right' ? stick : null;
      const link = cat.pageUrl('joysticks', s ? { stick: s, tab: 'calibrate' } : {}).url;
      return `My controller's ${s ? `${s} ` : ''}stick is drifting or not behaving. Help me fix it.

Ask what I'm seeing (creeping when untouched, not reaching corners, bouncing when released), then:
- Start with recalibration on the Joysticks page: ${link}
- If it still drifts, propose a small inner-deadzone increase with build_settings_link (keys from list_settings section "joysticks") and explain I'll be asked to confirm.
- If it bounces past center on release, explain snapback and link the Snapback page.
- Remind me to Save.

Reference:
${await topicText('stick-drift')}

${await topicText('stick-calibration')}

${await topicText('snapback')}`;
    },
  },
  {
    name: 'remap-for-mode',
    title: 'Remap buttons for an output mode',
    description: 'Help a customer remap buttons for one output mode (Switch, XInput, SNES, N64, GameCube or SInput/Steam).',
    arguments: [
      { name: 'mode', description: `Output mode: ${MODES.join(' | ')}`, required: true },
      { name: 'goal', description: 'What they want to achieve, e.g. "swap A and B" (optional).', required: false },
    ],
    async build({ mode, goal }) {
      const cat = await ready;
      const m = String(mode || '').toLowerCase();
      if (!MODES.includes(m)) throw new RpcError(ERR.INVALID_PARAMS, `mode must be one of ${MODES.join(', ')}`);
      const link = cat.pageUrl('input', { mode: m }).url;
      return `I want to remap buttons for ${m} mode${goal ? `: ${goal}` : ''}.

Button mapping is stored per output mode and is edited interactively (it can't be set by a settings link).
Send me to the Input page with the right profile: ${link}
Then explain step by step how to change the mapping for my goal, remind me that only Switch and Steam (SInput)
modes connect to the app (I can still edit the ${m} profile from there), and to press Save.

Reference:
${await topicText('modes')}

${await topicText('config-mode')}`;
    },
  },
  {
    name: 'update-firmware',
    title: 'Update or install firmware',
    description: 'Walk a customer through a firmware update, a blank-board install or a recovery.',
    arguments: [{ name: 'build', description: 'Firmware build id if known (see list_firmware_builds).', required: false }],
    async build({ build }) {
      const cat = await ready;
      const link = cat.pageUrl('firmware', build ? { build } : {}).url;
      return `Help me update (or install) the firmware on my HOJA controller.

Ask whether the controller still connects normally. If yes, follow the update steps; if it's blank or stuck,
follow the install/recovery steps. Use list_firmware_builds to confirm the exact model before any install.
Firmware page: ${link}

Reference:
${await topicText('firmware-update')}

${await topicText('install-hoja')}

${await topicText('nuke-recovery')}`;
    },
  },
];

// ---- Completions (argument suggestions for prompts and resource templates) -----------------------

async function complete({ ref, argument }) {
  const cat = await ready;
  const v = String(argument?.value || '').toLowerCase();
  let values = [];
  if (ref?.type === 'ref/prompt') {
    if (argument.name === 'mode') values = MODES;
    else if (argument.name === 'stick') values = ['left', 'right'];
    else if (argument.name === 'build' || argument.name === 'controller') {
      const r = await firmwareBuilds({ base: cat.base });
      values = r.builds.map((b) => (argument.name === 'build' ? b.id : b.label));
    }
  } else if (ref?.type === 'ref/resource') {
    if (argument.name === 'topic') values = (await kb()).topics.map((t) => t.id);
    else if (argument.name === 'key') values = cat.settings.map((s) => s.key);
  }
  const matches = values.filter((x) => x.toLowerCase().startsWith(v));
  return { completion: { values: matches.slice(0, 100), total: matches.length, hasMore: matches.length > 100 } };
}

// ---- Dispatcher ---------------------------------------------------------------------------------

let negotiatedVersion = LATEST_PROTOCOL;

const METHODS = {
  async initialize(params = {}) {
    const requested = params.protocolVersion;
    negotiatedVersion = SUPPORTED_PROTOCOLS.includes(requested) ? requested : LATEST_PROTOCOL;
    if (params.clientInfo) log(`client: ${params.clientInfo.name} ${params.clientInfo.version || ''} (protocol ${requested} → ${negotiatedVersion})`);
    return {
      protocolVersion: negotiatedVersion,
      capabilities: {
        tools: { listChanged: false },
        resources: { listChanged: false, subscribe: false },
        prompts: { listChanged: false },
        completions: {},
      },
      serverInfo: { name: 'hhl-gamepad', title: 'HHL Gamepad Config', version: appVersion() },
      instructions: INSTRUCTIONS,
    };
  },
  ping: async () => ({}),

  async 'tools/list'() {
    const k = await kb();
    return {
      tools: TOOLS.map(({ run, describe, ...t }) => {
        const description = describe ? `${t.description} ${describe(k)}` : t.description;
        // 2024-11-05 predates tool titles and annotations.
        return negotiatedVersion === '2024-11-05' ? { name: t.name, description, inputSchema: t.inputSchema } : { ...t, description };
      }),
    };
  },
  async 'tools/call'(params = {}) {
    const tool = TOOLS.find((t) => t.name === params.name);
    if (!tool) throw new RpcError(ERR.INVALID_PARAMS, `Unknown tool: ${params.name}`);
    const args = params.arguments ?? {};
    const problems = validate(tool.inputSchema, args);
    if (problems.length) return { content: [{ type: 'text', text: `Invalid arguments:\n${problems.map(bullet).join('\n')}` }], isError: true };
    const cat = await ready;
    try {
      const r = await tool.run(args, cat);
      const out = { content: [{ type: 'text', text: r.text }] };
      if (r.structured && negotiatedVersion !== '2024-11-05' && negotiatedVersion !== '2025-03-26') out.structuredContent = r.structured;
      if (r.isError) out.isError = true;
      return out;
    } catch (err) {
      if (err instanceof RpcError) throw err;
      if (!(err instanceof ToolError)) log(`tool ${tool.name} failed:`, err?.stack || err);
      return { content: [{ type: 'text', text: err.message || String(err) }], isError: true };
    }
  },

  'resources/list': async () => ({ resources: await resourceList() }),
  'resources/templates/list': async () => ({ resourceTemplates: RESOURCE_TEMPLATES }),
  async 'resources/read'(params = {}) {
    if (typeof params.uri !== 'string') throw new RpcError(ERR.INVALID_PARAMS, 'uri is required');
    return { contents: [await readResource(params.uri)] };
  },

  'prompts/list': async () => ({ prompts: PROMPTS.map(({ build, ...p }) => p) }),
  async 'prompts/get'(params = {}) {
    const p = PROMPTS.find((x) => x.name === params.name);
    if (!p) throw new RpcError(ERR.INVALID_PARAMS, `Unknown prompt: ${params.name}`);
    const args = params.arguments || {};
    for (const a of p.arguments) if (a.required && !args[a.name]) throw new RpcError(ERR.INVALID_PARAMS, `Missing required argument: ${a.name}`);
    return { description: p.description, messages: [{ role: 'user', content: { type: 'text', text: await p.build(args) } }] };
  },

  'completion/complete': (params = {}) => complete(params),
  'logging/setLevel': async () => ({}),
};

/** Notifications we accept silently. */
const NOTIFICATIONS = new Set(['notifications/initialized', 'notifications/canceled', 'notifications/progress', 'notifications/roots/list_changed']);

function send(msg) {
  const line = JSON.stringify(msg);
  if (DEBUG) log('→', line);
  process.stdout.write(`${line}\n`);
}

const errorResponse = (id, code, message, data) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message, ...(data !== undefined ? { data } : {}) } });

/** Handle one JSON-RPC message; returns a response object, or null for notifications/responses. */
async function handle(msg) {
  if (!msg || typeof msg !== 'object' || Array.isArray(msg) || msg.jsonrpc !== '2.0') {
    return errorResponse(msg?.id, ERR.INVALID_REQUEST, 'Invalid Request: expected a JSON-RPC 2.0 object');
  }
  const isRequest = 'id' in msg && msg.id !== null;
  if (typeof msg.method !== 'string') {
    // A response to something we sent (we never send requests) — or garbage.
    return isRequest && !('result' in msg || 'error' in msg) ? errorResponse(msg.id, ERR.INVALID_REQUEST, 'Invalid Request: missing method') : null;
  }
  if (!isRequest) {
    if (!NOTIFICATIONS.has(msg.method) && DEBUG) log('ignored notification', msg.method);
    return null;
  }
  if (typeof msg.id !== 'string' && typeof msg.id !== 'number') return errorResponse(null, ERR.INVALID_REQUEST, 'Invalid Request: id must be a string or number');
  const fn = METHODS[msg.method];
  if (!fn) return errorResponse(msg.id, ERR.METHOD_NOT_FOUND, `Method not found: ${msg.method}`);
  if (msg.params !== undefined && (typeof msg.params !== 'object' || msg.params === null)) {
    return errorResponse(msg.id, ERR.INVALID_PARAMS, 'params must be an object');
  }
  try {
    return { jsonrpc: '2.0', id: msg.id, result: await fn(msg.params) };
  } catch (err) {
    if (err instanceof RpcError) return errorResponse(msg.id, err.code, err.message, err.data);
    log(`${msg.method} failed:`, err?.stack || err);
    return errorResponse(msg.id, ERR.INTERNAL, `Internal error: ${err?.message || err}`);
  }
}

async function onLine(line) {
  if (!line.trim()) return;
  if (DEBUG) log('←', line);
  let msg;
  try { msg = JSON.parse(line); } catch {
    send(errorResponse(null, ERR.PARSE, 'Parse error'));
    return;
  }
  if (Array.isArray(msg)) { // JSON-RPC batch (allowed by 2025-03-26; harmless to support)
    if (!msg.length) { send(errorResponse(null, ERR.INVALID_REQUEST, 'Invalid Request: empty batch')); return; }
    const out = (await Promise.all(msg.map(handle))).filter(Boolean);
    if (out.length) send(out);
    return;
  }
  const res = await handle(msg);
  if (res) send(res);
}

// ---- Transport ----------------------------------------------------------------------------------

const pending = new Set();
const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on('line', (line) => {
  const p = onLine(line).catch((err) => log('unhandled:', err?.stack || err)).finally(() => pending.delete(p));
  pending.add(p);
});
rl.on('close', async () => {
  // Client went away: finish in-flight requests, then let the event loop drain naturally.
  // (Calling process.exit() while a fetch socket is closing trips a libuv assertion on Windows.)
  await Promise.allSettled([...pending]);
  setTimeout(() => process.exit(0), 5000).unref(); // only fires if something keeps the loop alive
});
ready.catch((err) => { log('fatal: could not load the app catalog:', err?.stack || err); process.exit(1); });
