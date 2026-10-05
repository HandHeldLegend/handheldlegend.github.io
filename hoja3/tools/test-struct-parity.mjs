#!/usr/bin/env node
/**
 * test-struct-parity.mjs — Cross-check the generic struct runtime against hoja2's generated parsers.
 *
 * Fills random buffers, then compares every field both implementations know about. Fields that
 * exist only on one side are listed (usually new firmware fields hoja2 never got).
 * Skips gracefully when ../hoja2 is not present.
 */
import { readdir, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createStruct, LAYOUT } from '../src/device/struct.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OLD_DIR = path.resolve(HERE, '../../hoja2/factory/parsers');

function same(a, b) {
  if (ArrayBuffer.isView(a) || Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!same(a[i], b[i])) return false;
    return true;
  }
  if (a && typeof a === 'object' && a.buffer) return same(a.buffer, b.buffer);
  if (typeof a === 'number' && Number.isNaN(a)) return Number.isNaN(b);
  // hoja2's uint32 getters returned signed values (a latent bug); treat the unsigned value as equal.
  if (typeof a === 'number' && a < 0 && (a >>> 0) === b) return true;
  return a === b;
}

export async function run() {
  try { await access(OLD_DIR); } catch { console.log('parity: hoja2 parsers not found, skipping'); return 0; }
  let failures = 0;
  for (const file of await readdir(OLD_DIR)) {
    const structName = file.replace(/\.js$/, '_s');
    if (!LAYOUT.structs[structName]) { console.log(`parity: ${structName} not in firmware layout (skipped)`); continue; }
    const Old = (await import(pathToFileURL(path.join(OLD_DIR, file)).href)).default;
    const size = LAYOUT.structs[structName].size;

    for (let trial = 0; trial < 5; trial++) {
      const buf = new Uint8Array(size).map(() => (Math.random() * 256) | 0);
      const oldObj = new Old(buf.slice());
      const newObj = createStruct(structName, buf.slice());
      const newFields = LAYOUT.structs[structName].fields.map((f) => f.name);
      const proto = Object.getOwnPropertyNames(Old.prototype).filter((n) => n !== 'constructor' && n !== 'updateBuffer');

      for (const name of proto) {
        if (!newFields.includes(name)) { if (trial === 0) console.log(`parity: ${structName}.${name} only in hoja2`); continue; }
        if (!same(oldObj[name], newObj[name])) {
          failures++;
          console.error(`parity FAIL ${structName}.${name}: old=${oldObj[name]} new=${newObj[name]}`);
        }
      }
      if (trial === 0) for (const n of newFields) if (!proto.includes(n)) console.log(`parity: ${structName}.${n} new in firmware layout`);

      // Write path: set every scalar via both, buffers must match.
      for (const f of LAYOUT.structs[structName].fields) {
        if (f.count != null || f.struct || !proto.includes(f.name)) continue;
        const v = f.bits ? (trial * 7) % (1 << f.bits.width) : f.type === 'f32' ? 1.5 * trial : trial * 3;
        oldObj[f.name] = v;
        newObj[f.name] = v;
      }
      if (!same(oldObj.buffer, newObj.buffer)) { failures++; console.error(`parity FAIL ${structName}: write mismatch`); }
    }
  }
  console.log(failures ? `parity: ${failures} failure(s)` : 'parity: all shared fields match hoja2');
  return failures;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().then((f) => process.exit(f ? 1 : 0));
}
