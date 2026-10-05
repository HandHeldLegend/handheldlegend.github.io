/**
 * input.js — The Arena only ever reads the HOJA controller that is connected to the app.
 *
 * Source selection (re-evaluated every animation frame):
 *   1. Gamepad API pad matched to the connected controller. The WebUSB device's vendor/product IDs
 *      (device.usbDevice.vendorId / productId) are compared with each Gamepad.id. Chromium ids look like
 *      "Name (STANDARD GAMEPAD Vendor: 2e8a Product: 10c6)" or "Name (Vendor: 057e Product: 2009)",
 *      Firefox ids like "2e8a-10c6-Name". Every other pad is ignored. If several pads match (two identical
 *      controllers), the one that most recently produced input wins.
 *      Optional: "12-bit sticks over USB" swaps in the HOJA joystick stream for stick values only.
 *   2. Fallback when no matching pad is visible (the browser hides the HID interface until a button is
 *      pressed, or the demo controller has no USB device): the HOJA WebUSB input stream.
 *        raw stream (setInputMode(false))       every button + analog triggers + sticks at 7 bits per
 *                                               direction (from the LX_RIGHT/LX_LEFT… mapper inputs)
 *        joystick stream (setInputMode(true))   full 12-bit sticks, but no buttons
 *      Play always uses the raw stream (it needs buttons); the Input lab can switch to the joystick
 *      stream to inspect stick resolution.
 *
 * The keyboard never drives the character; it only offers P (pause), "." (frame advance) and R (reset).
 *
 * Snapshot shape (sticks on a unit scale, +x right, +y UP):
 *   { lx, ly, cx, cy, l, r, btn: {attack, special, jump, z, shield, start, select, step},
 *     edges: {start, select, step}, source: 'gamepad' | 'usb' | 'none' }
 */
import { KEYS, HOJA_FULL_SCALE, TRIGGER } from './constants.js';
import { store } from './store.js';
import { onInputReport } from '../../device/reports.js';
import { enumValues, decodeText } from '../../device/struct.js';
import { t, N_ } from '../../i18n/index.js';
import { meleeStick, meleeTrigger } from './melee.js';

/** Mapper input codes by short name, e.g. CODE.SOUTH, CODE.LX_RIGHT (firmware enum, never hard-coded). */
export const CODE = {};
for (const e of enumValues('mapper_input_code_t')) if (e.value >= 0) CODE[e.name.replace(/^INPUT_CODE_/, '')] = e.value;
export const CODE_NAMES = Object.fromEntries(Object.entries(CODE).map(([k, v]) => [v, k]));

/** Bindable actions (digital buttons and analog triggers). Labels/hints are translated where rendered (t(a.label)). */
export const ACTIONS = [
  { id: 'attack', label: N_('Attack'), kind: 'button' },
  { id: 'special', label: N_('Special'), kind: 'button' },
  { id: 'jump', label: N_('Jump'), kind: 'button' },
  { id: 'z', label: N_('Z (grab · L-cancel)'), kind: 'button' },
  { id: 'l', label: N_('Left trigger (analog shield)'), kind: 'analog' },
  { id: 'r', label: N_('Right trigger (analog shield)'), kind: 'analog' },
  { id: 'shield', label: N_('Digital shield'), kind: 'button' },
  { id: 'start', label: N_('Pause'), kind: 'button' },
  { id: 'select', label: N_('Reset / restart'), kind: 'button' },
  { id: 'step', label: N_('Frame advance (paused)'), kind: 'button' },
];
export const STICK_AXES = [
  { id: 'lx', label: N_('Main stick X'), hint: N_('Push the main stick RIGHT') },
  { id: 'ly', label: N_('Main stick Y'), hint: N_('Push the main stick UP') },
  { id: 'cx', label: N_('C-stick X'), hint: N_('Push the C-stick RIGHT') },
  { id: 'cy', label: N_('C-stick Y'), hint: N_('Push the C-stick UP') },
];

/** Names of the W3C "standard" gamepad buttons, for labels. */
const STANDARD_NAMES = [N_('South'), N_('East'), N_('West'), N_('North'), N_('Left bumper'), N_('Right bumper'), N_('Left trigger'), N_('Right trigger'),
  N_('Back / Select'), 'Start', N_('Left stick press'), N_('Right stick press'), N_('D-pad up'), N_('D-pad down'), N_('D-pad left'), N_('D-pad right'), 'Home'];

