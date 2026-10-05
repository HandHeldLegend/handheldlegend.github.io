#!/usr/bin/env node
/**
 * sync-firmware.mjs — Generate the app's binary memory layout from the HOJA firmware headers.
 *
 * The firmware (HOJA-LIB-RP2040) is the single source of truth for every config block and
 * static-info block the controller exposes over WebUSB. This tool reads the C headers
 * directly, computes packed struct layouts (including bitfields and nested structs), pulls
 * out enums (block ids, command ids, input codes, ...) and numeric #defines, validates the
 * result against the headers' own `_Static_assert(sizeof(...) == N)` checks, and writes
 * a plain ES module the browser app (and the MCP server) import.
 *
 * Zero dependencies. Usage:
 *   node tools/sync-firmware.mjs                         # auto-detect a local checkout
 *   node tools/sync-firmware.mjs --lib ../../hoja-device-fw/library/HOJA-LIB-RP2040
 *   node tools/sync-firmware.mjs --github main           # fetch headers from GitHub (branch/tag/sha)
 *   node tools/sync-firmware.mjs --check                 # exit 1 if the generated file is stale
 *
 * Output: src/device/generated/fw-layout.js   (do not edit by hand)
 */
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(HERE, '..');
const OUT_FILE = path.join(APP_ROOT, 'src/device/generated/fw-layout.js');

const GITHUB_REPO = 'HandHeldLegend/HOJA-LIB-RP2040';

/** Headers to read, in dependency order (structs may reference structs from earlier files). */
const HEADERS = [
  'include/hoja_shared_types.h',
  'include/input_shared_types.h',
  'include/settings_shared_types.h',
  'include/utilities/static_config.h',
];

/** Candidate local checkouts, relative to the folder that contains the website repo. */
const LOCAL_CANDIDATES = [
  '../hoja-device-fw/library/HOJA-LIB-RP2040',
  '../HOJA-LIB-RP2040',
];

const PRIMITIVES = {
  uint8_t: { code: 'u8', size: 1 },
  int8_t: { code: 'i8', size: 1 },
  bool: { code: 'u8', size: 1 },
  char: { code: 'u8', size: 1 },
  uint16_t: { code: 'u16', size: 2 },
  int16_t: { code: 'i16', size: 2 },
  uint32_t: { code: 'u32', size: 4 },
  int32_t: { code: 'i32', size: 4 },
  int: { code: 'i32', size: 4 },
  float: { code: 'f32', size: 4 },
};

// ---------------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { lib: null, github: null, check: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--lib') args.lib = argv[++i];
    else if (a === '--github') args.github = argv[++i] || 'main';
    else if (a === '--check') args.check = true;
    else if (a === '-h' || a === '--help') {
      console.log('Usage: node tools/sync-firmware.mjs [--lib <path> | --github <ref>] [--check]');
      process.exit(0);
    }
  }
  return args;
}

async function exists(p) {
  try { await access(p); return true; } catch { return false; }
}

