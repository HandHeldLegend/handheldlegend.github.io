#!/usr/bin/env node
/**
 * gen-docs.mjs — Regenerate the assistant/deep-link docs from the app's own registry and settings schema.
 *
 *   node tools/gen-docs.mjs                 write llms.txt and docs/DEEPLINKS.md
 *   node tools/gen-docs.mjs --check         exit 1 if either file is out of date (for CI)
 *   node tools/gen-docs.mjs --base=<url>    use another app URL in links (default: production)
 *
 * Run it after adding a page to src/sections/registry.js or a SettingDef to any settings.js.
 * The MCP server renders the same documents on the fly (mcp/docs.mjs), so it is never stale either way.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { loadCatalog, APP_ROOT, DEFAULT_APP_URL } from '../mcp/catalog.mjs';
import { renderLlmsTxt, renderDeepLinksMd } from '../mcp/docs.mjs';

const args = process.argv.slice(2);
const check = args.includes('--check');
const base = args.find((a) => a.startsWith('--base='))?.slice(7) || DEFAULT_APP_URL;

const cat = await loadCatalog({ appUrl: base });
for (const w of cat.warnings) console.warn(`warning: ${w}`);

const outputs = [
  ['llms.txt', renderLlmsTxt(cat)],
  [path.join('docs', 'DEEPLINKS.md'), renderDeepLinksMd(cat)],
];

let stale = 0;
for (const [rel, text] of outputs) {
  const file = path.join(APP_ROOT, rel);
  let current = null;
  try { current = readFileSync(file, 'utf8'); } catch { /* new file */ }
  if (current === text) { console.log(`up to date  ${rel}`); continue; }
  if (check) { console.log(`STALE       ${rel}`); stale++; continue; }
  writeFileSync(file, text);
  console.log(`wrote       ${rel} (${text.length.toLocaleString()} chars)`);
}
console.log(`${cat.pages.length} pages, ${cat.settings.length} settings, links → ${cat.base}`);
if (stale) {
  console.error('Docs are out of date — run: node tools/gen-docs.mjs');
  process.exit(1);
}
