#!/usr/bin/env node
/**
 * test.mjs — Fast, dependency-free checks. Run: node tools/test.mjs  (or npm test)
 *
 *  1. fw-layout.js matches the firmware headers (skipped when no local firmware checkout)
 *  2. generic struct runtime matches hoja2's generated parsers (skipped when hoja2 is absent)
 *  3. every SettingDef is well-formed, round-trips get/set on a blank controller, and coerces values
 *  4. the section registry is consistent (unique ids, view files exist)
 *  5. every JS file parses (node --check)
 *  6. the MCP server smoke test (when present)
 */
import { spawnSync } from 'node:child_process';
import { readdir, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let failures = 0;
const ok = (msg) => console.log(`  ✓ ${msg}`);
const fail = (msg) => { failures++; console.error(`  ✗ ${msg}`); };
const run = (args) => spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8' });

async function exists(p) { try { await access(p); return true; } catch { return false; } }

async function walk(dir, ext) {
  const out = [];
  for (const e of await readdir(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(rel, ext));
    else if (ext.some((x) => e.name.endsWith(x))) out.push(rel);
  }
  return out;
}

console.log('1. Firmware layout');
{
  const r = run(['tools/sync-firmware.mjs', '--check']);
  if (r.status === 0) ok(r.stdout.trim());
  else if (/Could not find HOJA-LIB/.test(r.stderr)) ok('skipped (no local firmware checkout)');
  else fail(r.stderr.trim() || r.stdout.trim());
}

console.log('2. Struct runtime parity');
{
  const { run: parity } = await import('./test-struct-parity.mjs');
  const n = await parity();
  if (n) fail(`${n} parity failure(s)`); else ok('matches hoja2 parsers');
}

console.log('3. Settings schema');
{
  const { SETTINGS, coerceValue } = await import('../src/settings/schema.js');
  const { createStruct, LAYOUT } = await import('../src/device/struct.js');
  const keys = new Set();
  const config = Object.fromEntries(LAYOUT.blocks.config.map((b) => [b.key, createStruct(b.struct)]));
  const stat = Object.fromEntries(LAYOUT.blocks.static.map((b) => [b.key, createStruct(b.struct)]));
  const fake = { config, static: stat, caps: new Proxy({}, { get: () => true }) };
  for (const d of SETTINGS) {
    const where = `setting ${d.key}`;
    if (!/^[a-z]+\.[a-zA-Z0-9]+$/.test(d.key)) fail(`${where}: key must be "<section>.<camelCase>"`);
    if (keys.has(d.key)) fail(`${where}: duplicate key`);
    keys.add(d.key);
    if (!config[d.block]) fail(`${where}: unknown block "${d.block}"`);
    if (!['number', 'boolean', 'enum', 'color', 'text'].includes(d.type)) fail(`${where}: bad type ${d.type}`);
    if (!d.label || typeof d.get !== 'function' || typeof d.set !== 'function') { fail(`${where}: needs label/get/set`); continue; }
    if (d.type === 'enum' && !d.options?.length) fail(`${where}: enum without options`);
    // Round-trip a representative value.
    const sample = { number: d.max ?? 1, boolean: true, enum: d.options?.at(-1)?.value, color: '#123456', text: 'Test' }[d.type];
    try {
      const c = coerceValue(d, sample);
      if (!c.ok) { fail(`${where}: coerce(${sample}) → ${c.error}`); continue; }
      d.set(fake, c.value);
      const back = d.get(fake);
      const close = typeof back === 'number' ? Math.abs(back - c.value) <= (d.step || 1) : back === c.value;
      if (!close) fail(`${where}: set(${c.value}) then get() → ${back}`);
    } catch (err) { fail(`${where}: ${err.message}`); }
  }
  ok(`${SETTINGS.length} settings checked`);
}

console.log('4. Section registry');
{
  const { SECTIONS } = await import('../src/sections/registry.js');
  const ids = new Set();
  for (const s of SECTIONS) {
    if (ids.has(s.id)) fail(`duplicate section ${s.id}`);
    ids.add(s.id);
    if (!(await exists(path.join(ROOT, 'src/sections', s.id, 'view.js')))) fail(`section ${s.id}: missing view.js`);
  }
  ok(`${SECTIONS.length} sections`);
}

console.log('5. Syntax');
{
  const files = [...await walk('src', ['.js']), ...await walk('tools', ['.mjs']), 'sw.js', 'precache-manifest.js'];
  if (await exists(path.join(ROOT, 'mcp'))) files.push(...await walk('mcp', ['.mjs', '.js']));
  let bad = 0;
  for (const f of files) {
    const r = run(['--check', f]);
    if (r.status !== 0) { bad++; fail(`${f}: ${r.stderr.split('\n').find((l) => /Error/.test(l)) || r.stderr}`); }
  }
  if (!bad) ok(`${files.length} files parse`);
}

console.log('6. MCP server');
{
  if (await exists(path.join(ROOT, 'tools/test-mcp.mjs'))) {
    const r = run(['tools/test-mcp.mjs']);
    if (r.status === 0) ok('MCP smoke test passed'); else fail(`MCP: ${(r.stderr || r.stdout).trim().split('\n').slice(-3).join(' | ')}`);
  } else ok('skipped (no MCP test)');
}

console.log(failures ? `\n${failures} failure(s)` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