/** Resolve header sources. Returns { files: {relPath: text}, source: {...} }. */
async function loadHeaders(args) {
  if (args.github) {
    const ref = args.github;
    const files = {};
    for (const rel of HEADERS) {
      const url = `https://raw.githubusercontent.com/${GITHUB_REPO}/${ref}/${rel}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
      files[rel] = await res.text();
    }
    return { files, source: { kind: 'github', repo: GITHUB_REPO, ref } };
  }

  let libDir = args.lib ? path.resolve(args.lib) : null;
  if (!libDir) {
    for (const cand of LOCAL_CANDIDATES) {
      const p = path.resolve(APP_ROOT, '..', cand);
      if (await exists(path.join(p, HEADERS[2]))) { libDir = p; break; }
    }
  }
  if (!libDir) throw new Error('Could not find HOJA-LIB-RP2040. Pass --lib <path> or --github <ref>.');

  const files = {};
  for (const rel of HEADERS) files[rel] = await readFile(path.join(libDir, rel), 'utf8');

  let commit = null;
  try {
    commit = execSync('git rev-parse --short HEAD', { cwd: libDir, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim();
  } catch { /* not a git checkout */ }
  return { files, source: { kind: 'local', repo: GITHUB_REPO, ref: commit } };
}

// ---------------------------------------------------------------------------------------------
// C header parsing (intentionally small: handles the subset of C the HOJA headers use)
// ---------------------------------------------------------------------------------------------

/** Remove block comments but keep line comments (they become field docs). */
function stripBlockComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
}

function parseNumber(token, defines) {
  if (token == null) return null;
  const t = String(token).trim().replace(/[uUlL]+$/, '');
  if (/^-?0x[0-9a-f]+$/i.test(t)) return parseInt(t, 16);
  if (/^-?\d+$/.test(t)) return parseInt(t, 10);
  if (defines && t in defines) return defines[t];
  return null;
}

function parseDefines(src, defines) {
  const re = /^\s*#define\s+([A-Z_][A-Z0-9_]*)\s+(\(?-?(?:0x[0-9a-fA-F]+|\d+)[uUlL]*\)?)\s*(?:\/\/\s*(.*))?$/gm;
  let m;
  while ((m = re.exec(src))) {
    const v = parseNumber(m[2].replace(/[()]/g, ''));
    if (v != null) defines[m[1]] = v;
  }
}

function parseEnums(src, enums, defines) {
  const re = /typedef\s+enum\s*\{([\s\S]*?)\}\s*(\w+)\s*;/g;
  let m;
  while ((m = re.exec(src))) {
    const [, body, name] = m;
    const values = [];
    let next = 0;
    for (const raw of body.split('\n')) {
      const docMatch = raw.match(/\/\/\s*(.*)$/);
      const line = raw.replace(/\/\/.*$/, '').trim();
      if (!line) continue;
      for (const part of line.split(',')) {
        const p = part.trim();
        if (!p) continue;
        const em = p.match(/^(\w+)\s*(?:=\s*(.+))?$/);
        if (!em) continue;
        let value = next;
        if (em[2] != null) {
          const v = parseNumber(em[2], defines);
          if (v == null) {
            // Allow references to earlier members of the same enum.
            const prev = values.find((x) => x.name === em[2].trim());
            value = prev ? prev.value : next;
          } else value = v;
        }
        values.push({ name: em[1], value, ...(docMatch ? { doc: docMatch[1].trim() } : {}) });
        next = value + 1;
      }
    }
    enums[name] = values;
  }
}

/** Find which character ranges are inside `#pragma pack(push, 1)` ... `#pragma pack(pop)`. */
function packedRanges(src) {
  const ranges = [];
  const re = /#pragma\s+pack\s*\(\s*(push\s*,\s*1|pop)\s*\)/g;
  let start = null;
  let m;
  while ((m = re.exec(src))) {
    if (m[1].startsWith('push')) start = m.index;
    else if (start != null) { ranges.push([start, m.index]); start = null; }
  }
  return ranges;
}

function parseStructs(src, structs, enums, defines, warnings) {
  const packed = packedRanges(src);
  const re = /typedef\s+struct\s*(?:\w+\s*)?\{([\s\S]*?)\}\s*(\w+)\s*;/g;
  let m;
  while ((m = re.exec(src))) {
    const [, body, name] = m;
    const isPacked = packed.some(([a, b]) => m.index > a && m.index < b);
    if (!isPacked) continue; // Only packed structs cross the USB wire.
    try {
      structs[name] = layoutStruct(name, body, structs, enums, defines);
    } catch (err) {
      warnings.push(`skipped ${name}: ${err.message}`);
    }
  }
}

function resolveType(typeName, structs, enums) {
  if (PRIMITIVES[typeName]) return { kind: 'prim', ...PRIMITIVES[typeName] };
  if (structs[typeName]) return { kind: 'struct', struct: typeName, size: structs[typeName].size };
  if (enums[typeName]) return { kind: 'prim', code: 'i32', size: 4 }; // C enums are int-sized
  return null;
}

/**
 * Lay out a packed struct body. GCC little-endian bitfield rules for pack(1): consecutive
 * bitfields share a storage unit of their declared type while they fit; bits fill from LSB.
 */
function layoutStruct(name, body, structs, enums, defines) {
  const fields = [];
  let offset = 0;
  let unit = null; // { offset, size, used }

  const fieldRe = /^\s*(?:const\s+)?(\w+)\s+(\w+)\s*(?:\[\s*(\w+)\s*\])?\s*(?::\s*(\w+))?\s*;\s*(?:\/\/\s*(.*))?$/;

  for (const raw of body.split('\n')) {
    if (!raw.trim() || /^\s*\/\//.test(raw)) continue;
    const fm = raw.match(fieldRe);
    if (!fm) {
      if (raw.replace(/\/\/.*$/, '').trim()) throw new Error(`unparsed line "${raw.trim()}"`);
      continue;
    }
    const [, typeName, fieldName, countTok, bitsTok, docRaw] = fm;
    const type = resolveType(typeName, structs, enums);
    if (!type) throw new Error(`unknown type ${typeName} for ${fieldName}`);
    const doc = docRaw ? docRaw.replace(/\s*SIZE=\d+\s*/i, '').trim() : '';

    if (bitsTok != null) {
      const width = parseNumber(bitsTok, defines);
      if (type.kind !== 'prim') throw new Error(`bitfield on non-primitive ${fieldName}`);
      if (!unit || unit.size !== type.size || unit.used + width > type.size * 8) {
        unit = { offset, size: type.size, used: 0 };
        offset += type.size;
      }
      fields.push({ name: fieldName, type: type.code, offset: unit.offset, bits: { shift: unit.used, width }, ...(doc && { doc }) });
      unit.used += width;
      continue;
    }

    unit = null;
    const count = countTok != null ? parseNumber(countTok, defines) : 1;
    if (count == null) throw new Error(`unresolved array size ${countTok}`);
    const field = { name: fieldName, offset };
    if (type.kind === 'struct') field.struct = type.struct;
    else field.type = type.code;
    if (countTok != null) field.count = count;
    if (doc) field.doc = doc;
    fields.push(field);
    offset += type.size * count;
  }
  return { size: offset, fields };
}

function parseStaticAsserts(src, defines) {
  const out = [];
  const re = /_Static_assert\s*\(\s*sizeof\s*\(\s*(\w+)\s*\)\s*==\s*(\w+)/g;
  let m;
  while ((m = re.exec(src))) out.push({ struct: m[1], size: parseNumber(m[2], defines) });
  return out;
}

/** Trailing "// 1024 bytes" comments after a struct close are also treated as size checks. */
function parseSizeComments(src) {
  const out = [];
  const re = /\}\s*(\w+_s)\s*;\s*\/\/\s*(\d+)\s*bytes/g;
  let m;
  while ((m = re.exec(src))) out.push({ struct: m[1], size: Number(m[2]) });
  return out;
}

// ---------------------------------------------------------------------------------------------
// Block tables
// ---------------------------------------------------------------------------------------------

/** CFG_BLOCK_GAMEPAD -> { key: 'gamepad', struct: 'gamepadConfig_s' } */
function blockTable(enumValues, prefix, structSuffix, structs, warnings) {
  return enumValues
    .filter((e) => e.name.startsWith(prefix) && !e.name.endsWith('_MAX'))
    .map((e) => {
      const key = e.name.slice(prefix.length).toLowerCase();
      const struct = `${key}${structSuffix}`;
      if (!structs[struct]) warnings.push(`no struct ${struct} for ${e.name}`);
      return { index: e.value, key, struct };
    });
}

/** Turn command enums into { gamepad: { REFRESH: 0, RESET_TO_BOOTLOADER: 1, ... }, ... } */
function commandTable(enums) {
  const map = {
    gamepad_cmd_t: ['gamepad', 'GAMEPAD_CMD_'],
    mapper_cmd_t: ['input', 'MAPPER_CMD_'],
    analog_cmd_t: ['analog', 'ANALOG_CMD_'],
    rgb_cmd_t: ['rgb', 'RGB_CMD_'],
    imu_cmd_t: ['imu', 'IMU_CMD_'],
    haptic_cmd_t: ['haptic', 'HAPTIC_CMD_'],
  };
  const out = {};
  for (const [enumName, [block, prefix]] of Object.entries(map)) {
    if (!enums[enumName]) continue;
    out[block] = Object.fromEntries(enums[enumName].map((e) => [e.name.replace(prefix, ''), e.value]));
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { files, source } = await loadHeaders(args);

  const defines = {};
  const enums = {};
  const structs = {};
  const warnings = [];
  const checks = [];

  for (const rel of HEADERS) {
    const src = stripBlockComments(files[rel].replace(/\r\n?/g, '\n'));
    parseDefines(src, defines);
    parseEnums(src, enums, defines);
    parseStructs(src, structs, enums, defines, warnings);
    checks.push(...parseStaticAsserts(src, defines), ...parseSizeComments(src));
  }

  // Validate against the firmware's own size assertions.
  const errors = [];
  for (const c of checks) {
    const s = structs[c.struct];
    if (!s) continue;
    if (s.size !== c.size) errors.push(`${c.struct}: computed ${s.size} bytes, header asserts ${c.size}`);
  }
  if (errors.length) {
    console.error('Layout validation FAILED:\n  ' + errors.join('\n  '));
    process.exit(2);
  }

  const layout = {
    source,
    blocks: {
      config: blockTable(enums.cfg_block_t || [], 'CFG_BLOCK_', 'Config_s', structs, warnings),
      static: blockTable(enums.static_block_t || [], 'STATIC_BLOCK_', 'InfoStatic_s', structs, warnings),
    },
    commands: commandTable(enums),
    structs,
    enums,
    defines,
  };

  const banner = [
    '// GENERATED FILE — do not edit by hand.',
    '// Source of truth: HOJA-LIB-RP2040 headers (' + HEADERS.join(', ') + ').',
    `// Regenerate with: node tools/sync-firmware.mjs   (source: ${source.kind} ${source.repo}@${source.ref ?? 'unknown'})`,
    `// Validated ${checks.length} size assertion(s) from the firmware headers.`,
    '',
  ].join('\n');
  const text = `${banner}export default ${JSON.stringify(layout, null, 1)};\n`;

  if (args.check) {
    const current = (await exists(OUT_FILE)) ? await readFile(OUT_FILE, 'utf8') : '';
    const strip = (t) => t.replace(/^\/\/.*$/gm, '').replace(/"ref":\s*"[^"]*"/, '');
    if (strip(current) !== strip(text)) {
      console.error('fw-layout.js is stale. Run: node tools/sync-firmware.mjs');
      process.exit(1);
    }
    console.log('fw-layout.js is up to date.');
    return;
  }

  await mkdir(path.dirname(OUT_FILE), { recursive: true });
  await writeFile(OUT_FILE, text);
  for (const w of warnings) console.warn('warn:', w);
  console.log(`Wrote ${path.relative(APP_ROOT, OUT_FILE)}: ${Object.keys(structs).length} structs, ` +
    `${Object.keys(enums).length} enums, ${checks.length} size checks passed ` +
    `(${source.kind} ${source.ref ?? ''}).`);
}

main().catch((err) => { console.error(err.message || err); process.exit(1); });