/**
 * Default bindings.
 *   Gamepad API: a source is {t:'b', i} (button i), {t:'a', i, s:±1} (half of axis i) or
 *   {t:'a', i, full:true} (an axis resting at −1). Sticks are {i: axisIndex, inv} (inv makes right/up +).
 *   USB raw stream: a source is {t:'c', i: mapperInputCode, an?: true} (an = use the 7-bit analog value).
 * Layout: the button printed A attacks, B specials, X/Y jump; Z on the right bumper, analog triggers
 * shield, left bumper = digital shield, Start pause, Select reset, D-pad right = frame advance.
 * Bindings are stored per Gamepad.id (which includes vendor/product, so Switch and Steam layouts are
 * kept apart) and under 'usb' for the stream.
 *
 * Face buttons go by the label printed on the controller, not by position. HOJA builds differ: a
 * ProGCC has A on the right (EAST) and B at the bottom (SOUTH), a GC Ultimate / Phob has A at the
 * bottom (SOUTH) and B on the left (WEST) — the build's own labels come from the static input info.
 * How they reach the Gamepad API (firmware cores + the browser's positional "standard" layout):
 *   Switch mode  the firmware maps the printed A/B/X/Y to Switch A/B/X/Y and the browser lays the Switch
 *                Pro pad out by position: index 0 = B, 1 = A, 2 = Y, 3 = X.
 *   Steam mode   SInput is positional (the firmware maps physical SOUTH/EAST/WEST/NORTH straight through,
 *                in that HID button order): index 0..3 = the build's SOUTH, EAST, WEST, NORTH inputs.
 *   XInput       Xbox layout: index 0 = A, 1 = B, 2 = X, 3 = Y.
 * @param {'usb'|'gamepad'} kind
 * @param {{mode?: 'switch'|'steam'|'xinput', labels?: Record<string, number>}} ctx  labels: printed
 *        name → mapper input code (from the build's static info)
 */
export function defaultBindings(kind, ctx = {}) {
  const labels = ctx.labels || {};
  if (kind === 'usb') {
    const c = (name, an) => ({ t: 'c', i: CODE[name], ...(an ? { an: true } : {}) });
    const face = (label, fallback) => ({ t: 'c', i: labels[label] ?? CODE[fallback] });
    return {
      attack: [face('A', 'SOUTH')], special: [face('B', 'EAST')], jump: [face('X', 'WEST'), face('Y', 'NORTH')], z: [c('RB')],
      l: [c('LT_ANALOG', true), c('LT')], r: [c('RT_ANALOG', true), c('RT')], shield: [c('LB')],
      start: [c('START')], select: [c('SELECT')], step: [c('RIGHT')],
    };
  }
  return {
    lx: { i: 0, inv: false }, ly: { i: 1, inv: true }, cx: { i: 2, inv: false }, cy: { i: 3, inv: true },
    attack: [{ t: 'b', i: faceIndex('A', ctx.mode, labels) ?? 0 }], special: [{ t: 'b', i: faceIndex('B', ctx.mode, labels) ?? 1 }],
    jump: [{ t: 'b', i: faceIndex('X', ctx.mode, labels) ?? 2 }, { t: 'b', i: faceIndex('Y', ctx.mode, labels) ?? 3 }],
    z: [{ t: 'b', i: 5 }], l: [{ t: 'b', i: 6 }], r: [{ t: 'b', i: 7 }], shield: [{ t: 'b', i: 4 }],
    start: [{ t: 'b', i: 9 }], select: [{ t: 'b', i: 8 }], step: [{ t: 'b', i: 15 }],
  };
}

/** Output mode of a matched pad from its Gamepad.id vendor: 'switch' | 'xinput' | 'steam'. */
export function padMode(id = '') {
  const vid = parseVidPid(id)?.vid;
  return vid === 0x057e ? 'switch' : vid === 0x045e ? 'xinput' : 'steam';
}

/** Gamepad API button index of the face button printed `label` (A/B/X/Y), or null if unknown. */
export function faceIndex(label, mode, labels = {}) {
  if (mode === 'switch') return { A: 1, B: 0, X: 3, Y: 2 }[label] ?? null;
  if (mode === 'xinput') return { A: 0, B: 1, X: 2, Y: 3 }[label] ?? null;
  const code = labels[label];
  const pos = code == null ? -1 : [CODE.SOUTH, CODE.EAST, CODE.WEST, CODE.NORTH].indexOf(code);
  return pos >= 0 ? pos : null;
}

