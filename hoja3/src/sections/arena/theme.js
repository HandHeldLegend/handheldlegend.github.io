/**
 * theme.js — Canvas colors come from the app's CSS tokens (css/tokens.css), so the arena follows the
 * dark / light / system theme. watchTheme() re-reads them when the theme or motion preference changes.
 */
const TOKENS = {
  bg: '--bg', surface: '--surface', surface2: '--surface-2', surface3: '--surface-3', sunken: '--surface-sunken',
  border: '--border', text: '--text', muted: '--text-muted', faint: '--text-faint', onAccent: '--text-on-accent',
  accent: '--accent', accentStrong: '--accent-strong',
  red: '--red', yellow: '--yellow', blue: '--blue', green: '--green',
  fontUi: '--font-ui', fontMono: '--font-mono', fontDisplay: '--font-display',
};

export function readTheme() {
  const cs = getComputedStyle(document.documentElement);
  const t = {};
  for (const [k, v] of Object.entries(TOKENS)) t[k] = cs.getPropertyValue(v).trim();
  t.light = cs.colorScheme === 'light' || cs.getPropertyValue('color-scheme').trim() === 'light';
  return t;
}

/** True when the user asked for less motion (OS setting or the app's own preference). */
export function reducedMotion() {
  return matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('reduce-motion');
}

/** Call fn(theme) whenever the theme or motion preference changes. Returns an unsubscribe fn. */
export function watchTheme(fn) {
  let queued = false;
  const fire = () => {
    if (queued) return;
    queued = true;
    // Wait a frame so the new CSS variables have applied.
    requestAnimationFrame(() => { queued = false; fn(readTheme()); });
  };
  const mo = new MutationObserver(fire);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
  const mq1 = matchMedia('(prefers-color-scheme: light)');
  const mq2 = matchMedia('(prefers-reduced-motion: reduce)');
  mq1.addEventListener('change', fire);
  mq2.addEventListener('change', fire);
  return () => { mo.disconnect(); mq1.removeEventListener('change', fire); mq2.removeEventListener('change', fire); };
}

/** "#rrggbb" or "rgb(...)" + alpha → rgba() string (canvas helper). */
export function alpha(color, a) {
  const c = String(color).trim();
  if (c.startsWith('#')) {
    let h = c.slice(1);
    if (h.length === 3) h = h.split('').map((x) => x + x).join('');
    const n = parseInt(h.slice(0, 6), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  }
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const parts = m[1].split(/[\s,/]+/).filter(Boolean).slice(0, 3);
    return `rgba(${parts.join(', ')}, ${a})`;
  }
  return c;
}

// Canvas sizes are tracked with one shared ResizeObserver, so drawing never forces a layout read.
const sizes = new WeakMap();
const ro = typeof ResizeObserver === 'function'
  ? new ResizeObserver((entries) => {
    for (const e of entries) sizes.set(e.target, { w: e.contentRect.width, h: e.contentRect.height });
  })
  : null;

/**
 * Size a canvas's backing store for its CSS box and devicePixelRatio (re-checked every call, so moving
 * the window to another monitor stays sharp). Returns {w, h, dpr} in CSS pixels.
 */
export function fitCanvas(canvas) {
  let s = sizes.get(canvas);
  if (!s) {
    const r = canvas.getBoundingClientRect();
    s = { w: r.width, h: r.height };
    sizes.set(canvas, s);
    ro?.observe(canvas);
  }
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const w = Math.max(1, Math.round(s.w));
  const h = Math.max(1, Math.round(s.h));
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  return { w, h, dpr };
}

/** Stop tracking every canvas inside `root` (call when a tab unmounts). */
export function releaseCanvases(root) {
  for (const c of root.querySelectorAll('canvas')) { ro?.unobserve(c); sizes.delete(c); }
}
