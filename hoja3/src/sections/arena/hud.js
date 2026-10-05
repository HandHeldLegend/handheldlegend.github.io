/**
 * hud.js — Canvas drawing helpers for the live input display (Play tab) and the Input lab.
 *
 * Stick plots show the stick inside an octagonal gate outline (corners at the 8 notch directions),
 * dashed rings at the gameplay thresholds (neutral and smash), a fading trail of recent positions and
 * the current point. Trigger bars mark the light-shield start and the hard-press point.
 *
 * Accessibility: canvases are decorative pictures. The numbers live in DOM readouts (readout()) with
 * real text, labels, tabular numerals and fixed-width cells; the main stick is drawn as a circle and the
 * C-stick as a diamond (with matching markers in the readouts) so they don't differ by color alone.
 */
import { h } from '../../ui/dom.js';
import { button } from '../../ui/controls.js';
import { t, fmt } from '../../i18n/index.js';
import { STICK, TRIGGER, MELEE } from './constants.js';
import { alpha, fitCanvas } from './theme.js';
import { angleDeg } from './controller.js';

const TAU = Math.PI * 2;

// ---------------------------------------------------------------------------------------------
// Accessible DOM readouts (the canvases are pictures; these carry the actual numbers)
// ---------------------------------------------------------------------------------------------

/** Signed fixed-width number: +0.123 / −0.123 (U+2212 so both signs take one cell). */
export const signed = (v, digits) => `${v < 0 ? '−' : '+'}${Math.abs(v).toFixed(digits)}`;
/** Percent with fixed decimals, e.g. 73.4% (decimal point kept for a stable, technical readout). */
export const pctText = (v, digits = 0) => `${(v * 100).toFixed(digits)}%`;

/** Trigger level as words (so it isn't shown by color/opacity alone). */
export function triggerLevel(v) {
  return v >= TRIGGER.HARD ? t('Full press') : v >= TRIGGER.SHIELD_MIN ? t('Shield') : t('Off');
}

/**
 * A labelled group of live values: role="group" + aria-label, real text, no aria-live.
 * @param {string} title  visible (and accessible) name
 * @param {Array<[string, string, string?]>} fields  [id, label, width class ('w-num' | 'w-wide')]
 * @param {{shape?: 'circle'|'diamond'|'bar'|'none', showTitle?: boolean}} o  marker matching the canvas shape
 *        (not color alone); showTitle: false when a visible heading is already next to it
 * @returns {{el: HTMLElement, set: (id: string, text: string) => void}}
 */
export function readout(title, fields, o = {}) {
  const cells = {};
  const el = h('div.arena-readout', { role: 'group', 'aria-label': title, 'data-shape': o.shape || 'none' },
    o.showTitle === false ? null : h('div.arena-readout-title', o.shape && o.shape !== 'none' ? h('span.arena-mark', { 'aria-hidden': 'true' }) : null, title),
    h('dl.arena-readout-grid', fields.map(([id, label, width]) => {
      cells[id] = h('dd', { class: width || 'w-num' }, '—');
      return h('div.arena-readout-cell', h('dt', label), cells[id]);
    })));
  return {
    el,
    set(id, text) { const c = cells[id]; if (c && c.textContent !== text) c.textContent = text; },
  };
}

/** One Melee axis as "+0.6250 (50 u)". */
export const meleeAxisText = (v, units) => `${signed(v, 4)} (${units < 0 ? '−' : ''}${Math.abs(units)} u)`;

/** Melee trigger as "31% (43/140)". */
export const meleeTriggerText = (m) => `${pctText(m.value)} (${m.n}/${MELEE.TRIGGER_MAX})`;

/** Stick readout values: X, Y, angle (° counter-clockwise from right), magnitude (%). */
export function stickValues(x, y, digits = 3) {
  const m = Math.hypot(x, y);
  return {
    x: signed(x, digits), y: signed(y, digits),
    angle: m > 0.05 ? `${angleDeg(x, y).toFixed(1)}°` : '—',
    mag: pctText(m, 1),
    m,
  };
}

