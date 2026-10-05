/**
 * waveform.js — Snapback analyzer plot (modernized port of hoja2/components/waveform-display.js).
 *
 * Input: the firmware's analog dump report (id 0xFA, WEBUSB_ANALOG_DUMP), 64 bytes:
 *   [0]      0xFA
 *   [1]      axis index: 0 LX, 1 LY, 2 RX, 3 RY
 *   [2..63]  62 samples of that axis *after* the snapback filter, each (value + 2048) >> 4 → 0..255,
 *            so 128 = center and ±128 ≈ full deflection.
 * Capture (src/input/snapback.c snapback_webcapture): once an axis goes past ~87 % (within 265 of either
 * end), the firmware waits for it to come back inside and then records one sample per analog poll
 * (ANALOG_POLL_INTERVAL = 500 µs → 2 kHz), i.e. the ~31 ms right after you let go.
 *
 * Drawing: HiDPI canvas sized to its container, colors from theme tokens (re-read on theme change),
 * left-to-right reveal animation (skipped with reduced motion), plus derived stats: peaks, overshoot past
 * center and time to settle.
 */
import { h } from '../../ui/dom.js';
import { canvasSurface, withAlpha, prefersReducedMotion } from '../../ui/canvas-surface.js';
import { t, N_, fmt } from '../../i18n/index.js';

export const AXES = [
  { name: 'LX', label: N_('Left stick X'), color: 'red', stick: 'left' },
  { name: 'LY', label: N_('Left stick Y'), color: 'yellow', stick: 'left' },
  { name: 'RX', label: N_('Right stick X'), color: 'blue', stick: 'right' },
  { name: 'RY', label: N_('Right stick Y'), color: 'green', stick: 'right' },
];

/** Microseconds between samples (firmware ANALOG_POLL_INTERVAL). */
export const SAMPLE_US = 500;
const SETTLE_PCT = 5;

/**
 * Parse an analog dump. Accepts a DataView (device event detail) or Uint8Array.
 * @returns {{axis: number, samples: number[], time: Date}|null} samples as −1..1 fractions of full deflection
 */
export function parseDump(data) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  if (bytes.length < 64) return null;
  const axis = bytes[1];
  if (axis > 3) return null;
  const samples = Array.from(bytes.subarray(2, 64), (v) => Math.max(-1, Math.min(1, (v - 128) / 128)));
  return { axis, samples, time: new Date() };
}

/** Peaks, overshoot (swing past center, opposite to the release side) and settle time. */
export function analyze(samples) {
  let pos = 0; let neg = 0;
  for (const s of samples) { pos = Math.max(pos, s); neg = Math.min(neg, s); }
  const side = Math.sign(samples.find((s) => Math.abs(s) > 0.02) || 0) || 1;
  const overshoot = side > 0 ? -neg : pos;
  let settleIdx = samples.length;
  for (let i = samples.length - 1; i >= 0; i--) {
    if (Math.abs(samples[i]) * 100 >= SETTLE_PCT) break;
    settleIdx = i;
  }
  return {
    peakPos: pos * 100, peakNeg: -neg * 100, overshoot: Math.max(0, overshoot) * 100,
    settledMs: settleIdx < samples.length ? (settleIdx * SAMPLE_US) / 1000 : null,
  };
}

/**
 * One stick's plot. `emptyText` is shown until the first capture arrives.
 * The reveal animation runs inside draw() and re-invalidates the surface until it is done, so the canvas
 * surface's coalesced requestAnimationFrame is the only redraw path (no separate animation loop).
 * @param {{label?: string, emptyText?: string}} [o]
 */