/**
 * Readable name of a binding source.
 * @param {object} names  {codes: {mapperCode: printedName}, buttons: {gamepadIndex: printedName}}
 */
export function sourceLabel(src, mapping, names = {}) {
  if (!src) return t('Unbound');
  if (src.t === 'c') {
    const n = names.codes?.[src.i] || prettyCode(src.i);
    return src.an ? t('{input} (analog)', { input: n }) : n;
  }
  if (src.t === 'b') {
    const printed = names.buttons?.[src.i];
    if (printed) return t('{name} (button {i})', { name: printed, i: src.i });
    return mapping === 'standard' && STANDARD_NAMES[src.i]
      ? t('{name} (button {i})', { name: t(STANDARD_NAMES[src.i]), i: src.i }) : t('Button {i}', { i: src.i });
  }
  if (src.full) return t('Axis {i} (full range)', { i: src.i });
  return t('Axis {i} {sign}', { i: src.i, sign: src.s > 0 ? '+' : '−' });
}

export function prettyCode(code) {
  const n = CODE_NAMES[code] || `#${code}`;
  return n.replace(/_ANALOG$/, '').replace(/_/g, ' ').toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase())
    .replace(/^(Lb|Rb|Lt|Rt|Ls|Rs|Lp1|Rp1|Lp2|Rp2|Tp1|Tp2|Lx|Ly|Rx|Ry)\b/, (m) => m.toUpperCase());
}

/** Action states from one HOJA USB raw report through the 'usb' bindings ({attack…step, l, r, trig}). */
export function usbButtons(inputs, map) {
  const val = (src) => (src?.t === 'c' ? (src.an ? (inputs[src.i]?.value ?? 0) / 127 : (inputs[src.i]?.pressed ? 1 : 0)) : 0);
  const any = (list) => Math.max(0, ...[].concat(list || []).map(val));
  const out = { l: any(map.l), r: any(map.r) };
  for (const k of BTN_KEYS) out[k] = any(map[k]) >= 0.5;
  out.trig = out.shield || Math.max(meleeTrigger(out.l).value, meleeTrigger(out.r).value) >= TRIGGER.SHIELD_MIN;
  return out;
}

/** {vid, pid} from a Gamepad.id in Chromium or Firefox format, or null. */
export function parseVidPid(id = '') {
  let m = /Vendor:\s*([0-9a-f]{1,4})\s*Product:\s*([0-9a-f]{1,4})/i.exec(id);
  if (!m) m = /^([0-9a-f]{1,4})-([0-9a-f]{1,4})-/i.exec(id);
  return m ? { vid: parseInt(m[1], 16), pid: parseInt(m[2], 16) } : null;
}

/** A readable name from a Gamepad.id. */
export function padName(id = '') {
  const ff = /^[0-9a-f]{1,4}-[0-9a-f]{1,4}-(.*)$/i.exec(id);
  return (ff ? ff[1] : id.replace(/\s*\([^)]*\)\s*/g, ' ')).trim() || t('Controller');
}

const hex4 = (n) => n.toString(16).padStart(4, '0');
const isEditable = (el) => el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
const META_KEYS = { start: KEYS.start, select: KEYS.select, step: KEYS.step };
const ALL_META = new Set(Object.values(META_KEYS).flat());

/** Game buttons whose press edges are latched between simulation frames ('trig' = any shield press). */
/** Bump when default bindings change meaning (stored bindings are then reset once). */
export const BINDINGS_VERSION = 2;

export const LATCH_KEYS = ['attack', 'special', 'jump', 'z', 'shield', 'trig'];
const META = ['start', 'select', 'step'];
const BTN_KEYS = ['attack', 'special', 'jump', 'z', 'shield', ...META];

/**
 * Press latch. Input is sampled far more often than the 60 Hz simulation reads it (every Gamepad API
 * poll, i.e. every display frame, and every HOJA USB report). A press that starts and ends between two
 * simulation frames used to vanish — the sim only saw the latest sample. The latch counts every press
 * edge in every sample until the next simulation frame takes them, so no press is lost at any display
 * or report rate.
 */
