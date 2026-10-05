/**
 * analysis.js — Controller measurements used by the Input lab (and snapback warnings in Play).
 *
 *   SnapbackWatch  spots a stick that, after being released from a full press, bounces past neutral
 *                  to the OTHER side and back — the classic cause of unwanted turnarounds.
 *   CircleTrace    records the furthest point reached in each 2° direction while you roll the stick
 *                  around the rim, and summarizes how round (or octagonal) the result is.
 *   probePollRate  busy-polls the Gamepad API for a few seconds and turns Gamepad.timestamp deltas
 *                  into an estimated update rate (bounded by the browser's own sampling rate).
 */
import { STICK } from './constants.js';
import { median } from './input.js';
import { angleDeg } from './controller.js';
import { t } from '../../i18n/index.js';

// ---------------------------------------------------------------------------------------------
// Snapback
// ---------------------------------------------------------------------------------------------

const SNAP_WINDOW_MS = 100; // a rebound has to start within this long of letting go
const SNAP_MAX_MS = 40;     // …and be over this quickly (a deliberate tilt the other way lasts longer)

class AxisSnap {
  constructor(axis) { this.axis = axis; this.reset(); }
  reset() { this.armed = 0; this.releasedAt = -1; this.crossedAt = -1; this.peak = 0; }
  update(v, t, report) {
    if (Math.abs(v) >= STICK.SMASH_X) { this.reset(); this.armed = Math.sign(v); return; }
    if (!this.armed) return;
    if (this.releasedAt < 0) {
      if (Math.abs(v) < STICK.NEUTRAL || Math.sign(v) !== this.armed) this.releasedAt = t; else return;
    }
    const opp = -this.armed * v; // > 0 when on the opposite side
    if (opp >= STICK.NEUTRAL) {
      if (this.crossedAt < 0) this.crossedAt = t;
      this.peak = Math.max(this.peak, opp);
      if (this.peak >= STICK.SMASH_X) { this.reset(); return; } // a deliberate flick the other way
    } else if (this.crossedAt >= 0) {
      if (t - this.crossedAt <= SNAP_MAX_MS) report({ axis: this.axis, from: this.armed, peak: this.peak, after: this.crossedAt - this.releasedAt, lasted: t - this.crossedAt });
      this.reset();
      return;
    }
    if (t - this.releasedAt > SNAP_WINDOW_MS && this.crossedAt < 0) this.reset();
  }
}

export class SnapbackWatch {
  constructor(report) {
    this.report = report;
    this.x = new AxisSnap('X');
    this.y = new AxisSnap('Y');
  }
  /** Feed a stick sample; t in ms. */
  update(x, y, t) {
    this.x.update(x, t, this.report);
    this.y.update(y, t, this.report);
  }
}

export function describeSnap(e) {
  const dir = e.axis === 'X' ? (e.from > 0 ? t('right → left') : t('left → right')) : (e.from > 0 ? t('up → down') : t('down → up'));
  return t('Snapback on {axis} ({dir}): bounced to {value} for {ms} ms',
    { axis: e.axis, dir, value: (e.from * -e.peak).toFixed(2), ms: Math.max(1, Math.round(e.lasted)) });
}

// ---------------------------------------------------------------------------------------------
// Circularity / coverage
// ---------------------------------------------------------------------------------------------

export const TRACE_BINS = 180; // 2° each

export class CircleTrace {
  constructor() { this.reset(); }
  reset() { this.r = new Float32Array(TRACE_BINS); this.samples = 0; }

  add(x, y) {
    const m = Math.hypot(x, y);
    if (m < 0.5) return; // only the rim matters
    const bin = Math.floor(angleDeg(x, y) / (360 / TRACE_BINS)) % TRACE_BINS;
    if (m > this.r[bin]) this.r[bin] = m;
    this.samples++;
  }