/** Short spoken summary of a stick (rounded so it only changes when it matters). */
export function describeStickSpoken(name, x, y) {
  const m = Math.hypot(x, y);
  if (m <= 0.05) return t('{stick}: centered.', { stick: name });
  return t('{stick}: {angle}°, magnitude {mag}%.', { stick: name, angle: Math.round(angleDeg(x, y)), mag: Math.round(m * 100) });
}

/**
 * Optional "Announce position" toggle (aria-pressed) feeding a visually hidden polite live region,
 * at most once per second and only when the spoken text changes. Off by default.
 */
export function announcer(label = t('Announce position')) {
  const region = h('div.sr-only', { 'aria-live': 'polite', 'aria-atomic': 'true' });
  const btn = button({ label, size: 'sm', variant: 'ghost', title: t('Read the stick position aloud with a screen reader, about once a second') });
  btn.classList.add('arena-announce');
  btn.setAttribute('aria-label', label); // the title is a hint; keep the name short
  btn.setAttribute('aria-pressed', 'false');
  let on = false; let last = 0; let lastText = '';
  btn.addEventListener('click', () => {
    on = !on;
    btn.setAttribute('aria-pressed', String(on));
    lastText = ''; last = 0;
    if (!on) region.textContent = '';
  });
  return {
    button: btn, region,
    /** Call every frame; `make` builds the text only when an announcement is due. */
    offer(now, make) {
      if (!on || now - last < 1000) return;
      const text = make();
      if (text === lastText) return;
      last = now; lastText = text;
      region.textContent = text;
    },
  };
}

/**
 * Octagonal gate outline + axes + Melee's stick thresholds. Coordinates in CSS pixels.
 * k: where Melee's 1.0 (80 units) sits as a fraction of R — 1 when plotting what the game sees,
 * 80 / 110 when plotting raw controller output (then the 80-unit clamp circle is drawn too).
 * Overlay: the per-axis deadzone cross (|x| or |y| < 0.2875), dash lines (x = ±0.8) and the tap-jump /
 * fast-fall lines (y = ±0.6625).
 */
