/**
 * curve-graph.js — Stick response preview: input distance (x) → output distance (y), both 0–100 %.
 *
 * Mirrors the firmware maths in HOJA-LIB-RP2040 src/input/stick_deadzone.c:
 *   d ≤ inner                         → 0
 *   lin = (d − inner) / (1 − inner − outer), clamped to 1
 *   out = lin ^ exponent              (exponent from the offset-encoded l/r_exp_scaler)
 * The live dot plots the current stick (input distance from the snapback stream vs. the real output
 * distance from the deadzone stream), so you can see the curve working.
 */
import { canvasSurface, withAlpha } from '../../ui/canvas-surface.js';
import { t, fmt } from '../../i18n/index.js';

/** Firmware response for a normalized input distance (0..1). */
export function responseAt(x, inner, outer, exp) {
  if (x <= inner) return 0;
  const range = Math.max(1e-6, 1 - inner - outer);
  const lin = Math.min(1, (x - inner) / range);
  return lin ** exp;
}

export function curveGraph() {
  const state = { inner: 0, outer: 0, exp: 1, live: null };

  const surface = canvasSurface({ aspect: 16 / 10, className: 'js-curve', label: t('Stick response curve: input distance (horizontal) to output distance (vertical), in percent'), draw });

  function draw(ctx, w, hgt, c) {
    const pad = { l: 34, r: 10, t: 10, b: 24 };
    const gw = w - pad.l - pad.r;
    const gh = hgt - pad.t - pad.b;
    if (gw < 8 || gh < 8) return; // hidden (inactive column on a narrow page)
    const X = (v) => pad.l + v * gw;
    const Y = (v) => pad.t + (1 - v) * gh;

    // Plot background and grid
    ctx.fillStyle = c.surface2;
    ctx.fillRect(pad.l, pad.t, gw, gh);
    ctx.strokeStyle = withAlpha(c.textFaint, 0.25);
    ctx.lineWidth = 1;
    ctx.font = `11px ${c.fontUi || 'sans-serif'}`;
    ctx.fillStyle = c.textMuted;
    for (const v of [0, 0.25, 0.5, 0.75, 1]) {
      ctx.beginPath(); ctx.moveTo(X(v), pad.t); ctx.lineTo(X(v), pad.t + gh); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(pad.l, Y(v)); ctx.lineTo(pad.l + gw, Y(v)); ctx.stroke();
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(fmt.number(v * 100), pad.l - 6, Y(v));
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(fmt.number(v * 100), X(v), pad.t + gh + 6);
    }

    // Deadzone bands
    ctx.fillStyle = withAlpha(c.red, 0.14);
    if (state.inner > 0) ctx.fillRect(X(0), pad.t, state.inner * gw, gh);
    if (state.outer > 0) ctx.fillRect(X(1 - state.outer), pad.t, state.outer * gw, gh);

    // Linear reference
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = withAlpha(c.textMuted, 0.6);
    ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.lineTo(X(1), Y(1)); ctx.stroke();
    ctx.setLineDash([]);

    // Response curve
    ctx.beginPath();
    const N = Math.max(60, Math.round(gw / 2));
    for (let i = 0; i <= N; i++) {
      const x = i / N;
      const y = responseAt(x, state.inner, state.outer, state.exp);
      i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y));
    }
    ctx.strokeStyle = c.red;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.lineWidth = 1;

    // Live stick
    if (state.live) {
      const lx = Math.min(1, state.live.input);
      const ly = Math.min(1, state.live.output);
      ctx.beginPath();
      ctx.arc(X(lx), Y(ly), 5, 0, Math.PI * 2);
      ctx.fillStyle = c.blue;
      ctx.fill();
      ctx.strokeStyle = c.surface;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.lineWidth = 1;
    }
  }

  return {
    el: surface.el,
    /** inner/outer in firmware units (0..2048), exp = multiplier. */
    set({ inner, outer, exp }) {
      state.inner = Math.max(0, Math.min(1, inner / 2048));
      state.outer = Math.max(0, Math.min(1, outer / 2048));
      state.exp = exp;
      surface.invalidate();
    },
    /** Live input/output distances, normalized 0..1. */
    setLive(input, output) {
      state.live = { input, output };
      surface.invalidate();
    },
    destroy() { surface.destroy(); },
  };
}
