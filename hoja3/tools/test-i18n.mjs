#!/usr/bin/env node
/**
 * test-i18n.mjs — Check that every user-facing string has Spanish and Japanese translations.
 *
 *   node tools/test-i18n.mjs                    # summary; exit 1 if anything is missing
 *   node tools/test-i18n.mjs --emit es input    # print missing Spanish strings for the "input" area
 *                                               # as ready-to-fill dictionary lines
 *
 * Strings are collected from:
 *   - t('…') and plural(n, '…', '…') calls with literal text in src/**.js (not template literals with ${}),
 *   - N_('…') markers (for literals translated later, e.g. attention texts in session.js),
 *   - registry.js (section titles/summaries, group titles) and every SettingDef (label, description,
 *     tip, placeholder, unit, option labels).
 * Each string belongs to an "area" (src/sections/<id>/ → <id>, settings keys → their section, the rest →
 * core) which maps to src/i18n/locales/<lang>/<area>.js. A string counts as translated if ANY area file of
 * that language has it (shared strings like "Cancel" live in core).
 * Also checks that translations keep the same {placeholders} as the English text.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LANGS = ['es', 'ja'];

async function walk(dir) {
  const out = [];
  for (const e of await readdir(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.posix.join(dir, e.name);
    if (e.isDirectory()) { if (!rel.startsWith('src/i18n/locales')) out.push(...await walk(rel)); }
    else if (e.name.endsWith('.js')) out.push(rel);
  }
  return out;
}

/** Read a JS string literal starting at s[i] (quote char). Returns [value, endIndex] or null. */
function readLiteral(s, i) {
  const q = s[i];
  if (!`'"\``.includes(q)) return null;
  let out = '';
  for (let j = i + 1; j < s.length; j++) {
    const c = s[j];
    if (c === '\\') { const n = s[++j]; out += n === 'n' ? '\n' : n === 't' ? '\t' : n; continue; }
    if (q === '`' && c === '$' && s[j + 1] === '{') return null; // dynamic template: not extractable
    if (c === q) return [out, j + 1];
    out += c;
  }
  return null;
}

const skipWs = (s, i) => { while (i < s.length && /\s/.test(s[i])) i++; return i; };

/** Skip one JS expression up to a top-level comma; returns index of the comma. */
function skipArg(s, i) {
  let depth = 0;
  for (; i < s.length; i++) {
    const c = s[i];
    if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) { if (depth === 0) return -1; depth--; }
    else if (c === ',' && depth === 0) return i;
    else if (`'"\``.includes(c)) { const r = readLiteral(s, i); if (r) i = r[1] - 1; }
  }
  return -1;
}

function extract(src) {
  const found = [];
  const re = /(?<![\w.$])(t|N_|plural)\(/g;
  let m;
  while ((m = re.exec(src))) {
    let i = skipWs(src, m.index + m[0].length);
    if (m[1] === 'plural') {
      const comma = skipArg(src, i);
      if (comma < 0) continue;
      i = skipWs(src, comma + 1);
      const a = readLiteral(src, i);
      if (!a) continue;
      found.push(a[0]);
      i = skipWs(src, a[1]);
      if (src[i] !== ',') continue;
      const b = readLiteral(src, skipWs(src, i + 1));
      if (b) found.push(b[0]);
    } else {
      const lit = readLiteral(src, i);
      if (lit) found.push(lit[0]);
    }
  }
  return found;
}

function areaOf(file) {
  const m = file.match(/^src\/sections\/([^/]+)\//);
  return m && m[1] !== 'registry.js' ? m[1] : 'core';
}

export async function collect() {
  /** @type {Map<string, Set<string>>} text → areas */
  const strings = new Map();
  const add = (text, area) => {
    if (!text || !/[A-Za-z]/.test(text)) return;
    if (!strings.has(text)) strings.set(text, new Set());
    strings.get(text).add(area);
  };
  for (const f of await walk('src')) {
    const src = await readFile(path.join(ROOT, f), 'utf8');
    for (const s of extract(src)) add(s, areaOf(f));
  }
  const { SECTIONS, GROUPS } = await import(pathToFileURL(path.join(ROOT, 'src/sections/registry.js')).href);
  for (const s of SECTIONS) { add(s.title, 'core'); add(s.summary, 'core'); }
  for (const g of GROUPS) add(g.title, 'core');
  const { SETTINGS } = await import(pathToFileURL(path.join(ROOT, 'src/settings/schema.js')).href);
  for (const d of SETTINGS) {
    const area = d.key.split('.')[0];
    for (const v of [d.label, d.description, d.tip, d.placeholder, d.unit]) add(v, area);
    for (const o of d.options || []) add(o.label, area);
  }
  return strings;
}

/** Find English strings that different area files translate differently (they'd fight after merging). */
async function conflicts(lang) {
  const dir = path.join(ROOT, `src/i18n/locales/${lang}`);
  const seen = new Map(); // text -> [{area, value}]
  for (const f of (await readdir(dir)).filter((n) => n.endsWith('.js') && n !== 'index.js')) {
    const area = f.replace(/\.js$/, '');
    const dict = (await import(pathToFileURL(path.join(dir, f)).href)).default || {};
    for (const [k, v] of Object.entries(dict)) {
      if (!seen.has(k)) seen.set(k, []);
      seen.get(k).push({ area, value: v });
    }
  }
  return [...seen].filter(([, list]) => new Set(list.map((x) => x.value)).size > 1);
}

async function loadDict(lang) {
  const mod = await import(pathToFileURL(path.join(ROOT, `src/i18n/locales/${lang}/index.js`)).href);
  return mod.default;
}

const placeholders = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

export async function run({ quiet = false } = {}) {
  const strings = await collect();
  let failures = 0;
  for (const lang of LANGS) {
    const dict = await loadDict(lang);
    const missing = new Map();
    for (const [text, areas] of strings) {
      if (!(text in dict)) {
        const a = [...areas][0];
        if (!missing.has(a)) missing.set(a, []);
        missing.get(a).push(text);
      } else if (placeholders(text) !== placeholders(dict[text])) {
        failures++;
        console.error(`  ✗ ${lang}: placeholders differ for "${text}"`);
      }
    }
    const count = [...missing.values()].reduce((n, l) => n + l.length, 0);
    failures += count;
    if (!quiet || count) {
      console.log(`  ${count ? '✗' : '✓'} ${lang}: ${strings.size - count}/${strings.size} strings translated`);
      for (const [a, list] of [...missing].sort((x, y) => y[1].length - x[1].length)) console.log(`      ${a}: ${list.length} missing`);
    }
    const clash = await conflicts(lang);
    if (clash.length) {
      console.log(`    ${lang}: ${clash.length} string(s) translated differently in different areas (core wins at runtime):`);
      for (const [k, list] of clash.slice(0, 40)) console.log(`      "${k}" → ${list.map((x) => `${x.area}: ${x.value}`).join(' | ')}`);
    }
    const unused = Object.keys(dict).filter((k) => !strings.has(k));
    if (unused.length && !quiet) console.log(`    (${lang}: ${unused.length} dictionary entries not used — fine if intentional)`);
  }
  return failures;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const i = process.argv.indexOf('--emit');
  if (i > -1) {
    const [lang, area] = [process.argv[i + 1], process.argv[i + 2]];
    const strings = await collect();
    const dict = await loadDict(lang);
    for (const [text, areas] of strings) {
      if (text in dict || (area && [...areas][0] !== area)) continue;
      console.log(`  ${JSON.stringify(text)}: '',`);
    }
  } else {
    run().then((f) => process.exit(f ? 1 : 0));
  }
}
