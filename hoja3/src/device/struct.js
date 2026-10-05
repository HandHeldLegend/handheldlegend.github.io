/**
 * struct.js — Typed, little-endian views over firmware memory blocks.
 *
 * Instead of one generated class per C struct, a single factory builds accessor classes
 * from the layout produced by `tools/sync-firmware.mjs` (src/device/generated/fw-layout.js).
 *
 *   const analog = createStruct('analogConfig_s');      // zero-filled buffer of the right size
 *   analog.l_deadzone = 120;                            // writes bytes 682..683
 *   analog.joy_config_l[0].in_angle                     // nested structs work too
 *
 * Semantics intentionally match the old generated hoja2 parsers so ported code behaves the same:
 *   - scalar fields read/write in place;
 *   - array fields return a *copy* (typed array, or array of struct copies) — mutate the copy,
 *     then assign it back to write it;
 *   - `buffer` is the backing Uint8Array; `updateBuffer(buf)` swaps it.
 */
import LAYOUT from './generated/fw-layout.js';

export { LAYOUT };

const SIZES = { u8: 1, i8: 1, u16: 2, i16: 2, u32: 4, i32: 4, f32: 4 };
const ARRAY_TYPES = {
  u8: Uint8Array, i8: Int8Array, u16: Uint16Array, i16: Int16Array,
  u32: Uint32Array, i32: Int32Array, f32: Float32Array,
};

function view(buf) {
  return new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
}

function read(buf, type, offset) {
  const dv = view(buf);
  switch (type) {
    case 'u8': return dv.getUint8(offset);
    case 'i8': return dv.getInt8(offset);
    case 'u16': return dv.getUint16(offset, true);
    case 'i16': return dv.getInt16(offset, true);
    case 'u32': return dv.getUint32(offset, true);
    case 'i32': return dv.getInt32(offset, true);
    case 'f32': return dv.getFloat32(offset, true);
    default: throw new Error(`Unknown field type ${type}`);
  }
}

function write(buf, type, offset, value) {
  const dv = view(buf);
  const v = Number(value) || 0;
  switch (type) {
    case 'u8': return dv.setUint8(offset, v);
    case 'i8': return dv.setInt8(offset, v);
    case 'u16': return dv.setUint16(offset, v, true);
    case 'i16': return dv.setInt16(offset, v, true);
    case 'u32': return dv.setUint32(offset, v >>> 0, true);
    case 'i32': return dv.setInt32(offset, v, true);
    case 'f32': return dv.setFloat32(offset, v, true);
    default: throw new Error(`Unknown field type ${type}`);
  }
}

// Bitfields are read as an unsigned storage unit, masked, then shifted.
function unitType(type) {
  return type.startsWith('i') ? 'u' + type.slice(1) : type;
}

function readBits(buf, field) {
  const raw = read(buf, unitType(field.type), field.offset);
  const mask = field.bits.width >= 32 ? 0xffffffff : (1 << field.bits.width) - 1;
  return (raw >>> field.bits.shift) & mask;
}

function writeBits(buf, field, value) {
  const t = unitType(field.type);
  const mask = field.bits.width >= 32 ? 0xffffffff : (1 << field.bits.width) - 1;
  const raw = read(buf, t, field.offset);
  const cleared = raw & ~(mask << field.bits.shift);
  write(buf, t, field.offset, (cleared | ((Number(value) & mask) << field.bits.shift)) >>> 0);
}

const classCache = new Map();

/**
 * Get (or build) the accessor class for a struct in the firmware layout.
 * @param {string} structName e.g. 'analogConfig_s'
 */
export function structClass(structName) {
  if (classCache.has(structName)) return classCache.get(structName);
  const def = LAYOUT.structs[structName];
  if (!def) throw new Error(`Struct ${structName} is not in the firmware layout`);

  class Struct {
    /** @param {Uint8Array} [buffer] */
    constructor(buffer) {
      this.buffer = buffer || new Uint8Array(def.size);
    }
    static get structName() { return structName; }
    static get size() { return def.size; }
    static get fields() { return def.fields; }
    updateBuffer(buffer) { this.buffer = buffer; }
    /** Plain-object snapshot (handy for debugging, backups and the agent bridge). */
    toJSON() {
      const out = {};
      for (const f of def.fields) {
        if (f.name.startsWith('reserved')) continue;
        const v = this[f.name];
        if (Array.isArray(v)) out[f.name] = v.map((x) => (x && x.toJSON ? x.toJSON() : x));
        else if (ArrayBuffer.isView(v)) out[f.name] = Array.from(v);
        else out[f.name] = v && v.toJSON ? v.toJSON() : v;
      }
      return out;
    }
  }
  Object.defineProperty(Struct, 'name', { value: structName });

  for (const field of def.fields) {
    let get;
    let set;
    if (field.bits) {
      get = function () { return readBits(this.buffer, field); };
      set = function (v) { writeBits(this.buffer, field, v); };
    } else if (field.struct) {
      const Sub = structClass(field.struct);
      const subSize = LAYOUT.structs[field.struct].size;
      if (field.count == null) {
        get = function () {
          return new Sub(this.buffer.slice(field.offset, field.offset + subSize));
        };
        set = function (obj) { this.buffer.set(obj.buffer.subarray(0, subSize), field.offset); };
      } else {
        get = function () {
          const out = [];
          for (let i = 0; i < field.count; i++) {
            const o = field.offset + i * subSize;
            out.push(new Sub(this.buffer.slice(o, o + subSize)));
          }
          return out;
        };
        set = function (arr) {
          arr.forEach((obj, i) => {
            if (i < field.count) this.buffer.set(obj.buffer.subarray(0, subSize), field.offset + i * subSize);
          });
        };
      }
    } else if (field.count != null) {
      const size = SIZES[field.type];
      const Arr = ARRAY_TYPES[field.type];
      get = function () {
        const out = new Arr(field.count);
        for (let i = 0; i < field.count; i++) out[i] = read(this.buffer, field.type, field.offset + i * size);
        return out;
      };
      set = function (arr) {
        const n = Math.min(field.count, arr.length);
        for (let i = 0; i < n; i++) write(this.buffer, field.type, field.offset + i * size, arr[i]);
      };
    } else {
      get = function () { return read(this.buffer, field.type, field.offset); };
      set = function (v) { write(this.buffer, field.type, field.offset, v); };
    }
    Object.defineProperty(Struct.prototype, field.name, { get, set, enumerable: true });
  }

  classCache.set(structName, Struct);
  return Struct;
}

/** Create a struct instance, optionally over an existing buffer. */
export function createStruct(structName, buffer) {
  const C = structClass(structName);
  return new C(buffer);
}

/** Enum helpers: enumValues('core_reportformat_t') -> [{name, value, doc}] */
export function enumValues(enumName) {
  return LAYOUT.enums[enumName] || [];
}

/** Look up a numeric #define from the firmware headers. */
export function fwDefine(name, fallback = undefined) {
  return name in LAYOUT.defines ? LAYOUT.defines[name] : fallback;
}

// ---- Small text helpers for fixed-size char arrays ---------------------------------------

/** Decode a NUL-padded UTF-8 byte array. Returns '' for empty, and treats '~' as empty. */
export function decodeText(bytes) {
  const str = new TextDecoder().decode(bytes).replace(/\x00/g, '').trim();
  return str === '~' ? '' : str;
}

/** Encode text into a NUL-padded byte array of exactly `length` bytes. */
export function encodeText(text, length) {
  const out = new Uint8Array(length);
  out.set(new TextEncoder().encode(String(text)).slice(0, length));
  return out;
}
