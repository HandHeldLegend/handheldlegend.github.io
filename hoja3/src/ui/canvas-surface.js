/**
 * canvas-surface.js — A crisp, theme-aware, self-sizing <canvas> for visualizers (shared UI kit).
 *
 * Used by the Joysticks visualizers and the Snapback waveform. (If more sections need it, it could be
 * promoted to src/ui/; until then it lives here per docs/SECTIONS.md.)
 *
 *   const surface = canvasSurface({ draw: (ctx, w, h, colors) => { ... }, aspect: 1 });
 *   parent.append(surface.el);
 *   surface.invalidate();   // schedule a redraw on the next animation frame (coalesced)
 *   surface.destroy();      // stop observers
 *
 * - Sizes itself to its container width (ResizeObserver) and an optional aspect ratio (CSS).
 * - Draws in CSS pixels; the backing store is scaled by devicePixelRatio, so lines stay sharp on HiDPI.
 * - `colors` holds the theme tokens read from getComputedStyle(:root); they are re-read whenever the theme
 *   changes (<html data-theme> mutation or the OS color-scheme media query).
 * - Redraws are throttled with requestAnimationFrame: call invalidate() as often as you like.
 */
import { h } from './dom.js';

/** CSS custom properties exposed to draw functions as camelCase keys (e.g. --text-muted → textMuted). */
const TOKENS = [
  '--red', '--yellow', '--blue', '--green', '--accent',
  '--red-soft', '--yellow-soft', '--blue-soft', '--green-soft', '--accent-soft',
  '--text', '--text-muted', '--text-faint', '--border', '--border-strong',
  '--surface', '--surface-2', '--surface-3', '--surface-sunken', '--font-ui', '--font-mono',
];

const camel = (name) => name.replace(/^--/, '').replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());

/** Read the theme tokens once. */
export function readThemeColors() {
  const cs = getComputedStyle(document.documentElement);
  const out = {};
  for (const t of TOKENS) out[camel(t)] = cs.getPropertyValue(t).trim();
  return out;
}

/** True when the user asked for less motion (OS setting or the app's "Reduce motion" preference). */
export function prefersReducedMotion() {
  return matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('reduce-motion');
}

/**
 * Subscribe to theme changes. Returns an unsubscribe function.
 * @param {() => void} fn
 */
export function onThemeChange(fn) {
  const mq = matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', fn);
  const mo = new MutationObserver(fn);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
  return () => { mq.removeEventListener('change', fn); mo.disconnect(); };
}

/**
 * Color with alpha from any CSS color string (hex or rgb()). Canvas accepts color-mix() only in newer
 * browsers, so we convert by hand.
 * @param {string} color '#rrggbb' | '#rgb' | 'rgb(r g b / a)' | 'rgb(r, g, b)'
 * @param {number} alpha 0..1
 */
export function withAlpha(color, alpha) {
  const c = String(color).trim();
  let m = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (m) {
    let hex = m[1];
    if (hex.length === 3) hex = hex.split('').map((x) => x + x).join('');
    const n = parseInt(hex, 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
  }
  m = c.match(/^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/i);
  if (m) return `rgba(${m[1]}, ${m[2]}, ${m[3]}, ${alpha})`;
  return c; // unknown format: no alpha rather than nothing
}

/**
 * @param {{draw: (ctx: CanvasRenderingContext2D, width: number, height: number, colors: object) => void,
 *          aspect?: number, className?: string, label?: string}} o
 *   aspect: width / height (default 1). The canvas fills its container's width.
 */
export function canvasSurface(o) {
  // Layout styles are inline so the surface works on any page without extra CSS.
  const canvas = h('canvas', { role: 'img', 'aria-label': o.label || '', style: { display: 'block', width: '100%', height: '100%' } });
  const el = h('div.cv-surface', { class: o.className, style: { width: '100%', aspectRatio: String(o.aspect ?? 1) } }, canvas);
  const ctx = canvas.getContext('2d');
  let colors = readThemeColors();
  let width = 0;
  let height = 0;
  let dpr = 0;
  let frame = 0;
  let destroyed = false;

  function resize() {
    const r = el.getBoundingClientRect();
    const nextDpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(r.width));
    const hh = Math.max(1, Math.round(r.height));
    if (w === width && hh === height && nextDpr === dpr) return;
    width = w; height = hh; dpr = nextDpr;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(hh * dpr);
    invalidate();
  }

  function paint() {
    frame = 0;
    if (destroyed || !width) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    try { o.draw(ctx, width, height, colors); } catch (err) { console.error('[canvas] draw failed', err); }
  }

  function invalidate() {
    if (!frame && !destroyed) frame = requestAnimationFrame(paint);
  }

  const ro = new ResizeObserver(resize);
  ro.observe(el);
  // devicePixelRatio changes (browser zoom, moving between monitors) don't always resize the element.
  window.addEventListener('resize', resize);
  const offTheme = onThemeChange(() => { colors = readThemeColors(); invalidate(); });

  return {
    el,
    canvas,
    invalidate,
    get size() { return { width, height }; },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(frame);
      ro.disconnect();
      window.removeEventListener('resize', resize);
      offTheme();
    },
  };
}
