/**
 * hoja-device.js — WebUSB protocol driver for HOJA-firmware controllers.
 *
 * This is a faithful port of hoja2's js/gamepad.js. The wire protocol is unchanged; what changed:
 *   - memory blocks come from the firmware layout (struct.js) instead of per-struct parser files;
 *   - it is an EventTarget (events listed below) instead of single-callback hooks;
 *   - request/response operations are serialized so two views can't clobber each other's reads;
 *   - the USB disconnect listener is registered once and only reacts to *our* device.
 *
 * Wire protocol summary (endpoint 2, interface 1, 64-byte reports; first byte = report id):
 *   0x01 READ_CONFIG_BLOCK   out: [1, block]                in: [1, block, chunkSize, idx|0xFF, data...]
 *   0x02 WRITE_CONFIG_BLOCK  out: [2, block, size, idx, data...] then [2, block, 0, 0xFF]
 *   0x03 READ_STATIC_BLOCK   out: [3, block]                in: same shape as 0x01
 *   0x04 CONFIG_COMMAND      out: [4, block, cmd]           in: [4, block, cmd, ok, data...]
 *   0x05 INPUT MODE/FOCUS    out: [5, 0, 254|255] (joystick|hover stream), [5, 1, inputCode]
 *   0xFE / 0xFF              in: live input reports (joystick / raw hover)
 *   0xFA                     in: analog (snapback) dump
 *   0xAF                     in/out: legacy firmware version probe
 *
 * Events (all CustomEvent; read `event.detail`):
 *   'connect'     { device: this }                 — blocks + statics loaded
 *   'disconnect'  {}
 *   'input'       DataView                          — live input report (0xFE/0xFF)
 *   'snapback'    DataView                          — analog dump (0xFA)
 *   'legacy'      { deviceId, url }                 — pre-HOJA2 firmware detected
 *   'bootloader'  {}                                — user picked a bare RP2040/RP2350 bootloader
 */
import { LAYOUT, createStruct } from './struct.js';
import { legacyFirmwareUrl } from './legacy.js';

/** USB filters offered in the browser's device picker. */
export const USB_FILTERS = [
  { vendorId: 0x057e, productId: 0x2009 }, // Switch Pro Controller mode
  { vendorId: 0x2e8a, productId: 0x10c6 }, // HOJA Gamepad (generic)
  { vendorId: 0x2e8a, productId: 0x10dd }, // GC Ultimate
  { vendorId: 0x2e8a, productId: 0x10df }, // ProGCC
  { vendorId: 0x2e8a, productId: 0x0003 }, // RP2040 bootloader
  { vendorId: 0x2e8a, productId: 0x000f }, // RP2350 bootloader
];

export function isPicoBootloader(device) {
  return device?.vendorId === 0x2e8a && (device?.productId === 0x0003 || device?.productId === 0x000f);
}

const EP = 2;
const ITF = 1;
const CHUNK_MAX = 32;

