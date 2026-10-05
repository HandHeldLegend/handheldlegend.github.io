/**
 * stick-visual.js — Live joystick visualizer (port of hoja2/components/joystick-visual.js).
 *
 * Fed from the 0xFE joystick stream (src/device/reports.js), both values centered, ±2048 = full:
 *   input  = r.sticks.snapback   stick after calibration/angle mapping + snapback filter, before deadzones
 *   output = r.sticks.deadzone   final output after inner/outer deadzone and response curve
 * (hoja2 labeled these "Raw" and "Scaled".)
 *
 * Draws: travel circle, inner/outer deadzone bands, angle-map spokes (with their "sticky" angular
 * deadzone wedges), the optional max-reach trace (180 × 2° buckets, keeps the furthest point), and both dots.
 * Readouts convert the output into what a console would see — the "Full / GC / Melee / N64" modes and
 * the scaling constants are exactly hoja2's.
 */
import { h } from '../../ui/dom.js';
import { segmented, toggle, button } from '../../ui/controls.js';
import { canvasSurface, withAlpha } from '../../ui/canvas-surface.js';
import { t, N_, fmt } from '../../i18n/index.js';

const R = 2048;
/** Minimum time between screen-reader position announcements (when the user turned them on). */
const ANNOUNCE_MS = 1000;

/** Output readout modes (hoja2 multi-position "output-visualizer-type"). Labels are format names (not translated). */
const MODES = [
  { value: 'full', label: 'Full', tip: N_('HOJA’s internal range: −2048 to 2047') },
  { value: 'gc', label: 'GC', tip: N_('GameCube units (×0.0537, whole numbers)') },
  { value: 'melee', label: 'Melee', tip: N_('Melee in-game coordinates (clamped to the 80-unit circle)') },
  { value: 'n64', label: 'N64', tip: N_('N64 units (×0.0415, whole numbers)') },
];

/** Melee's coordinate conversion (hoja2 getMeleeCoordinates). x, y already in GC units clamped to ±80. */
function meleeCoordinates(x, y) {
  const CLAMP_RADIUS = 80;
  const magnitude = Math.sqrt(x * x + y * y);
  const scale = magnitude > CLAMP_RADIUS ? CLAMP_RADIUS / magnitude : 1.0;
  const cx = Math.trunc(x * scale);
  const cy = Math.trunc(y * scale);
  return { x: cx / CLAMP_RADIUS, y: cy / CLAMP_RADIUS, decimals: 4 };
}

/** Convert centered ±2048 coordinates into a mode's units (hoja2 updateDisplays). */
function convert(mode, fullX, fullY) {
  if (mode === 'melee') {
    const c = (v) => Math.max(-80, Math.min(80, Math.round(v * 0.0537109375)));
    return meleeCoordinates(c(fullX), c(fullY));
  }
  const [scaler, decimals] = { full: [1, 1], gc: [0.0537109375, 0], n64: [0.04150390625, 0] }[mode] || [1, 1];
  const p = 10 ** decimals;
  return { x: Math.round(fullX * scaler * p) / p, y: Math.round(fullY * scaler * p) / p, decimals };
}

/** Locale-aware fixed-decimal number without grouping (so values don't change width); never "-0". */
const num = (v, d) => fmt.number(v || 0, { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: false });

