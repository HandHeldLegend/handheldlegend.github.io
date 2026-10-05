#!/usr/bin/env node
/**
 * test-mcp.mjs — End-to-end test of mcp/server.mjs over stdio.
 *
 *   node tools/test-mcp.mjs
 *
 * Spawns the server, performs the MCP handshake, lists and calls every tool, reads every resource,
 * gets every prompt and checks protocol error handling. Exits non-zero on the first failed assertion
 * (all failures are listed). Tool results are checked against the live catalog, so the test keeps
 * passing as sections add settings.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadCatalog } from '../mcp/catalog.mjs';

const SERVER = fileURLToPath(new URL('../mcp/server.mjs', import.meta.url));
const BASE = 'https://example.test/hoja3/';
const TIMEOUT_MS = 20000;

// ---- Minimal client ----------------------------------------------------------------------------

const child = spawn(process.execPath, [SERVER], { env: { ...process.env, HHL_APP_URL: BASE }, stdio: ['pipe', 'pipe', 'pipe'] });
let stderr = '';
child.stderr.on('data', (d) => { stderr += d; });

const waiting = new Map();
let buf = '';
const stray = [];
child.stdout.on('data', (d) => {
  buf += d;
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i);
    buf = buf.slice(i + 1);
    if (!line.trim()) continue;
    let msg;
    try { msg = JSON.parse(line); } catch { stray.push(line); continue; }
    const key = Array.isArray(msg) ? 'batch' : msg.id;
    const w = waiting.get(key);
    if (w) { waiting.delete(key); w(msg); } else stray.push(line);
  }
});

let nextId = 1;
function rpc(method, params, { raw } = {}) {
  const id = nextId++;
  const msg = raw ?? { jsonrpc: '2.0', id, method, ...(params !== undefined ? { params } : {}) };
  const key = raw ? (Array.isArray(raw) ? 'batch' : raw.id ?? null) : id;
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for ${method || JSON.stringify(raw)}`)), TIMEOUT_MS);
    waiting.set(key, (m) => { clearTimeout(t); resolve(m); });
    child.stdin.write(`${typeof msg === 'string' ? msg : JSON.stringify(msg)}\n`);
  });
}
const notify = (method, params) => child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method, ...(params ? { params } : {}) })}\n`);
const call = async (name, args) => (await rpc('tools/call', { name, arguments: args })).result;

// ---- Assertions --------------------------------------------------------------------------------

const failures = [];
let passed = 0;
function ok(cond, label, extra) {
  if (cond) { passed++; return true; }
  failures.push(label + (extra !== undefined ? ` — ${typeof extra === 'string' ? extra : JSON.stringify(extra).slice(0, 400)}` : ''));
  return false;
}
const text = (r) => (r?.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');

// ---- Tests -------------------------------------------------------------------------------------

async function main() {
  const cat = await loadCatalog({ appUrl: BASE });

  // Handshake
  const init = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test-mcp', version: '1' } });
  ok(init.result?.protocolVersion === '2025-06-18', 'initialize echoes 2025-06-18', init);
  ok(init.result?.serverInfo?.name === 'hhl-gamepad', 'serverInfo.name');
  ok(init.result?.capabilities?.tools && init.result?.capabilities?.resources && init.result?.capabilities?.prompts, 'capabilities declared');
  ok(typeof init.result?.instructions === 'string' && init.result.instructions.includes('confirm'), 'instructions mention confirmation');
  notify('notifications/initialized');

  const old = await rpc('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'old' } });
  ok(old.result?.protocolVersion === '2024-11-05', 'initialize echoes supported older version');
  const weird = await rpc('initialize', { protocolVersion: '1999-01-01', capabilities: {} });
  ok(weird.result?.protocolVersion === '2025-06-18', 'unsupported version → latest');
  // Back to the current version for the rest of the run.
  await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test-mcp' } });

  ok((await rpc('ping')).result && Object.keys((await rpc('ping')).result).length === 0, 'ping → {}');

  // Errors
  const parse = await rpc(null, null, { raw: '{not json' });
  ok(parse.error?.code === -32700 && parse.id === null, 'parse error -32700', parse);
  const nf = await rpc('does/not/exist');
  ok(nf.error?.code === -32601, 'unknown method -32601', nf);
  const badTool = await rpc('tools/call', { name: 'nope', arguments: {} });
  ok(badTool.error?.code === -32602, 'unknown tool -32602', badTool);
  const badRes = await rpc('resources/read', { uri: 'hhl://nope' });
  ok(badRes.error?.code === -32002, 'unknown resource -32002', badRes);
  const invalid = await rpc(null, null, { raw: { jsonrpc: '1.0', id: 'x', method: 'ping' } });
  ok(invalid.error?.code === -32600, 'invalid request -32600', invalid);

  // tools/list
  const tl = (await rpc('tools/list')).result;
  const names = tl.tools.map((t) => t.name);
  const expected = ['list_pages', 'list_settings', 'describe_setting', 'build_page_link', 'build_settings_link', 'troubleshoot', 'list_firmware_builds'];
  for (const n of expected) ok(names.includes(n), `tools/list has ${n}`);
  for (const t of tl.tools) {
    ok(t.description?.length > 40, `${t.name} has a description`);
    ok(t.inputSchema?.type === 'object', `${t.name} has an object inputSchema`);
    ok(!('run' in t) && !('describe' in t), `${t.name} leaks no internals`);
  }
  ok(tl.tools.find((t) => t.name === 'troubleshoot').description.includes('stick-drift'), 'troubleshoot description lists topic ids');

  // list_pages
  const lp = await call('list_pages', {});
  ok(!lp.isError && lp.structuredContent?.pages?.length === cat.pages.length, 'list_pages returns every page', lp.structuredContent?.pages?.length);
  ok(text(lp).includes(`${BASE}#/joysticks`), 'list_pages uses HHL_APP_URL');
  ok(lp.structuredContent.pages.every((p) => !('load' in p)), 'list_pages has no functions');

  // list_settings
  const ls = await call('list_settings', {});
  ok(!ls.isError && ls.structuredContent.settings.length === cat.settings.length, 'list_settings returns every setting');
  ok(ls.structuredContent.settings.every((s) => !('get' in s) && !('set' in s)), 'list_settings strips get/set');
  ok(cat.settings.length > 0, 'catalog has settings');
  const hs = await call('list_settings', { section: 'haptics' });
  ok(hs.structuredContent.settings.every((s) => s.section === 'haptics'), 'list_settings filters by section');
  ok((await call('list_settings', { section: 'nope' })).isError, 'list_settings rejects unknown section');
  ok((await call('list_settings', { bogus: 1 })).isError, 'list_settings rejects unknown argument');

  // describe_setting — every key
  for (const s of cat.settings) {
    const r = await call('describe_setting', { key: s.key });
    ok(!r.isError && r.structuredContent?.setting?.key === s.key && text(r).includes(s.label), `describe_setting ${s.key}`);
  }
  ok((await call('describe_setting', { key: 'haptics.nope' })).isError, 'describe_setting rejects unknown key');
  ok((await call('describe_setting', {})).isError, 'describe_setting requires key');

  // build_page_link — every page, with every documented param
  for (const p of cat.pages) {
    const params = Object.fromEntries(p.params.map((x) => [x.name, x.choices?.[0] ?? 'x']));
    const r = await call('build_page_link', { page: p.id, params });
    ok(!r.isError && r.structuredContent?.url?.startsWith(`${BASE}#/`), `build_page_link ${p.id}`, text(r));
    const back = new URL(r.structuredContent.url);
    const q = Object.fromEntries(new URLSearchParams(back.hash.split('?')[1] || ''));
    ok(JSON.stringify(q) === JSON.stringify(params), `build_page_link ${p.id} round-trips params`, { q, params });
  }
  const jl = await call('build_page_link', { page: 'joysticks', params: { stick: 'left', tab: 'calibrate' } });
  ok(jl.structuredContent?.url === `${BASE}#/joysticks?stick=left&tab=calibrate`, 'joysticks link exact', jl.structuredContent);
  ok((await call('build_page_link', { page: 'nope' })).isError, 'build_page_link rejects unknown page');
  ok((await call('build_page_link', { page: 'joysticks', params: { color: 'red' } })).isError, 'build_page_link rejects unknown param');
  const warn = await call('build_page_link', { page: 'joysticks', params: { stick: 'middle' } });
  ok(!warn.isError && warn.structuredContent.warnings.length === 1, 'build_page_link warns on undocumented value');

  // build_settings_link — one valid value per setting, and checks the link decodes to the same values
  const sample = (s) => {
    switch (s.type) {
      case 'number': return s.max ?? s.min ?? 1;
      case 'boolean': return true;
      case 'enum': return s.options[s.options.length - 1].value;
      case 'color': return '#12abef';
      case 'text': return 'Test';
      default: return null;
    }
  };
  for (const s of cat.settings) {
    const v = sample(s);
    const r = await call('build_settings_link', { settings: { [s.key]: v } });
    if (!ok(!r.isError && r.structuredContent?.ok, `build_settings_link ${s.key}=${v}`, text(r))) continue;
    const url = new URL(r.structuredContent.url);
    ok(url.hash.startsWith('#/apply?'), `${s.key} link is #/apply`);
    const q = Object.fromEntries(new URLSearchParams(url.hash.split('?')[1]));
    ok(q.source === 'assistant' && q.then === s.section, `${s.key} link has then/source`, q);
    // The value in the link must coerce back to the same value (what the app will do).
    const back = cat.planSettingsLink({ [s.key]: q[s.key] });
    ok(back.ok && JSON.stringify(back.changes[0].value) === JSON.stringify(r.structuredContent.changes[0].value), `${s.key} link value round-trips`, { link: q[s.key], back: back.changes[0]?.value });
  }
  const num = cat.settings.find((s) => s.type === 'number' && s.max != null);
  if (num) {
    const over = await call('build_settings_link', { settings: { [num.key]: num.max + 1000 } });
    ok(over.isError && !over.structuredContent.url && over.structuredContent.errors.length === 1, 'out-of-range value rejected');
  }
  const mixed = await call('build_settings_link', { settings: { 'nope.nope': 1, ...(num ? { [num.key]: num.min ?? 0 } : {}) }, then: 'home' });
  ok(num ? (mixed.structuredContent.url && mixed.structuredContent.errors.length === 1 && text(mixed).includes('rejected')) : mixed.isError, 'partial link keeps valid entries and reports errors', mixed.structuredContent);
  ok((await call('build_settings_link', { settings: {} })).isError, 'empty settings rejected');
  ok((await call('build_settings_link', { settings: { then: 'home' } })).isError, 'reserved key rejected');
  ok((await call('build_settings_link', { settings: num ? { [num.key]: num.min ?? 0 } : { x: 1 }, then: 'nowhere' })).structuredContent.errors.some((e) => e.includes('nowhere')), 'unknown then rejected');

  // troubleshoot
  const kbTopics = ['connecting', 'browser-support', 'config-mode', 'modes', 'data-cables', 'stick-calibration', 'stick-drift', 'snapback',
    'trigger-calibration', 'firmware-update', 'install-hoja', 'nuke-recovery', 'wireless-pairing', 'battery-status', 'saving', 'ios'];
  for (const id of kbTopics) {
    const r = await call('troubleshoot', { topic: id });
    ok(!r.isError && r.structuredContent?.matched?.[0]?.id === id, `troubleshoot ${id}`, r.structuredContent?.matched?.map((m) => m.id));
  }
  const freeText = {
    'my left stick drifts up': 'stick-drift',
    'it wont connect': 'connecting',
    'firefox says usb not supported': 'browser-support',
    'update stuck, I see an RPI-RP2 drive': 'firmware-update',
    'does it work on my iphone': 'ios',
    'settings disappeared after unplugging': 'saving',
    'stick bounces when I let go in melee': 'snapback',
    'PMIC says not responding': 'battery-status',
  };
  for (const [q, id] of Object.entries(freeText)) {
    const r = await call('troubleshoot', { topic: q });
    ok(r.structuredContent?.matched?.some((m) => m.id === id), `troubleshoot "${q}" → ${id}`, r.structuredContent?.matched?.map((m) => m.id));
  }
  const links = await call('troubleshoot', { topic: 'stick-drift' });
  ok(text(links).includes(`${BASE}#/joysticks`), 'troubleshoot expands app links to HHL_APP_URL');
  const none = await call('troubleshoot', { topic: 'zzzz qqqq' });
  ok(!none.isError && none.structuredContent.matched.length === 0 && none.structuredContent.topics.length >= kbTopics.length, 'troubleshoot no-match lists topics');

  // list_firmware_builds (offline; live is exercised only with HHL_TEST_LIVE=1)
  const fb = await call('list_firmware_builds', {});
  ok(!fb.isError && fb.structuredContent.builds.length > 5 && fb.structuredContent.builds.every((b) => b.installLink.startsWith(`${BASE}#/firmware?build=`)), 'list_firmware_builds offline');
  ok(fb.structuredContent.nuke?.id === 'full-reset-nuke', 'list_firmware_builds includes nuke');
  if (process.env.HHL_TEST_LIVE === '1') {
    const live = await call('list_firmware_builds', { live: true });
    ok(!live.isError && live.structuredContent.builds.length > 0, 'list_firmware_builds live', live.structuredContent?.source);
  }

  // resources
  const rl = (await rpc('resources/list')).result.resources;
  ok(rl.some((r) => r.uri === 'hhl://docs/llms.txt') && rl.some((r) => r.uri === 'hhl://docs/knowledge.md'), 'resources/list has docs');
  ok(rl.filter((r) => r.uri.startsWith('hhl://knowledge/')).length >= kbTopics.length, 'resources/list has knowledge topics');
  for (const r of rl) {
    const rr = await rpc('resources/read', { uri: r.uri });
    const c = rr.result?.contents?.[0];
    ok(c?.uri === r.uri && typeof c.text === 'string' && c.text.length > 50, `resources/read ${r.uri}`, rr.error);
    if (c?.mimeType === 'application/json') ok((() => { try { JSON.parse(c.text); return true; } catch { return false; } })(), `${r.uri} is valid JSON`);
  }
  const llms = (await rpc('resources/read', { uri: 'hhl://docs/llms.txt' })).result.contents[0].text;
  ok(llms.startsWith('# HHL Gamepad Config') && cat.settings.every((s) => llms.includes(`\`${s.key}\``)), 'llms.txt lists every setting');
  ok(cat.pages.every((p) => llms.includes(`\`#/${p.id === 'home' ? '' : p.id}\``)), 'llms.txt lists every page');
  const tmpl = (await rpc('resources/templates/list')).result.resourceTemplates;
  ok(tmpl.length >= 2, 'resource templates');
  if (cat.settings[0]) {
    const one = await rpc('resources/read', { uri: `hhl://settings/${cat.settings[0].key}` });
    ok(JSON.parse(one.result.contents[0].text).key === cat.settings[0].key, 'hhl://settings/{key} template');
  }

  // prompts
  const pl = (await rpc('prompts/list')).result.prompts;
  ok(['setup-new-controller', 'fix-stick-drift', 'remap-for-mode'].every((n) => pl.some((p) => p.name === n)), 'prompts/list has the core prompts');
  for (const p of pl) {
    const args = Object.fromEntries(p.arguments.filter((a) => a.required).map((a) => [a.name, a.name === 'mode' ? 'xinput' : 'x']));
    const r = await rpc('prompts/get', { name: p.name, arguments: args });
    const m = r.result?.messages?.[0];
    ok(m?.role === 'user' && m.content?.type === 'text' && m.content.text.length > 100, `prompts/get ${p.name}`, r.error);
  }
  ok((await rpc('prompts/get', { name: 'remap-for-mode', arguments: {} })).error?.code === -32602, 'prompt missing required arg → -32602');
  ok((await rpc('prompts/get', { name: 'remap-for-mode', arguments: { mode: 'atari' } })).error?.code === -32602, 'prompt bad mode → -32602');
  const drift = (await rpc('prompts/get', { name: 'fix-stick-drift', arguments: { stick: 'left' } })).result.messages[0].content.text;
  ok(drift.includes(`${BASE}#/joysticks?stick=left`), 'fix-stick-drift prompt links the left stick');

  // completions
  const comp = await rpc('completion/complete', { ref: { type: 'ref/prompt', name: 'remap-for-mode' }, argument: { name: 'mode', value: 'x' } });
  ok(comp.result?.completion?.values?.includes('xinput'), 'completion for prompt arg');

  // notifications get no response; a stray line would show up in `stray`
  notify('notifications/canceled', { requestId: 999 });
  await rpc('ping');
  ok(stray.length === 0, 'no unexpected output on stdout', stray);
}

const hardTimeout = setTimeout(() => { console.error('test timed out'); child.kill(); process.exit(1); }, 120000);
main()
  .catch((err) => { failures.push(`crashed: ${err?.stack || err}`); })
  .finally(() => {
    clearTimeout(hardTimeout);
    child.stdin.end();
    const warnings = stderr.split('\n').filter((l) => l.includes('warning:'));
    if (warnings.length) console.log(`server warnings:\n  ${warnings.join('\n  ')}`);
    if (failures.length) {
      console.error(`\n${failures.length} FAILED (${passed} passed):\n  ✗ ${failures.join('\n  ✗ ')}`);
      if (stderr.trim()) console.error(`\nserver stderr:\n${stderr}`);
      process.exitCode = 1;
    } else {
      console.log(`MCP server OK — ${passed} checks passed`);
    }
  });