  /** Visited bins as [{angle (deg), r}]. */
  points() {
    const out = [];
    for (let i = 0; i < TRACE_BINS; i++) if (this.r[i] > 0) out.push({ angle: (i + 0.5) * (360 / TRACE_BINS), r: this.r[i] });
    return out;
  }

  summary() {
    const pts = this.points();
    if (pts.length < 8) return null;
    const rs = pts.map((p) => p.r);
    const mean = rs.reduce((a, b) => a + b, 0) / rs.length;
    const min = Math.min(...rs); const max = Math.max(...rs);
    const near = (center) => pts.filter((p) => Math.abs(((p.angle - center + 540) % 360) - 180) <= 5).map((p) => p.r);
    const avgOf = (centers) => { const v = centers.flatMap(near); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN; };
    const cardinal = avgOf([0, 90, 180, 270]);
    const diagonal = avgOf([45, 135, 225, 315]);
    return {
      coverage: pts.length / TRACE_BINS,
      mean, min, max,
      roundness: ((max - min) / mean) * 100,
      cardinal, diagonal,
      corners: this.corners(mean),
    };
  }

  /** Local maxima of radius (the corners/notches of an octagonal gate), up to 8. */
  corners(mean) {
    const r = this.r; const n = TRACE_BINS; const span = 6; // ±12°
    const cands = [];
    for (let i = 0; i < n; i++) {
      if (!r[i] || r[i] < mean * 1.02) continue;
      let peak = true;
      for (let k = 1; k <= span && peak; k++) if (r[(i + k) % n] > r[i] || r[(i - k + n) % n] > r[i]) peak = false;
      if (peak) cands.push({ angle: (i + 0.5) * (360 / n), r: r[i] });
    }
    cands.sort((a, b) => b.r - a.r);
    const out = [];
    for (const c of cands) {
      if (out.every((o) => Math.abs(((o.angle - c.angle + 540) % 360) - 180) >= 20)) out.push(c);
      if (out.length === 8) break;
    }
    return out.sort((a, b) => a.angle - b.angle);
  }
}

// ---------------------------------------------------------------------------------------------
// Poll rate probe
// ---------------------------------------------------------------------------------------------

/**
 * Busy-poll navigator.getGamepads() for `ms` and collect timestamp deltas for one pad.
 * Uses a MessageChannel ping-pong (much finer than setTimeout's 4 ms clamp) — only for a few seconds.
 * @returns {{cancel: Function, done: Promise<{intervals:number[], rate:number, median:number, p95:number, jitter:number, changes:number}>}}
 */
export function probePollRate(padIndex, ms = 3000, onProgress) {
  const ch = new MessageChannel();
  let canceled = false;
  const intervals = [];
  let lastTs = null;
  const start = performance.now();
  const done = new Promise((resolve) => {
    ch.port1.onmessage = () => {
      const now = performance.now();
      let gp = null;
      try { gp = navigator.getGamepads()[padIndex]; } catch { /* ignore */ }
      if (gp && gp.timestamp !== lastTs) {
        if (lastTs != null) {
          const d = gp.timestamp - lastTs;
          if (d > 0.05 && d < 250) intervals.push(d);
        }
        lastTs = gp.timestamp;
      }
      if (onProgress && intervals.length % 20 === 0) onProgress((now - start) / ms);
      if (!canceled && now - start < ms) ch.port2.postMessage(0);
      else {
        ch.port1.close();
        resolve(summarize(intervals));
      }
    };
    ch.port2.postMessage(0);
  });
  return { cancel: () => { canceled = true; }, done };
}

export function summarize(intervals) {
  const med = median(intervals);
  const sorted = [...intervals].sort((a, b) => a - b);
  const p95 = sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] : NaN;
  const mean = intervals.reduce((a, b) => a + b, 0) / (intervals.length || 1);
  const jitter = Math.sqrt(intervals.reduce((a, b) => a + (b - mean) ** 2, 0) / (intervals.length || 1));
  return { intervals, changes: intervals.length, median: med, p95, jitter, rate: med > 0 ? 1000 / med : 0 };
}