/** Readout strings for one point: X/Y in the mode's units, angle (°) and distance (% of full travel). */
function describe(mode, x, y) {
  const c = convert(mode, x, y);
  let a = (Math.atan2(y, x) * 180) / Math.PI;
  if (a < 0) a += 360;
  if (a >= 359.95) a = 0;
  return {
    x: num(c.x, c.decimals),
    y: num(c.y, c.decimals),
    angle: `${num(a, 1)}°`,
    dist: fmt.percent(Math.hypot(x, y) / R, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
  };
}

/**
 * @param {{tone?: string, stick?: 'left'|'right'}} [o]
 * @returns {{el: HTMLElement, setInput: Function, setDeadzones: Function, setSlots: Function, resetTrace: Function, destroy: Function}}
 */
export function stickVisual(o = {}) {
  const state = {
    inX: 0, inY: 0, outX: 0, outY: 0,
    inner: 0, outer: 0,       // deadzones as fractions of the radius
    slots: [],                // [{out_angle, deadzone}] enabled slots
    tracing: false,
    trace: new Map(),         // bucket (0..179) -> {x, y, d}
    mode: 'full',
  };
  const stickName = o.stick === 'right' ? t('Right stick') : o.stick === 'left' ? t('Left stick') : t('Stick');
  const inTip = t('Stick position after calibration and snapback filtering, before deadzones.');
  const outTip = t('What the console receives, after deadzones and the response curve.');

  // ---- Readout panel: real text (the canvas is only a picture of it) --------------------------
  // Values update at most once per animation frame (from draw) and only when their text changed.
  const cells = {};
  const cell = (key) => (cells[key] = h('td', '—'));
  const marker = (kind) => h('i.js-swatch', { class: kind, 'aria-hidden': 'true' });
  const row = (key, label) => h('tr', h('th', { scope: 'row' }, label), cell(`in-${key}`), cell(`out-${key}`));
  const unitsNote = h('p.js-units');
  const readout = h('div.js-readout', { role: 'group', 'aria-label': t('{stick} readout', { stick: stickName }) },
    h('table.js-rtable',
      h('thead', h('tr',
        h('td'),
        h('th', { scope: 'col', 'data-tip': inTip }, marker('in'), t('Input')),
        h('th', { scope: 'col', 'data-tip': outTip }, marker('out'), t('Output')))),
      h('tbody',
        row('x', 'X'),
        row('y', 'Y'),
        row('angle', t('Angle')),
        row('dist', t('Distance')))),
    unitsNote);
  const shown = {}; // key → text currently in the DOM
  const put = (key, text) => { if (shown[key] !== text) { shown[key] = text; cells[key].textContent = text; } };

  // Opt-in screen-reader announcements (a live region on every report would be far too chatty).
  const live = h('div.sr-only', { 'aria-live': 'polite', 'aria-atomic': 'true' });
  let announceTimer = 0;
  let lastAnnounced = '';
  const announceBtn = button({ label: t('Announce position'), variant: 'ghost', size: 'sm', onClick: () => setAnnounce(!announceTimer) });
  announceBtn.classList.add('js-announce');
  announceBtn.setAttribute('aria-pressed', 'false');
  announceBtn.dataset.tip = t('Reads the output position aloud with a screen reader, at most once a second.');
  function announce() {
    const d = describe(state.mode, state.outX, state.outY);
    const text = t('{stick} output: X {x}, Y {y}, angle {angle}, distance {distance}', {
      stick: stickName, x: d.x, y: d.y, angle: d.angle, distance: d.dist,
    });
    if (text !== lastAnnounced) { lastAnnounced = text; live.textContent = text; }
  }
  function setAnnounce(on) {
    clearInterval(announceTimer);
    announceTimer = 0;
    announceBtn.setAttribute('aria-pressed', String(on));
    lastAnnounced = '';
    live.textContent = '';
    if (on) { announce(); announceTimer = setInterval(announce, ANNOUNCE_MS); }
  }

  const surface = canvasSurface({ aspect: 1, label: t('{stick}: live position diagram', { stick: stickName }), draw });

  const modeSeg = segmented({
    options: MODES.map((m) => ({ value: m.value, label: m.label })), value: 'full', tone: o.tone, ariaLabel: t('Output units'),
    onChange: (v) => { state.mode = v; syncUnits(); surface.invalidate(); },
  });
  MODES.forEach((m, i) => modeSeg.querySelectorAll('button')[i]?.setAttribute('data-tip', t(m.tip)));
  function syncUnits() { unitsNote.textContent = t('X / Y: {units}', { units: t(MODES.find((m) => m.value === state.mode).tip) }); }
  syncUnits();

  const traceToggle = toggle({
    checked: false, label: t('Trace'), tone: o.tone,
    onChange: (on) => { state.tracing = on; state.trace.clear(); surface.invalidate(); },
  });
  const clearBtn = button({ icon: 'refresh', variant: 'ghost', size: 'sm', title: t('Clear trace'), onClick: () => api.resetTrace() });

  const el = h('div.js-visual', h('div.js-vis-grid',
    h('div.js-vis-main',
      surface.el,
      h('div.js-legend',
        h('span.js-key', { 'data-tip': inTip }, h('i.js-swatch.in'), t('Input')),
        h('span.js-key', { 'data-tip': outTip }, h('i.js-swatch.out'), t('Output')),
        h('span.js-key', { 'data-tip': t('Furthest point reached at each angle while Trace is on.') }, h('i.js-swatch.trace'), t('Trace')))),
    h('div.js-vis-side',
      readout,
      h('div.js-controls',
        modeSeg,
        h('div.js-trace', traceToggle, h('span', { 'aria-hidden': 'true' }, t('Trace')), clearBtn),
        announceBtn),
      live)));

  function updateReadout() {
    const i = describe(state.mode, state.inX, state.inY);
    const out = describe(state.mode, state.outX, state.outY);
    for (const k of ['x', 'y', 'angle', 'dist']) { put(`in-${k}`, i[k]); put(`out-${k}`, out[k]); }
  }

  function draw(ctx, w, hgt, c) {
    updateReadout(); // text follows the canvas frame rate, not the ~125 Hz report rate
    const cx = w / 2;
    const cy = hgt / 2;
    const rad = Math.min(w, hgt) / 2 - 8;
    if (rad < 8) return; // hidden (e.g. the inactive column of a left/right split on a narrow page)
    const toPx = (x, y) => [cx + (x / R) * rad, cy - (y / R) * rad];

    // Travel circle + guides
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fillStyle = c.surface2;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = c.border;
    ctx.stroke();

    ctx.lineWidth = 1;
    ctx.strokeStyle = withAlpha(c.textFaint, 0.25);
    for (const f of [0.25, 0.5, 0.75]) {
      ctx.beginPath();
      ctx.arc(cx, cy, rad * f, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Angle map: sticky wedges + spokes at each output angle
    for (const s of state.slots) {
      const a = (-s.out_angle * Math.PI) / 180;
      const dz = (Math.max(0, s.deadzone) * Math.PI) / 180;
      if (dz > 0) {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, rad, a - dz, a + dz);
        ctx.closePath();
        ctx.fillStyle = withAlpha(c.accent, 0.16);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
      ctx.strokeStyle = withAlpha(c.textFaint, 0.45);
      ctx.setLineDash([3, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Deadzones
    if (state.inner > 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, rad * state.inner, 0, Math.PI * 2);
      ctx.fillStyle = withAlpha(c.red, 0.14);
      ctx.fill();
      ctx.strokeStyle = withAlpha(c.red, 0.45);
      ctx.stroke();
    }
    if (state.outer > 0) {
      const r0 = rad * Math.max(0, 1 - state.outer);
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.arc(cx, cy, r0, 0, Math.PI * 2, true);
      ctx.fillStyle = withAlpha(c.red, 0.14);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, r0, 0, Math.PI * 2);
      ctx.strokeStyle = withAlpha(c.red, 0.45);
      ctx.stroke();
    }

    // Trace polygon
    if (state.trace.size > 2) {
      const pts = [...state.trace.entries()].sort((a, b) => a[0] - b[0]).map(([, p]) => toPx(p.x, p.y));
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fillStyle = withAlpha(c.green, 0.18);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = withAlpha(c.green, 0.85);
      ctx.stroke();
      ctx.lineWidth = 1;
    }

    // Center cross
    ctx.strokeStyle = c.textFaint;
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy); ctx.lineTo(cx + 8, cy);
    ctx.moveTo(cx, cy - 8); ctx.lineTo(cx, cy + 8);
    ctx.stroke();

    // Output vector + dots
    const [ox, oy] = toPx(state.outX, state.outY);
    const [ix, iy] = toPx(state.inX, state.inY);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(ox, oy);
    ctx.strokeStyle = withAlpha(c.blue, 0.5);
    ctx.lineWidth = 2;
    ctx.stroke();

    // Input: a ring, so it stays visible when the output dot sits on top of it.
    const dotR = Math.max(5, rad * 0.035);
    ctx.beginPath();
    ctx.arc(ix, iy, dotR + 3.5, 0, Math.PI * 2);
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = withAlpha(c.red, 0.9);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(ox, oy, dotR, 0, Math.PI * 2);
    ctx.fillStyle = withAlpha(c.blue, 0.9);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = c.surface;
    ctx.stroke();
    ctx.lineWidth = 1;
  }

  function addTracePoint(x, y) {
    const d = Math.hypot(x, y);
    let a = (Math.atan2(y, x) * 180) / Math.PI;
    if (a < 0) a += 360;
    const bucket = Math.floor(a / 2) % 180;
    const prev = state.trace.get(bucket);
    if (!prev || d > prev.d) state.trace.set(bucket, { x, y, d });
  }

  const clampR = (v) => Math.max(-R, Math.min(R, v));

  const api = {
    el,
    /** Centered values (±2048). */
    setInput(inX, inY, outX, outY) {
      state.inX = clampR(inX); state.inY = clampR(inY);
      state.outX = clampR(outX); state.outY = clampR(outY);
      if (state.tracing) addTracePoint(state.outX, state.outY);
      surface.invalidate();
    },
    /** Deadzones in firmware units (0..2048). */
    setDeadzones(inner, outer) {
      state.inner = Math.max(0, Math.min(1, inner / R));
      state.outer = Math.max(0, Math.min(1, outer / R));
      surface.invalidate();
    },
    /** Enabled angle-map slots, for the spokes. */
    setSlots(slots) {
      state.slots = slots.map((s) => ({ out_angle: s.out_angle, deadzone: s.deadzone }));
      surface.invalidate();
    },
    resetTrace() { state.trace.clear(); surface.invalidate(); },
    destroy() { setAnnounce(false); surface.destroy(); },
  };
  return api;
}
