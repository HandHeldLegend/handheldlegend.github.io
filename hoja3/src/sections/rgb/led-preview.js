/**
 * led-preview.js — A small animated approximation of the selected RGB effect, one "LED" per
 * group. It mimics the firmware animations (src/devices/animations/anm_*.c) closely enough to
 * show what each mode does; it is not a pixel-exact simulation.
 *
 *   const pv = ledPreview({ names: ['D-Pad', 'Face'], playerGroup: 1, getState });
 *   pv.refresh();     // redraw now after a setting changed
 *   pv.destroy();     // stop the animation loop
 *
 * getState() → { mode, speed (ms), brightness (0–100), colors: string[] '#rrggbb' (all 32 slots) }
 *
 * With prefers-reduced-motion the loop is not started; a representative still frame is drawn
 * instead and redrawn on refresh().
 */
import { h } from '../../ui/dom.js';
import { t } from '../../i18n/index.js';
import { FAIRY_COLORS } from './settings.js';

// Firmware colors for Authentic mode (anm_authentic_palettes.c): Switch/SNES ABXY + light gray.
// The player group (rgb_player_group) is never animated: the firmware always shows its static color.
const AUTH = { A: '#ff0000', B: '#f5d400', X: '#0032ff', Y: '#00ff00' };
const AUTH_FALLBACK = '#f0f0f0';

const hexToRgb = (hex) => {
  const n = parseInt(String(hex).slice(1), 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const hsv = (h) => {
  const f = (n) => { const k = (n + h / 60) % 6; return Math.round(255 * (1 - Math.max(0, Math.min(k, 4 - k, 1)))); };
  return [f(5), f(3), f(1)];
};

/**
 * @param {{names: string[], playerGroup: number, getState: () => {mode:number, speed:number, brightness:number, colors:string[]}}} o
 */
export function ledPreview(o) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const n = o.names.length;
  const leds = o.names.map((name, i) => {
    const dot = h('span.rgb-led-dot');
    const el = h('div.rgb-led', { class: i === o.playerGroup ? 'is-player' : null, title: name },
      dot, h('span.rgb-led-name', name));
    return { el, dot };
  });
  const el = h('div.rgb-preview', { role: 'img', 'aria-label': t('Preview of the selected lighting effect') }, leds.map((l) => l.el));

  // Per-LED animation state for React and Fairy.
  const react = leds.map(() => ({ hit: -1e9, next: Math.random() * 1500 }));
  const fairy = leds.map(() => ({ from: rnd(), to: rnd(), start: 0 }));
  function rnd() { return Math.floor(Math.random() * FAIRY_COLORS); }

  let raf = 0;
  let t0 = performance.now();
  let lastMode = -1;

  /** Color of LED i at time t (ms) as [r,g,b,on?] — `on` (0–1, default 1) dims a single LED; global brightness is applied in CSS. */
  function colorAt(i, t, s, still) {
    const user = (k) => hexToRgb(s.colors[k] || '#000000');
    const speed = Math.max(300, s.speed || 1000);
    if (i === o.playerGroup) return user(i); // Player LED: its own static color in every mode
    switch (s.mode) {
      case 0: { // Authentic: classic face colors by group name
        const key = o.names[i].trim().toUpperCase();
        return hexToRgb(AUTH[key] || AUTH_FALLBACK);
      }
      case 2: { // Rainbow: every LED shares one hue that steps through 8 colors, one per animation time.
        // The still frame spreads the hues across the LEDs instead so it still reads as "rainbow".
        const hue = still ? (i * 360) / Math.max(n, 1) : (t / (speed * 8)) * 360;
        return hsv(hue % 360);
      }
      case 3: { // React: simulated presses flash on, then fade over the animation time
        if (still) return user(i);
        const r = react[i];
        if (t >= r.next) { r.hit = t; r.next = t + 600 + Math.random() * 2600; }
        const k = Math.max(0, 1 - (t - r.hit) / speed);
        return [...user(i), k]; // 4th value = how lit this LED is (fades to the unlit look)
      }
      case 4: { // Fairy: blend between random picks of the first six colors
        const f = fairy[i];
        if (still) return user(i % FAIRY_COLORS);
        let k = (t - f.start) / speed;
        if (k >= 1) { f.from = f.to; f.to = rnd(); f.start = t; k = 0; }
        return mix(user(f.from), user(f.to), k);
      }
      default: // Static (1) and anything unknown
        return user(i);
    }
  }

  function draw(t, still) {
    const s = o.getState();
    if (s.mode !== lastMode) { lastMode = s.mode; fairy.forEach((f) => { f.start = t; }); }
    // Perceived level: real LEDs are still clearly lit at low settings, so lift everything above 0.
    const b = Math.max(0, Math.min(1, s.brightness / 100));
    const lvl = b === 0 ? 0 : 0.3 + 0.7 * b;
    el.style.setProperty('--lvl', lvl.toFixed(3));
    leds.forEach((l, i) => {
      const [r, g, b, on = 1] = colorAt(i, t, s, still);
      l.dot.style.setProperty('--led', `rgb(${r} ${g} ${b})`);
      l.dot.style.setProperty('--on', on.toFixed(3));
    });
  }

  function loop(now) {
    draw(now - t0, false);
    raf = requestAnimationFrame(loop);
  }
  function start() {
    cancelAnimationFrame(raf);
    if (reduce.matches) { draw(0, true); return; }
    t0 = performance.now();
    draw(0, false); // paint immediately; rAF doesn't run in hidden tabs
    raf = requestAnimationFrame(loop);
  }
  const onMotionPref = () => start();
  reduce.addEventListener?.('change', onMotionPref);
  start();

  // Redraw now (the loop would catch up on its next frame, but it is paused in hidden tabs).
  el.refresh = () => draw(reduce.matches ? 0 : performance.now() - t0, reduce.matches);
  el.destroy = () => { cancelAnimationFrame(raf); reduce.removeEventListener?.('change', onMotionPref); };
  return el;
}