const REPORT = {
  READ_CONFIG: 1,
  WRITE_CONFIG: 2,
  READ_STATIC: 3,
  COMMAND: 4,
  INPUT_MODE: 5,
  SNAPBACK_DUMP: 250,
  INPUT_JOYSTICKS: 254,
  INPUT_RAW: 255,
  LEGACY_FW: 0xaf,
  LEGACY_FW_SET: 0x0f,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Poll `predicate` every 20ms until true or timeout (ms). Resolves true/false. */
async function waitFor(predicate, timeout) {
  const start = performance.now();
  while (!predicate()) {
    if (performance.now() - start >= timeout) return false;
    await sleep(20);
  }
  return true;
}

export class HojaDevice extends EventTarget {
  /** @type {USBDevice|null} */
  #usb = null;
  #connected = false;
  #queue = Promise.resolve();
  #usbListenerInstalled = false;

  // Pending read/command state, filled in by the report parser.
  #read = { kind: null, block: -1, done: false };
  #cmd = { block: -1, command: -1, done: false, ok: false, data: null };
  #legacy = { done: false, isLegacy: false };

  /** Config blocks keyed by name ('gamepad', 'analog', ...). Writable; push with sendBlock(). */
  config = {};
  /** Static (read-only) info blocks keyed by name ('device', 'battery', ...). */
  static = {};

  constructor() {
    super();
    this.#configTable = LAYOUT.blocks.config;
    this.#staticTable = LAYOUT.blocks.static;
    this.#resetMemory();
  }

  #configTable;
  #staticTable;

  #resetMemory() {
    for (const b of this.#configTable) this.config[b.key] = createStruct(b.struct);
    for (const b of this.#staticTable) this.static[b.key] = createStruct(b.struct);
  }

  get isConnected() { return this.#connected; }
  get usbDevice() { return this.#usb; }

  /** Block index for a config block name, e.g. blockIndex('analog') === 2. */
  blockIndex(key) {
    const b = this.#configTable.find((x) => x.key === key);
    if (!b) throw new Error(`Unknown config block "${key}"`);
    return b.index;
  }

  /** Command id from the firmware enums, e.g. commandId('analog', 'CALIBRATE_START'). */
  commandId(blockKey, name) {
    const id = LAYOUT.commands[blockKey]?.[name];
    if (id == null) throw new Error(`Unknown command ${blockKey}.${name}`);
    return id;
  }

  #emit(type, detail = {}) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  /** Run `fn` exclusively (one request/response exchange at a time). */
  #exclusive(fn) {
    const run = this.#queue.then(fn, fn);
    this.#queue = run.catch(() => {});
    return run;
  }

  // ---------------------------------------------------------------------------------------
  // Connection
  // ---------------------------------------------------------------------------------------

  /**
   * Show the browser device picker and connect. Resolves:
   *   true            connected (or legacy device detected — see 'legacy' event)
   *   'bootloader'    user chose a bare bootloader ('bootloader' event fired)
   *   false           canceled / failed
   */
  async connect() {
    if (!navigator.usb) throw new Error('WebUSB is not available in this browser.');
    let usb;
    try {
      usb = await navigator.usb.requestDevice({ filters: USB_FILTERS });
    } catch (err) {
      if (err?.name === 'NotFoundError') return false; // user canceled
      throw err;
    }
    return this.open(usb);
  }

  /** Open an already-authorized USBDevice (e.g. from navigator.usb.getDevices()). */
  async open(usb) {
    if (isPicoBootloader(usb)) {
      this.#emit('bootloader', { usb });
      return 'bootloader';
    }

    try {
      await usb.open();
      await usb.selectConfiguration(1);
      await usb.claimInterface(ITF);
    } catch (err) {
      console.error('[device] open failed', err);
      try { await usb.close(); } catch { /* ignore */ }
      throw err;
    }

    this.#usb = usb;
    this.#connected = true;
    this.#resetMemory();
    this.#installDisconnectListener();
    this.#pollLoop();

    if (await this.#probeLegacy()) return true; // 'legacy' event already emitted

    await this.readAllConfig();
    await this.readAllStatic();
    this.#emit('connect', { device: this });
    return true;
  }

  async disconnect() {
    if (!this.#usb) return true;
    const usb = this.#usb;
    this.#connected = false;
    this.#usb = null;
    try { await usb.close(); } catch (err) { console.warn('[device] close failed', err); }
    this.#emit('disconnect');
    return true;
  }

  #installDisconnectListener() {
    if (this.#usbListenerInstalled) return;
    this.#usbListenerInstalled = true;
    navigator.usb.addEventListener('disconnect', (event) => {
      if (event.device !== this.#usb) return;
      this.#connected = false;
      this.#usb = null;
      this.#emit('disconnect');
    });
  }

  // ---------------------------------------------------------------------------------------
  // Raw transport
  // ---------------------------------------------------------------------------------------

  async #out(bytes) {
    if (!this.#connected || !this.#usb) throw new Error('Device not connected');
    return this.#usb.transferOut(EP, bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
  }

  /** Send a report: [reportId, ...data]. */
  async sendReport(reportId, data = []) {
    return this.#out(new Uint8Array([reportId, ...data]));
  }

  async #pollLoop() {
    while (this.#connected && this.#usb) {
      try {
        const result = await this.#usb.transferIn(EP, 64);
        if (result.data) this.#parse(result.data);
      } catch (err) {
        if (this.#connected) console.warn('[device] poll stopped', err?.message || err);
        return;
      }
    }
  }

  #parse(view) {
    try {
      switch (view.getUint8(0)) {
        case REPORT.READ_CONFIG: return this.#onChunk(view, 'config');
        case REPORT.READ_STATIC: return this.#onChunk(view, 'static');
        case REPORT.WRITE_CONFIG: return; // write acks are not awaited (matches hoja2)
        case REPORT.COMMAND: return this.#onCommand(view);
        case REPORT.INPUT_JOYSTICKS:
        case REPORT.INPUT_RAW: return this.#emit('input', view);
        case REPORT.SNAPBACK_DUMP: return this.#emit('snapback', view);
        case REPORT.LEGACY_FW: return this.#onLegacy(view);
        default: return;
      }
    } catch (err) {
      console.warn('[device] bad report', err);
    }
  }

  #onChunk(view, kind) {
    const blockIdx = view.getUint8(1);
    const size = view.getUint8(2);
    const idx = view.getUint8(3);
    const table = kind === 'config' ? this.#configTable : this.#staticTable;
    const entry = table.find((b) => b.index === blockIdx);
    if (!entry) return;
    const target = (kind === 'config' ? this.config : this.static)[entry.key];

    if (size > 0) {
      const chunk = new Uint8Array(view.buffer, view.byteOffset + 4, size);
      const at = idx * CHUNK_MAX;
      // Newer firmware may send a larger block than this app knows about: grow, don't throw.
      if (at + size > target.buffer.length) {
        const grown = new Uint8Array(at + size);
        grown.set(target.buffer);
        target.updateBuffer(grown);
      }
      target.buffer.set(chunk, at);
    }
    if (idx === 0xff && this.#read.kind === kind && this.#read.block === blockIdx) {
      this.#read.done = true;
    }
  }

  #onCommand(view) {
    if (view.byteLength < 4) return;
    const block = view.getUint8(1);
    const command = view.getUint8(2);
    if (block !== this.#cmd.block || command !== this.#cmd.command) return;
    this.#cmd.ok = !!view.getUint8(3);
    this.#cmd.data = view.byteLength > 4 ? new Uint8Array(view.buffer.slice(view.byteOffset + 4, view.byteOffset + view.byteLength)) : null;
    this.#cmd.done = true;
  }

  #onLegacy(view) {
    const deviceId = (view.getUint8(3) << 8) | view.getUint8(4);
    this.#legacy.done = true;
    this.#legacy.isLegacy = true;
    this.#emit('legacy', { deviceId, url: legacyFirmwareUrl(deviceId) });
  }

  async #probeLegacy() {
    this.#legacy = { done: false, isLegacy: false };
    await this.#out([REPORT.LEGACY_FW]);
    await waitFor(() => this.#legacy.done, 150);
    return this.#legacy.isLegacy;
  }

  // ---------------------------------------------------------------------------------------
  // Memory blocks
  // ---------------------------------------------------------------------------------------

  async #readBlock(kind, index, timeout = 5000) {
    this.#read = { kind, block: index, done: false };
    await this.#out([kind === 'config' ? REPORT.READ_CONFIG : REPORT.READ_STATIC, index]);
    if (!(await waitFor(() => this.#read.done, timeout))) {
      throw new Error(`Timed out reading ${kind} block ${index}`);
    }
  }

  /** Re-read one config block from the device. Accepts a name ('analog') or index. */
  requestBlock(block) {
    const index = typeof block === 'string' ? this.blockIndex(block) : block;
    return this.#exclusive(() => this.#readBlock('config', index));
  }

  requestStatic(index) {
    return this.#exclusive(() => this.#readBlock('static', index));
  }

  readAllConfig() {
    return this.#exclusive(async () => {
      for (const b of this.#configTable) await this.#readBlock('config', b.index);
    });
  }

  readAllStatic() {
    return this.#exclusive(async () => {
      for (const b of this.#staticTable) await this.#readBlock('static', b.index);
    });
  }

  /**
   * Push a config block to the device's RAM (takes effect live; persists only after save()).
   * Accepts a name ('haptic') or index.
   */
  sendBlock(block) {
    const index = typeof block === 'string' ? this.blockIndex(block) : block;
    const entry = this.#configTable.find((b) => b.index === index);
    return this.#exclusive(async () => {
      const buf = this.config[entry.key].buffer;
      for (let idx = 0, pos = 0; pos < buf.length; idx++, pos += CHUNK_MAX) {
        const chunk = buf.subarray(pos, Math.min(pos + CHUNK_MAX, buf.length));
        const out = new Uint8Array(4 + chunk.length);
        out.set([REPORT.WRITE_CONFIG, index, chunk.length, idx]);
        out.set(chunk, 4);
        await this.#out(out);
      }
      await this.#out([REPORT.WRITE_CONFIG, index, 0, 0xff]);
    });
  }

  /**
   * Send a config command and wait for its confirmation.
   * @param {string|number} block block name or index
   * @param {string|number} command command name from the firmware enum (e.g. 'SAVE_ALL') or id
   * @returns {Promise<{status: boolean, data: Uint8Array|null}>}
   */
  sendConfigCommand(block, command, timeout = 5000) {
    const blockKey = typeof block === 'string' ? block : this.#configTable.find((b) => b.index === block)?.key;
    const index = typeof block === 'string' ? this.blockIndex(block) : block;
    const cmd = typeof command === 'string' ? this.commandId(blockKey, command) : command;
    return this.#exclusive(async () => {
      this.#cmd = { block: index, command: cmd, done: false, ok: false, data: null };
      await this.#out([REPORT.COMMAND, index, cmd]);
      const done = await waitFor(() => this.#cmd.done, timeout ?? 5000);
      return done ? { status: this.#cmd.ok, data: this.#cmd.data } : { status: false, data: null };
    });
  }

  /** Commit all config blocks to flash. */
  async save() {
    const { status } = await this.sendConfigCommand('gamepad', 'SAVE_ALL');
    return status;
  }

  /** Reboot into the RP2040/RP2350 bootloader. Does not wait for an ACK (the device drops off USB). */
  async rebootToBootloader() {
    await this.#out([REPORT.COMMAND, this.blockIndex('gamepad'), this.commandId('gamepad', 'RESET_TO_BOOTLOADER')]);
    return true;
  }

  /** Legacy firmware: request bootloader (fire-and-forget). */
  async rebootToBootloaderLegacy() {
    try { await this.#out([REPORT.LEGACY_FW_SET]); } catch { /* device drops off */ }
  }

  /** Choose which live input stream the device sends: joysticks (0xFE) or raw hover (0xFF). */
  setInputMode(joysticks = false) {
    return this.sendReport(REPORT.INPUT_MODE, [0x00, joysticks ? 254 : 255]);
  }

  /** Highlight/focus an input on the device (used during remapping). */
  setFocusedInput(inputCode) {
    return this.sendReport(REPORT.INPUT_MODE, [0x01, inputCode & 0xff]);
  }
}

/** The app uses a single device instance. */
export const device = new HojaDevice();