export class PressLatch {
  constructor(keys = LATCH_KEYS) { this.keys = keys; this.prev = {}; this.presses = {}; this.flash = {}; this.count = 0; }
  /** Feed one sample ({key: bool}). */
  sample(btn) {
    for (const k of this.keys) {
      const on = !!btn[k];
      if (on && !this.prev[k]) this.add(k);
      this.prev[k] = on;
    }
  }
  /** Record a press that happened (also used for taps recovered from the USB stream). */
  add(k) { this.presses[k] = (this.presses[k] || 0) + 1; this.flash[k] = true; this.count++; }
  /** Presses since the last take(), or null. */
  take() {
    if (!this.count) return null;
    const p = this.presses; this.presses = {}; this.count = 0;
    return p;
  }
  /** Keys pressed since the last takeFlash() (for the input display lights). */
  takeFlash() { const f = this.flash; this.flash = {}; return f; }
  clear() { this.presses = {}; this.count = 0; }
}

export function median(arr) {
  if (!arr.length) return NaN;
  const s = [...arr].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export class InputManager extends EventTarget {
  /** @param {{device: any, session: any}} o */
  constructor({ device, session }) {
    super();
    this.device = device;
    this.session = session;
    this.keys = new Set();
    this.tapped = new Set();
    this.captureKeys = false;
    this.matched = [];            // [{index, id, mapping}] Gamepad API pads that match the device
    this.activeIndex = null;
    this.lastActive = new Map();  // pad index → performance.now() of its last input
    this.prevPad = new Map();     // pad index → {buttons[], axes[]} from the previous poll
    this.otherPads = 0;           // pads that were ignored (not our controller)
    this.capturing = null;
    this.prevMeta = { start: false, select: false, step: false };
    this.lastInputAt = 0;
    this.source = 'none';
    this.hiResSticks = !!store.get('hiResSticks'); // gamepad source: use 12-bit USB sticks
    this.labSticksOnly = false;   // set by the Input lab: USB source uses the joystick stream
    this.usb = { kind: null, raw: null, rawT: 0, sticks: null, sticksT: 0, intervals: [], lastT: 0, stop: null, everSticks: false };
    this.raw = { kind: 'none' };
    this.latch = new PressLatch();          // game buttons, taken once per simulation frame
    this.metaLatch = new PressLatch(META);  // pause / reset / step from the USB stream, taken per poll
    this.lastPollAt = 0;
    this.missedTaps = 0;                    // Gamepad API source: taps seen over USB that fell between polls
    this.recoveredTaps = 0;                 // … of which were handed to the game
    this.usbDown = new Map();               // mapper code → time it went down (Gamepad API source)
    this.#readLabels();
    // Bindings saved before face buttons went by their printed labels (≤ v1) may hold A/B swapped:
    // reset them once; view.js tells the user.
    this.bindingsReset = false;
    if (store.get('bindingsVersion') !== BINDINGS_VERSION) {
      this.bindingsReset = Object.keys(store.get('bindings') || {}).length > 0;
      if (this.bindingsReset) store.set('bindings', {});
      store.set('bindingsVersion', BINDINGS_VERSION);
    }
    this.state = this.#emptyState();
    this.#sig = '';
    this.#switching = false;

    // Keyboard: pause / frame advance / reset only — it never moves the character.
    this.onKeyDown = (e) => {
      if (isEditable(e.target) || e.ctrlKey || e.metaKey || e.altKey || !ALL_META.has(e.code)) return;
      if (this.captureKeys && e.code === 'Period') e.preventDefault();
      this.keys.add(e.code);
      this.tapped.add(e.code);
    };
    this.onKeyUp = (e) => { this.keys.delete(e.code); };
    this.onBlur = () => { this.keys.clear(); this.tapped.clear(); };
    this.onPadChange = () => this.#refresh(true);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('gamepadconnected', this.onPadChange);
    window.addEventListener('gamepaddisconnected', this.onPadChange);

    // Listen to the HOJA input stream for the whole session (cheap; used for the fallback and 12-bit sticks).
    this.usb.stop = onInputReport(device, (r) => this.#onReport(r));
  }

  #sig;
  #switching;

  /** The build's printed input names (static info): this.codeNames {code: name}, this.labels {A: code…}. */
  #readLabels() {
    this.codeNames = {};
    this.labels = {};
    const infos = this.session?.static?.input?.input_info;
    if (!infos) return;
    for (let code = 0; code < infos.length; code++) {
      let name = '';
      try { name = decodeText(infos[code]?.input_name ?? new Uint8Array()).trim(); } catch { /* ignore */ }
      if (!name) continue;
      this.codeNames[code] = name;
      const key = name.toUpperCase();
      if (['A', 'B', 'X', 'Y'].includes(key) && this.labels[key] == null) this.labels[key] = code;
    }
  }

  /** Printed name of a mapper input (falls back to the firmware's code name). */
  codeName(code) { return this.codeNames[code] || prettyCode(code); }

  /** {gamepadIndex: printed face label} for a pad, so mapping rows can say "A (button 1)". */
  faceNames(gp) {
    if (!gp) return {};
    const mode = padMode(gp.id);
    const out = {};
    for (const l of ['A', 'B', 'X', 'Y']) { const i = faceIndex(l, mode, this.labels); if (i != null) out[i] = l; }
    return out;
  }

  /** Names for sourceLabel(). */
  sourceNames(gp) { return { codes: this.codeNames, buttons: this.faceNames(gp) }; }

  #emptyState() {
    return {
      lx: 0, ly: 0, cx: 0, cy: 0, l: 0, r: 0,
      btn: { attack: false, special: false, jump: false, z: false, shield: false, start: false, select: false, step: false },
      edges: { start: false, select: false, step: false },
      flash: {},
      raw: { lx: 0, ly: 0, cx: 0, cy: 0, l: 0, r: 0 },
      melee: { main: meleeStick(0, 0), c: meleeStick(0, 0), l: meleeTrigger(0), r: meleeTrigger(0) },
      source: 'none',
    };
  }

  async destroy() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('gamepadconnected', this.onPadChange);
    window.removeEventListener('gamepaddisconnected', this.onPadChange);
    this.capturing = null;
    this.usb.stop?.();
    // Leave the controller on the default (raw/hover) stream other pages expect.
    if (this.usb.everSticks && this.session.connected) { try { await this.device.setInputMode(false); } catch { /* gone */ } }
  }

  // ---- Which controller? ----------------------------------------------------------------------

  /** {vid, pid} of the WebUSB-connected controller, or null (e.g. the demo controller). */
  deviceIds() {
    const u = this.device.usbDevice;
    return u && u.vendorId != null ? { vid: u.vendorId, pid: u.productId } : null;
  }

  deviceName() { return this.session.info?.name || t('your controller'); }

  #allPads() {
    try { return [...(navigator.getGamepads?.() || [])].filter((g) => g && g.connected !== false); } catch { return []; }
  }

  /** Gamepad API pads that belong to the connected controller. */
  #matchedPads() {
    const all = this.#allPads();
    const ids = this.deviceIds();
    const mine = ids ? all.filter((g) => { const p = parseVidPid(g.id); return p && p.vid === ids.vid && p.pid === ids.pid; }) : [];
    this.otherPads = all.length - mine.length;
    return mine;
  }

  #refresh(force) {
    const pads = this.#matchedPads();
    const sig = `${pads.map((g) => `${g.index}:${g.id}`).join('|')}#${this.otherPads}`;
    if (force || sig !== this.#sig) {
      this.#sig = sig;
      this.matched = pads.map((g) => ({ index: g.index, id: g.id, mapping: g.mapping }));
      if (!pads.some((g) => g.index === this.activeIndex)) this.activeIndex = null;
      this.dispatchEvent(new Event('change'));
    }
    return pads;
  }

  /** Track activity per matched pad; the most recently active one drives input. */
  #choose(pads, now) {
    for (const g of pads) {
      const prev = this.prevPad.get(g.index);
      const buttons = g.buttons.map((b) => b.value || (b.pressed ? 1 : 0));
      const axes = [...g.axes];
      if (prev && (buttons.some((v, i) => v >= 0.5 && (prev.buttons[i] ?? 0) < 0.5) || axes.some((v, i) => Math.abs(v - (prev.axes[i] ?? 0)) > 0.25))) {
        this.lastActive.set(g.index, now);
      }
      this.prevPad.set(g.index, { buttons, axes });
    }
    let best = null;
    for (const g of pads) if (!best || (this.lastActive.get(g.index) || 0) > (this.lastActive.get(best.index) || 0)) best = g;
    const idx = best ? best.index : null;
    if (idx !== this.activeIndex) { this.activeIndex = idx; this.dispatchEvent(new Event('change')); }
    return best;
  }

  /** The matched Gamepad object currently driving input (or null). */
  activePad() {
    return this.#allPads().find((g) => g.index === this.activeIndex) || null;
  }

  setHiResSticks(on) {
    this.hiResSticks = !!on;
    store.set('hiResSticks', this.hiResSticks);
    this.dispatchEvent(new Event('change'));
  }

  setLabSticksOnly(on) {
    this.labSticksOnly = !!on;
    this.dispatchEvent(new Event('change'));
  }

  // ---- HOJA USB stream ------------------------------------------------------------------------

  #onReport(r) {
    const t = performance.now();
    if (this.usb.lastT) {
      this.usb.intervals.push(t - this.usb.lastT);
      if (this.usb.intervals.length > 120) this.usb.intervals.shift();
    }
    this.usb.lastT = t;
    if (r.kind === 'raw') {
      this.usb.raw = r.inputs; this.usb.rawT = t;
      if (this.source === 'gamepad') this.#watchUsbTaps(r.inputs, t);
      else {
        // The USB stream drives the buttons: latch every report, not just the one a frame happens to see.
        const btn = usbButtons(r.inputs, this.bindingsFor('usb'));
        this.latch.sample(btn);
        this.metaLatch.sample(btn);
      }
    } else { this.usb.sticks = r.sticks.deadzone; this.usb.sticksT = t; }
  }

  /**
   * Gamepad API source: the browser only shows the pad's state at each poll, so a press that starts
   * and ends between two polls is invisible to it. The USB stream (when running) still sees it: count
   * those taps, and hand them to the game when the pad uses its default bindings (so the USB stream's
   * default mapping means the same buttons).
   */
  #watchUsbTaps(inputs, t) {
    for (let i = 0; i < inputs.length; i++) {
      const on = !!inputs[i]?.pressed;
      const down = this.usbDown.get(i);
      if (on && down == null) this.usbDown.set(i, t);
      else if (!on && down != null) {
        this.usbDown.delete(i);
        if (down > this.lastPollAt) this.#missedTap(i);
      }
    }
  }

  #missedTap(code) {
    this.missedTaps++;
    const gp = this.activePad();
    if (!gp || (store.get('bindings') || {})[gp.id]) return; // custom gamepad bindings: can't map safely
    const usbMap = defaultBindings('usb', { labels: this.labels });
    for (const [action, list] of Object.entries(usbMap)) {
      if (![].concat(list || []).some((s) => s?.t === 'c' && s.i === code && !s.an)) continue;
      this.recoveredTaps++;
      if (META.includes(action)) this.metaLatch.add(action);
      else { this.latch.add(action); if (action === 'shield' || action === 'l' || action === 'r') this.latch.add('trig'); }
    }
  }

  /** Press edges (per game button) since the last simulation frame, or null. Call once per sim frame. */
  takePresses() { return this.latch.take(); }
  /** Drop pending presses (e.g. presses made while paused, when resuming). */
  clearPresses() { this.latch.clear(); }

  /** Which stream the controller should send right now: 'raw' | 'sticks'. */
  #wantedStream(pad) {
    if (pad) return this.hiResSticks ? 'sticks' : 'raw';
    return this.labSticksOnly ? 'sticks' : 'raw';
  }

  #syncStream(pad) {
    const want = this.#wantedStream(pad);
    if (want === this.usb.kind || this.#switching || !this.session.connected) return;
    this.#switching = true;
    if (want === 'sticks') this.usb.everSticks = true;
    Promise.resolve(this.device.setInputMode(want === 'sticks'))
      .then(() => { this.usb.kind = want; this.dispatchEvent(new Event('change')); })
      .catch(() => { this.usb.kind = want; }) // don't retry every frame
      .finally(() => { this.#switching = false; });
  }

  /** Average USB report rate (Hz), or 0. */
  usbRate() {
    if (performance.now() - this.usb.lastT > 500) return 0;
    const m = median(this.usb.intervals);
    return Number.isFinite(m) && m > 0 ? 1000 / m : 0;
  }

  // ---- Bindings -------------------------------------------------------------------------------

  /** Binding key for the current source: the Gamepad.id, or 'usb'. */
  bindingKey() {
    const gp = this.activePad();
    return gp ? gp.id : 'usb';
  }

  bindingsFor(key) {
    const all = store.get('bindings') || {};
    const defaults = key === 'usb' ? defaultBindings('usb', { labels: this.labels })
      : defaultBindings('gamepad', { mode: padMode(key), labels: this.labels });
    return { ...defaults, ...(all[key] || {}) };
  }

  setBinding(key, action, value) {
    const all = { ...(store.get('bindings') || {}) };
    all[key] = { ...(all[key] || {}), [action]: value };
    store.set('bindings', all);
  }

  resetBindings(key) {
    const all = { ...(store.get('bindings') || {}) };
    delete all[key];
    store.set('bindings', all);
  }

  /** Wait for the next button/axis/trigger on the current source. kind: 'button' | 'analog' | 'axis'. */
  capture(kind, cb) {
    const gp = this.activePad();
    this.capturing = {
      kind, cb,
      base: gp ? [...gp.axes] : [],
      prevButtons: gp ? gp.buttons.map((b) => b.value || (b.pressed ? 1 : 0)) : [],
      prevCodes: (this.usb.raw || []).map((x) => x.value),
    };
    return () => { this.capturing = null; };
  }

  #checkCapture(gp) {
    const c = this.capturing;
    if (!c) return;
    const done = (src) => { this.capturing = null; c.cb(src); };
    if (!gp) {
      // USB raw stream: first mapper input that rises past half.
      const now = this.usb.raw;
      if (!now || c.kind === 'axis') return;
      for (let i = 0; i < now.length; i++) {
        if (now[i].value >= 64 && (c.prevCodes[i] ?? 0) < 32) {
          const analog = c.kind === 'analog' && /_ANALOG$/.test(CODE_NAMES[i] || '');
          return done({ t: 'c', i, ...(analog ? { an: true } : {}) });
        }
      }
      c.prevCodes = now.map((x) => x.value);
      return;
    }
    const buttons = gp.buttons.map((b) => b.value || (b.pressed ? 1 : 0));
    if (c.kind === 'axis') {
      for (let i = 0; i < gp.axes.length; i++) {
        const a = gp.axes[i];
        if (Math.abs(a - (c.base[i] ?? 0)) > 0.6 && Math.abs(a) > 0.6) return done({ i, inv: a < 0 });
      }
      return;
    }
    for (let i = 0; i < buttons.length; i++) {
      if (buttons[i] > 0.6 && (c.prevButtons[i] ?? 0) < 0.3) return done({ t: 'b', i });
    }
    for (let i = 0; i < gp.axes.length; i++) {
      const a = gp.axes[i]; const base = c.base[i] ?? 0;
      if (Math.abs(a - base) < 0.6) continue;
      if (base < -0.8 && a > 0.2) return done({ t: 'a', i, full: true });
      if (Math.abs(a) > 0.6) return done({ t: 'a', i, s: Math.sign(a - base) });
    }
    c.prevButtons = buttons;
  }

  // ---- Poll -----------------------------------------------------------------------------------

  /** Read the connected controller once and return the snapshot. Call once per animation frame. */
  poll(now = performance.now()) {
    const pads = this.#refresh(false);
    const gp = this.#choose(pads, now);
    this.#syncStream(gp);
    this.#checkCapture(gp);
    const s = this.#emptyState();
    let active = false;
    const usbFresh = (t) => now - t < 300;

    if (gp) {
      const map = this.bindingsFor(gp.id);
      const axis = (b) => { const a = gp.axes[b?.i] ?? 0; return b?.inv ? -a : a; };
      const val = (src) => {
        if (!src) return 0;
        if (src.t === 'b') { const b = gp.buttons[src.i]; return b ? (b.value || (b.pressed ? 1 : 0)) : 0; }
        if (src.t !== 'a') return 0;
        const a = gp.axes[src.i] ?? 0;
        return src.full ? Math.max(0, Math.min(1, (a + 1) / 2)) : Math.max(0, Math.min(1, a * src.s));
      };
      const any = (list) => Math.max(0, ...[].concat(list || []).map(val));
      [s.lx, s.ly] = [axis(map.lx), axis(map.ly)];
      [s.cx, s.cy] = [axis(map.cx), axis(map.cy)];
      s.l = any(map.l); s.r = any(map.r);
      for (const k of Object.keys(s.btn)) s.btn[k] = any(map[k]) >= 0.5;
      if (this.hiResSticks && this.usb.sticks && usbFresh(this.usb.sticksT)) this.#applyUsbSticks(s);
      s.source = 'gamepad';
      this.raw = {
        kind: 'gamepad', axes: [...gp.axes], buttons: gp.buttons.map((b) => b.value || (b.pressed ? 1 : 0)),
        timestamp: gp.timestamp, id: gp.id, mapping: gp.mapping, index: gp.index,
      };
    } else if (this.usb.kind === 'sticks' && this.usb.sticks && usbFresh(this.usb.sticksT)) {
      this.#applyUsbSticks(s);
      s.source = 'usb';
      this.raw = { kind: 'usb-sticks', sticks: this.usb.sticks };
    } else if (this.usb.raw && usbFresh(this.usb.rawT)) {
      const inputs = this.usb.raw;
      const map = this.bindingsFor('usb');
      const v = (code) => (inputs[code]?.value ?? 0) / 127;
      [s.lx, s.ly] = [v(CODE.LX_RIGHT) - v(CODE.LX_LEFT), v(CODE.LY_UP) - v(CODE.LY_DOWN)];
      [s.cx, s.cy] = [v(CODE.RX_RIGHT) - v(CODE.RX_LEFT), v(CODE.RY_UP) - v(CODE.RY_DOWN)];
      const b = usbButtons(inputs, map);
      s.l = b.l; s.r = b.r;
      for (const k of Object.keys(s.btn)) s.btn[k] = b[k];
      // (press edges were already latched per report in #onReport)
      s.source = 'usb';
      this.raw = { kind: 'usb-raw', inputs };
    } else {
      this.raw = { kind: 'none' };
    }
    // What the game sees: GameCube bytes → Melee stick units / analog trigger range (melee.js).
    s.raw = { lx: s.lx, ly: s.ly, cx: s.cx, cy: s.cy, l: s.l, r: s.r };
    const ms = meleeStick(s.lx, s.ly); const mc = meleeStick(s.cx, s.cy);
    const ml = meleeTrigger(s.l); const mr = meleeTrigger(s.r);
    s.melee = { main: ms, c: mc, l: ml, r: mr };
    s.lx = ms.x; s.ly = ms.y; s.cx = mc.x; s.cy = mc.y; s.l = ml.value; s.r = mr.value;
    if (s.source === 'gamepad') this.latch.sample({ ...s.btn, trig: s.btn.shield || Math.max(s.l, s.r) >= TRIGGER.SHIELD_MIN });
    if (s.source !== 'none') {
      active = Object.values(s.btn).some(Boolean) || Math.hypot(s.raw.lx, s.raw.ly) > 0.35 || Math.hypot(s.raw.cx, s.raw.cy) > 0.35 || s.raw.l > 0.35 || s.raw.r > 0.35;
    }
    if (active) this.lastInputAt = now;
    if (s.source !== this.source) { this.source = s.source; this.dispatchEvent(new Event('change')); }

    // Keyboard shortcuts (meta only) and edges.
    const held = new Set([...this.keys, ...this.tapped]);
    this.tapped.clear();
    for (const [k, codes] of Object.entries(META_KEYS)) if (codes.some((c) => held.has(c))) s.btn[k] = true;
    const metaPresses = this.metaLatch.take() || {};
    for (const k of META) {
      s.edges[k] = (s.btn[k] && !this.prevMeta[k]) || !!metaPresses[k];
      this.prevMeta[k] = s.btn[k];
    }
    s.flash = this.latch.takeFlash();
    this.lastPollAt = performance.now();
    this.state = s;
    return s;
  }

  #applyUsbSticks(s) {
    const k = HOJA_FULL_SCALE; const st = this.usb.sticks;
    [s.lx, s.ly] = [st.lx / k, st.ly / k];
    [s.cx, s.cy] = [st.rx / k, st.ry / k];
  }

  /** Human-readable description of what is driving input right now. */
  describeSource() {
    const name = this.deviceName();
    if (this.source === 'gamepad') {
      const n = this.matched.length;
      const hi = this.hiResSticks && this.usb.kind === 'sticks';
      if (n > 1) {
        const i = this.matched.findIndex((p) => p.index === this.activeIndex) + 1;
        return hi ? t('Gamepad API · matched to {name} (pad {i} of {n}) + 12-bit USB sticks', { name, i, n })
          : t('Gamepad API · matched to {name} (pad {i} of {n})', { name, i, n });
      }
      return hi ? t('Gamepad API · matched to {name} + 12-bit USB sticks', { name }) : t('Gamepad API · matched to {name}', { name });
    }
    if (this.source === 'usb') {
      return this.usb.kind === 'sticks' ? t('HOJA USB stream · {name} (12-bit sticks, no buttons)', { name }) : t('HOJA USB stream · {name}', { name });
    }
    return t('Waiting for {name}…', { name });
  }

  /** e.g. "057e:2009" for the connected controller, or ''. */
  deviceIdText() {
    const ids = this.deviceIds();
    return ids ? `${hex4(ids.vid)}:${hex4(ids.pid)}` : '';
  }
}