export function drawGate(ctx, cx, cy, R, t, { rings = true, label = '', k = 1 } = {}) {
  ctx.fillStyle = t.sunken;
  ctx.beginPath(); ctx.arc(cx, cy, R * 1.12, 0, TAU); ctx.fill();
  // Octagon with its corners at 0°, 45°, 90°… (where a notched gate's notches sit).
  const octagon = () => {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const x = cx + Math.cos(a) * R; const y = cy - Math.sin(a) * R;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.closePath();
  };
  octagon();
  ctx.fillStyle = t.surface;
  ctx.fill();
  ctx.strokeStyle = t.border;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  if (rings) {
    ctx.save();
    octagon(); ctx.clip();
    const u = R * k;
    // Deadzone cross: each axis reads 0 inside its band.
    const dz = u * STICK.NEUTRAL;
    ctx.fillStyle = alpha(t.muted, 0.14);
    ctx.fillRect(cx - dz, cy - R, dz * 2, R * 2);
    ctx.fillRect(cx - R, cy - dz, R * 2, dz * 2);
    ctx.setLineDash([3, 4]);
    ctx.lineWidth = 1;
    // Dash / smash x and tap-jump / fast-fall y lines.
    ctx.strokeStyle = alpha(t.accent, 0.7);
    ctx.beginPath();
    for (const sx of [-1, 1]) { ctx.moveTo(cx + sx * u * STICK.SMASH_X, cy - R); ctx.lineTo(cx + sx * u * STICK.SMASH_X, cy + R); }
    ctx.stroke();
    ctx.strokeStyle = alpha(t.muted, 0.6);
    ctx.beginPath();
    for (const sy of [-1, 1]) { ctx.moveTo(cx - R, cy - sy * u * STICK.SMASH_Y); ctx.lineTo(cx + R, cy - sy * u * STICK.SMASH_Y); }
    ctx.stroke();
    if (k < 1) {
      ctx.strokeStyle = alpha(t.text, 0.55);
      ctx.beginPath(); ctx.arc(cx, cy, u, 0, TAU); ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();
  }
  // Axes.
  ctx.strokeStyle = alpha(t.muted, 0.3);
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();
  if (label) {
    ctx.fillStyle = t.muted;
    ctx.font = `600 11px ${t.fontUi}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(label, cx, cy - R * 1.12 - 3);
  }
}

/** Trail + current stick point (x, y on the unit scale, +y up). shape: 'circle' (main) | 'diamond' (C-stick). */
export function drawStick(ctx, cx, cy, R, x, y, trail, color, th, shape = 'circle') {
  const lim = (v) => Math.max(-1.15, Math.min(1.15, v));
  if (trail.length > 1) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 1; i < trail.length; i++) {
      const a = trail[i - 1]; const b = trail[i];
      ctx.strokeStyle = alpha(color, (i / trail.length) * 0.55);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx + lim(a[0]) * R, cy - lim(a[1]) * R);
      ctx.lineTo(cx + lim(b[0]) * R, cy - lim(b[1]) * R);
      ctx.stroke();
    }
  }
  const px = cx + lim(x) * R; const py = cy - lim(y) * R;
  ctx.strokeStyle = alpha(color, 0.5);
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, py); ctx.stroke();
  ctx.fillStyle = color;
  const pr = Math.max(4, R * 0.09);
  ctx.beginPath();
  if (shape === 'diamond') {
    const d = pr * 1.35;
    ctx.moveTo(px, py - d); ctx.lineTo(px + d, py); ctx.lineTo(px, py + d); ctx.lineTo(px - d, py); ctx.closePath();
  } else ctx.arc(px, py, pr, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = th.surface;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

/** Vertical trigger bar with light-shield and hard-press markers. */
export function drawTrigger(ctx, x, y, w, hgt, v, color, t, label) {
  ctx.fillStyle = t.sunken;
  roundRect(ctx, x, y, w, hgt, 5); ctx.fill();
  ctx.strokeStyle = t.border; ctx.lineWidth = 1; ctx.stroke();
  const fill = Math.max(0, Math.min(1, v)) * hgt;
  if (fill > 0) {
    ctx.save();
    roundRect(ctx, x, y, w, hgt, 5); ctx.clip();
    ctx.fillStyle = v >= TRIGGER.HARD ? color : v >= TRIGGER.SHIELD_MIN ? alpha(color, 0.75) : alpha(color, 0.4);
    ctx.fillRect(x, y + hgt - fill, w, fill);
    ctx.restore();
  }
  // Light-shield band (43..140 of 140) — everything below doesn't shield.
  ctx.fillStyle = alpha(t.muted, 0.12);
  ctx.fillRect(x, y, w, hgt * (1 - TRIGGER.SHIELD_MIN));
  for (const [th, c] of [[TRIGGER.SHIELD_MIN, t.muted], [TRIGGER.HARD, t.text]]) {
    const ty = y + hgt - th * hgt;
    ctx.strokeStyle = alpha(c, 0.7);
    ctx.setLineDash([2, 2]);
    ctx.beginPath(); ctx.moveTo(x - 2, ty); ctx.lineTo(x + w + 2, ty); ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.fillStyle = t.muted;
  ctx.font = `600 11px ${t.fontUi}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(label, x + w / 2, y + hgt + 4);
  ctx.font = `500 10px ${t.fontMono}`;
  ctx.fillText(v.toFixed(2), x + w / 2, y + hgt + 17);
}

export function roundRect(ctx, x, y, w, hh, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + hh, r);
  ctx.arcTo(x + w, y + hh, x, y + hh, r);
  ctx.arcTo(x, y + hh, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Compact live input display for the Play tab: main stick, C-stick, both triggers and the action
 * buttons (canvas picture), plus a DOM readout with the actual numbers and an optional announcer.
 */
export class InputDisplay {
  constructor() {
    this.labels = { main: t('Main stick'), c: t('C-stick') };
    this.canvas = h('canvas.arena-inputs', { 'aria-hidden': 'true' });
    this.trail = [];
    this.ctrail = [];
    this.flashUntil = {}; // latched taps stay lit briefly so a 1-frame tap is visible
    this.btnNames = { attack: 'A', special: 'B', jump: t('Jump'), z: 'Z', shield: t('Shield') };
    const stickFields = [['x', 'X', 'w-melee'], ['y', 'Y', 'w-melee'], ['rx', t('X raw')], ['ry', t('Y raw')], ['angle', t('Angle')], ['mag', t('Magnitude')]];
    this.main = readout(this.labels.main, stickFields, { shape: 'circle' });
    this.cst = readout(this.labels.c, stickFields, { shape: 'diamond' });
    this.trig = readout(t('Triggers'), [['l', 'L', 'w-melee'], ['r', 'R', 'w-melee'], ['lraw', t('L raw')], ['rraw', t('R raw')],
      ['lv', t('L state'), 'w-wide'], ['rv', t('R state'), 'w-wide']], { shape: 'bar' });
    this.btns = readout(t('Buttons'), [['held', t('Held'), 'w-free']]);
    this.announce = announcer();
    this.readouts = h('div.arena-readouts', this.main.el, this.cst.el, this.trig.el, this.btns.el, this.announce.region);
  }

  /** Update the DOM readout (call once per frame; cells are only written when their text changes). */
  #readout(s, now) {
    // Melee values (what the game reads) with their units, next to the controller's raw output.
    const raw = s.raw || s; const mel = s.melee;
    for (const [r, v, mm, rx, ry] of [[this.main, stickValues(s.lx, s.ly), mel?.main, raw.lx, raw.ly], [this.cst, stickValues(s.cx, s.cy), mel?.c, raw.cx, raw.cy]]) {
      r.set('x', mm ? meleeAxisText(mm.x, mm.ux) : v.x); r.set('y', mm ? meleeAxisText(mm.y, mm.uy) : v.y);
      r.set('rx', signed(rx, 4)); r.set('ry', signed(ry, 4));
      r.set('angle', v.angle); r.set('mag', v.mag);
    }
    this.trig.set('l', mel ? meleeTriggerText(mel.l) : pctText(s.l)); this.trig.set('r', mel ? meleeTriggerText(mel.r) : pctText(s.r));
    this.trig.set('lraw', pctText(raw.l, 1)); this.trig.set('rraw', pctText(raw.r, 1));
    this.trig.set('lv', triggerLevel(s.l)); this.trig.set('rv', triggerLevel(s.r));
    const held = Object.keys(this.btnNames).filter((k) => s.btn[k]).map((k) => this.btnNames[k]);
    this.btns.set('held', held.length ? held.join(' · ') : t('None'));
    this.announce.offer(now, () => [
      describeStickSpoken(this.labels.main, s.lx, s.ly),
      describeStickSpoken(this.labels.c, s.cx, s.cy),
      t('Triggers: L {l}%, R {r}%.', { l: Math.round(s.l * 100), r: Math.round(s.r * 100) }),
      held.length ? t('Held: {buttons}.', { buttons: fmt.list(held) }) : '',
    ].filter(Boolean).join(' '));
  }

  draw(snap, th, now = performance.now()) {
    if (!this.canvas.isConnected) return;
    // Lights show what the game reads: held buttons plus any press latched since the last poll.
    for (const k of Object.keys(snap.flash || {})) this.flashUntil[k] = now + 90;
    const btn = { ...snap.btn };
    for (const k of Object.keys(this.btnNames)) btn[k] = btn[k] || now < (this.flashUntil[k] || 0);
    const s = { ...snap, btn };
    this.#readout(s, now);
    const { w, h: hh, dpr } = fitCanvas(this.canvas);
    const ctx = this.canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, hh);

    this.trail.push([s.lx, s.ly]); if (this.trail.length > 24) this.trail.shift();
    this.ctrail.push([s.cx, s.cy]); if (this.ctrail.length > 16) this.ctrail.shift();

    // Layout: [main stick][c-stick][L][R][buttons] scaled to the width.
    const pad = 10;
    // Fixed parts of the row: gaps + two trigger bars + one column of buttons (≈ 150 px).
    const R = Math.max(26, Math.min((hh - 46) / 2.3, (w - 150) / 3.76));
    const mainX = pad + R * 1.12;
    const cy = 20 + R * 1.12;
    const cR = R * 0.68;
    const cX = mainX + R * 1.12 + 14 + cR * 1.12;
    const btnX = cX + cR * 1.12 + 18 + 14 + 16 + 14 + 22;
    const cols = w - btnX > 2 * 13 * 2 + 10 + pad ? 2 : 1;
    const rowsN = cols === 2 ? 3 : 5;
    const br = Math.max(7, Math.min(13, (hh - 26 - (rowsN - 1) * 8) / (rowsN * 2)));
    // Center the whole cluster horizontally when there's spare room.
    const total = btnX + cols * br * 2 + (cols - 1) * 10 + pad;
    const ox = Math.max(0, (w - total) / 2);
    ctx.translate(ox, 0);
    drawGate(ctx, mainX, cy, R, th, { label: this.labels.main });
    drawStick(ctx, mainX, cy, R, s.lx, s.ly, this.trail, th.red, th, 'circle');
    drawGate(ctx, cX, cy, cR, th, { rings: false, label: this.labels.c });
    drawStick(ctx, cX, cy, cR, s.cx, s.cy, this.ctrail, th.yellow, th, 'diamond');

    // Readout under the main stick.
    const mag = Math.hypot(s.lx, s.ly);
    ctx.fillStyle = th.text;
    ctx.font = `500 11px ${th.fontMono}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(mag > 0.05 ? `${angleDeg(s.lx, s.ly).toFixed(1)}°  ·  ${mag.toFixed(3)}` : t('neutral · {mag}', { mag: mag.toFixed(3) }), mainX, cy + R * 1.12 + 6);

    const tw = 14; const tht = R * 2.0;
    let x = cX + cR * 1.12 + 18;
    const ty = cy - tht / 2;
    drawTrigger(ctx, x, ty, tw, tht, s.l, th.blue, th, 'L');
    x += tw + 16;
    drawTrigger(ctx, x, ty, tw, tht, s.r, th.blue, th, 'R');
    x += tw + 22;

    // Button lights (what the game reads, after your bindings). Pressed = filled with a thick ring;
    // released = hollow with a dashed ring, so the state doesn't depend on color.
    const btns = [['A', 'attack', th.red], ['B', 'special', th.yellow], [this.btnNames.jump, 'jump', th.green], ['Z', 'z', th.accent], [t('Sh'), 'shield', th.blue]];
    btns.forEach(([lbl, key, c], i) => {
      const col = cols === 2 ? i % 2 : 0;
      const row = cols === 2 ? Math.floor(i / 2) : i;
      const bx = x + br + col * (br * 2 + 10);
      const by = 22 + br + row * (br * 2 + 8);
      if (bx + br + ox > w || by + br > hh) return;
      const on = s.btn[key];
      ctx.fillStyle = on ? c : th.sunken;
      ctx.beginPath(); ctx.arc(bx, by, br, 0, TAU); ctx.fill();
      if (!on) ctx.setLineDash([2.5, 2.5]);
      ctx.strokeStyle = on ? th.text : th.border; ctx.lineWidth = on ? 2.5 : 1.5; ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = on ? th.onAccent : th.muted;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      // Shrink long (translated) labels to fit inside the light.
      let size = lbl.length > 2 ? Math.min(9, br * 0.62) : Math.min(11, br * 0.9);
      ctx.font = `700 ${size.toFixed(1)}px ${th.fontUi}`;
      const maxW = br * 1.8;
      const wText = ctx.measureText(lbl).width;
      if (wText > maxW) { size = Math.max(5.5, (size * maxW) / wText); ctx.font = `700 ${size.toFixed(1)}px ${th.fontUi}`; }
      ctx.fillText(lbl, bx, by + 0.5);
    });
  }
}
