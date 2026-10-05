/**
 * scope.js — An oscilloscope-style visualizer for haptic feedback.
 *
 *   const scope = hapticScope({ getStrength: () => 0.78 });
 *   scope.startTest(); ... scope.endTest();     // the 1 s test buzz
 *   scope.bump('left', 'press');                 // a trigger click (or 'release')
 *   scope.preview();                             // short ripple after the intensity changes
 *
 * What it draws is modelled on the firmware (HOJA-LIB-RP2040), shown in slow motion so it's visible:
 *   - HAPTIC_CMD_TEST_STRENGTH drives the motor at full amplitude for 125 × 8 ms ≈ 1 s
 *     (src/devices/haptics.c); the motor output is scaled by haptic_strength.
 *   - Trigger haptics play a short click when a trigger passes its activation point, and a softer one on
 *     release (pcm_play_bump in src/utilities/pcm.c, samples in include/utilities/pcm_samples.h): a pulse
 *     up, a pulse down, then neutral. Drawn as one cycle, with release ≈ 75% of press (191 vs 253 peak).
 * The trace scrolls right-to-left; amplitude is always multiplied by the intensity setting, and the
 * dashed guide lines mark the current intensity ceiling.
 */
import { canvasSurface, withAlpha, prefersReducedMotion } from '../../ui/canvas-surface.js';
import { t } from '../../i18n/index.js';

// Trigger clicks: one short pulse up, then down, then back to neutral — like a click.
// Peak heights follow the firmware's click samples (pcm_samples.h): press peaks at 253, release at 191.
const CLICK = {
  press: { ms: 170, peak: 1 },
  release: { ms: 200, peak: 191 / 253 },
};

/** One click cycle at phase p (0..1): an up lobe, a slightly smaller down lobe, then neutral. */
function clickShape(p) {
  if (p < 0 || p >= 1) return 0;
  return Math.sin(2 * Math.PI * p) * (p < 0.5 ? 1 : 0.7);
}

const WINDOW_MS = 1800;     // visible history, right edge = now
const CARRIER_HZ = 9;       // visual stand-in for the motor frequency (the real one is far too fast to see)
const TEST_MS = 1000;       // HAPTIC_CMD_TEST_STRENGTH duration (125 ticks × 8 ms)
const TEST_ATTACK = 70;
const TEST_RELEASE = 140;
const PREVIEW_MS = 380;

/**
 * @param {{getStrength: () => number, label?: string}} o getStrength returns 0..1
 */