export function waveformView(o = {}) {
  let capture = null;
  let revealStart = 0; // performance.now() when the current capture started drawing; 0 = fully drawn
  const REVEAL_MS = 450;

  const surface = canvasSurface({ aspect: 16 / 9, className: 'wf-canvas', label: o.label || t('Snapback waveform'), draw });

  function draw(ctx, w, hgt, c) {
    const pad = { l: 44, r: 12, t: 12, b: 26 };
    const gw = w - pad.l - pad.r;
    const gh = hgt - pad.t - pad.b;
    const n = capture?.samples.length || 62;
    const X = (i) => pad.l + (i / (n - 1)) * gw;
    const Y = (v) => pad.t + (1 - (v + 1) / 2) * gh;

    // Plot area
    ctx.fillStyle = c.surface2;
    ctx.fillRect(pad.l, pad.t, gw, gh);

    ctx.font = `11px ${c.fontUi || 'sans-serif'}`;
    ctx.lineWidth = 1;
    // Horizontal grid: −100 … +100 %
    for (const v of [-1, -0.5, 0, 0.5, 1]) {
      ctx.strokeStyle = v === 0 ? withAlpha(c.textMuted, 0.7) : withAlpha(c.textFaint, 0.3);
      ctx.beginPath(); ctx.moveTo(pad.l, Y(v)); ctx.lineTo(pad.l + gw, Y(v)); ctx.stroke();
      ctx.fillStyle = c.textMuted;
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(fmt.percent(v, { signDisplay: 'exceptZero' }), pad.l - 6, Y(v));
    }
    // Vertical grid every 5 ms
    const totalMs = ((n - 1) * SAMPLE_US) / 1000;
    for (let ms = 0; ms <= totalMs + 0.01; ms += 5) {
      const x = pad.l + (ms / totalMs) * gw;
      ctx.strokeStyle = withAlpha(c.textFaint, 0.3);
      ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, pad.t + gh); ctx.stroke();
      ctx.fillStyle = c.textMuted;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(`${fmt.number(ms)} ms`, x, pad.t + gh + 7);
    }
    // ±settle band
    ctx.fillStyle = withAlpha(c.green, 0.1);
    ctx.fillRect(pad.l, Y(SETTLE_PCT / 100), gw, Y(-SETTLE_PCT / 100) - Y(SETTLE_PCT / 100));

    if (!capture) {
      ctx.fillStyle = c.textMuted;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `600 13px ${c.fontUi || 'sans-serif'}`;
      ctx.fillText(o.emptyText || t('Waiting for a flick…'), pad.l + gw / 2, pad.t + gh / 2 - 14);
      return;
    }

    let reveal = 1;
    if (revealStart) {
      reveal = Math.min(1, (performance.now() - revealStart) / REVEAL_MS);
      if (reveal < 1) surface.invalidate(); else revealStart = 0;
    }
    const col = c[AXES[capture.axis].color] || c.accent;
    const visible = Math.max(2, Math.round(reveal * n));
    const s = capture.samples;

    // Area to center
    ctx.beginPath();
    ctx.moveTo(X(0), Y(0));
    for (let i = 0; i < visible; i++) ctx.lineTo(X(i), Y(s[i]));
    ctx.lineTo(X(visible - 1), Y(0));
    ctx.closePath();
    ctx.fillStyle = withAlpha(col, 0.14);
    ctx.fill();

    // Line
    ctx.beginPath();
    for (let i = 0; i < visible; i++) (i ? ctx.lineTo(X(i), Y(s[i])) : ctx.moveTo(X(i), Y(s[i])));
    ctx.strokeStyle = col;
    ctx.lineWidth = 2.25;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    // Samples
    ctx.fillStyle = col;
    const r = gw / n > 6 ? 2.25 : 1.5;
    for (let i = 0; i < visible; i++) { ctx.beginPath(); ctx.arc(X(i), Y(s[i]), r, 0, Math.PI * 2); ctx.fill(); }
  }

  return {
    el: surface.el,
    /** Show a parsed capture (from parseDump). */
    show(c, animate = true) {
      capture = c;
      revealStart = animate && !prefersReducedMotion() ? performance.now() : 0;
      surface.invalidate();
    },
    destroy() { surface.destroy(); },
  };
}