export function hapticScope(o) {
  /** Active and recent events. Each: { kind, side, start, end?, ms? } (times from performance.now()). */
  let events = [];
  let raf = 0;
  let lastLabel = null;
  const reduced = () => prefersReducedMotion();

  /** Signal value at absolute time t (ms), before the strength scale. Range about −1..1. */
  function signal(t) {
    let v = 0;
    for (const e of events) {
      const dt = t - e.start;
      if (dt < 0) continue;
      let env = 0;
      if (e.kind === 'test') {
        const end = e.end ?? Infinity;
        if (t > end + TEST_RELEASE) continue;
        const attack = Math.min(1, dt / TEST_ATTACK);
        const release = t > end ? Math.max(0, 1 - (t - end) / TEST_RELEASE) : 1;
        env = attack * release;
      } else if (e.kind === 'press' || e.kind === 'release') {
        const c = CLICK[e.kind];
        v += c.peak * clickShape(dt / c.ms); // a click is the waveform itself, no carrier
        continue;
      } else if (e.kind === 'preview') {
        env = Math.sin(Math.PI * Math.min(1, dt / PREVIEW_MS)) * 0.9;
        if (dt > PREVIEW_MS) env = 0;
      }
      if (env > 0) v += env * Math.sin((dt / 1000) * CARRIER_HZ * 2 * Math.PI);
    }
    return Math.max(-1, Math.min(1, v));
  }

  function eventEnd(e) {
    if (e.kind === 'test') return e.end == null ? Infinity : e.end + TEST_RELEASE;
    if (e.kind === 'preview') return e.start + PREVIEW_MS;
    return e.start + CLICK[e.kind].ms;
  }

  function draw(ctx, w, h, c) {
    const now = performance.now();
    const strength = Math.max(0, Math.min(1, o.getStrength()));
    const mid = h / 2;
    const amp = (h / 2 - 14) * strength;

    // Grid
    ctx.strokeStyle = withAlpha(c.textMuted, 0.12);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= w; x += w / 12) { ctx.moveTo(Math.round(x) + 0.5, 0); ctx.lineTo(Math.round(x) + 0.5, h); }
    for (let y = 0; y <= h; y += h / 6) { ctx.moveTo(0, Math.round(y) + 0.5); ctx.lineTo(w, Math.round(y) + 0.5); }
    ctx.stroke();
    ctx.strokeStyle = withAlpha(c.textMuted, 0.3);
    ctx.beginPath(); ctx.moveTo(0, mid + 0.5); ctx.lineTo(w, mid + 0.5); ctx.stroke();

    // Intensity ceiling guides
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = withAlpha(c.yellow, 0.55);
    ctx.beginPath();
    ctx.moveTo(0, mid - amp); ctx.lineTo(w, mid - amp);
    ctx.moveTo(0, mid + amp); ctx.lineTo(w, mid + amp);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = withAlpha(c.yellow, 0.9);
    ctx.font = `600 11px ${c.fontUi || 'sans-serif'}`;
    ctx.textBaseline = 'bottom';
    ctx.fillText(t('Intensity {n}%', { n: Math.round(strength * 100) }), 8, Math.max(13, mid - amp - 3));

    // Trace (scrolling: x = w is "now"). In reduced motion the latest event is drawn frozen and centered.
    let tAt;
    if (reduced() && events.length) {
      const e = events[events.length - 1];
      const span = Math.min(WINDOW_MS, eventEnd(e) - e.start + 200);
      const t0 = e.start - (WINDOW_MS - span) / 2;
      tAt = (x) => t0 + (x / w) * WINDOW_MS;
    } else {
      tAt = (x) => now - WINDOW_MS + (x / w) * WINDOW_MS;
    }
    const pts = [];
    const step = Math.max(1, w / 600);
    for (let x = 0; x <= w; x += step) pts.push([x, mid - signal(tAt(x)) * amp]);

    // Soft fill between the trace and the center line
    ctx.beginPath();
    ctx.moveTo(0, mid);
    for (const [x, y] of pts) ctx.lineTo(x, y);
    ctx.lineTo(w, mid);
    ctx.closePath();
    ctx.fillStyle = withAlpha(c.yellow, 0.12);
    ctx.fill();

    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.strokeStyle = c.yellow;
    ctx.lineWidth = 2.25;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Event label (top right)
    const live = events.filter((e) => eventEnd(e) > now - 400);
    // A running test outranks trigger clicks for the label.
    const e = live.find((x) => x.kind === 'test') || live[live.length - 1];
    if (e) {
      const text = e.kind === 'test' ? t('TEST · 1 s buzz')
        : e.kind === 'preview' ? t('Intensity preview')
          : e.side === 'left'
            ? (e.kind === 'press' ? t('L trigger click') : t('L trigger release'))
            : (e.kind === 'press' ? t('R trigger click') : t('R trigger release'));
      lastLabel = text;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillStyle = c.text;
      ctx.font = `700 12px ${c.fontUi || 'sans-serif'}`;
      ctx.fillText(text, w - 10, 8);
      ctx.textAlign = 'left';
    }

    // Keep animating while anything is on screen; stop when idle to save power.
    events = events.filter((ev) => eventEnd(ev) > now - WINDOW_MS);
    if (events.length && !reduced()) raf = requestAnimationFrame(() => surface.invalidate());
    else raf = 0;
  }

  const surface = canvasSurface({ draw, aspect: 3.2, label: o.label || t('Haptic waveform') });

  function push(ev) {
    events.push({ start: performance.now(), ...ev });
    surface.invalidate();
  }

  return {
    el: surface.el,
    /** Begin the test buzz; call endTest() when the firmware confirms it finished. */
    startTest() { push({ kind: 'test', end: null }); },
    endTest() {
      const e = [...events].reverse().find((x) => x.kind === 'test' && x.end == null);
      // The firmware always buzzes for 125 × 8 ms, so never draw a shorter test than that.
      if (e) { e.end = Math.max(performance.now(), e.start + TEST_MS); surface.invalidate(); }
    },
    /** A trigger click: side 'left'|'right', kind 'press'|'release'. */
    bump(side, kind = 'press') { push({ kind, side }); },
    /** Short ripple after the intensity changes. */
    preview() { push({ kind: 'preview' }); },
    /** Redraw (e.g. after the intensity slider moves). */
    invalidate: () => surface.invalidate(),
    get lastLabel() { return lastLabel; },
    destroy() { cancelAnimationFrame(raf); surface.destroy(); },
  };
}
