/**
 * lab.js — The "Input lab" tab: big stick plots with angle/magnitude readouts, analog triggers and
 * raw buttons/axes, a stick roundness (circularity / coverage) test, a polling-rate probe and a
 * snapback watch. Everything is drawn from the shared per-animation-frame input poll.
 */
import { h } from '../../ui/dom.js';
import { button, card, segmented, kv, callout, progressBar } from '../../ui/controls.js';
import { TRIGGER, MELEE } from './constants.js';
import { drawGate, drawStick, readout, stickValues, pctText, triggerLevel, announcer, describeStickSpoken, meleeAxisText, meleeTriggerText, signed } from './hud.js';
import { fitCanvas, alpha, releaseCanvases } from './theme.js';
import { angleDeg } from './controller.js';
import { CircleTrace, SnapbackWatch, describeSnap, probePollRate } from './analysis.js';
import { sourceCard, steamHint } from './help.js';
import { store } from './store.js';
import { median } from './input.js';
import { t } from '../../i18n/index.js';

const TAU = Math.PI * 2;

/** One large stick plot with its numeric readout (DOM text; the canvas is a picture). */
function stickPanel(title, colorKey, shape) {
  const canvas = h('canvas.arena-lab-stick', { 'aria-hidden': 'true' });
  const ro = readout(title, [['x', 'X', 'w-melee'], ['y', 'Y', 'w-melee'], ['angle', t('Angle')], ['mag', t('Magnitude')], ['off', t('From nearest 45°')]], { shape, showTitle: false });
  const clampNote = h('p.arena-readout-note', { hidden: true }, t('Past the 80-unit circle — the game pulls it back to 100%.'));
  const el = h('div.arena-lab-stickpanel', { 'data-shape': shape },
    h('div.arena-lab-sticktitle', h('span.arena-mark', { 'aria-hidden': 'true' }), title), canvas, ro.el, clampNote);
  const trail = [];
  return {
    el,
    /** @param {object|null} mel  Melee view: the meleeStick() result (x/y are then Melee values); null = raw */
    draw(x, y, th, mel) {
      trail.push([x, y]); if (trail.length > 40) trail.shift();
      const { w, h: hh, dpr } = fitCanvas(canvas);
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, hh);
      const R = Math.min(w, hh) / 2 / 1.18;
      drawGate(ctx, w / 2, hh / 2, R, th, { k: mel ? 1 : MELEE.STICK_MAX / MELEE.GC_STICK_FULL });
      drawStick(ctx, w / 2, hh / 2, R, x, y, trail, th[colorKey], th, shape);
      const v = stickValues(x, y, 4);
      const off = ((angleDeg(x, y) + 22.5) % 45) - 22.5;
      ro.set('x', mel ? meleeAxisText(mel.x, mel.ux) : signed(x, 4));
      ro.set('y', mel ? meleeAxisText(mel.y, mel.uy) : signed(y, 4));
      ro.set('angle', v.angle);
      ro.set('mag', v.mag);
      ro.set('off', v.m > 0.5 ? `${off >= 0 ? '+' : '−'}${Math.abs(off).toFixed(1)}°` : '—');
      const over = !mel && v.m * MELEE.GC_STICK_FULL > MELEE.STICK_MAX + 0.5;
      if (clampNote.hidden === over) clampNote.hidden = !over;
    },
  };
}

/** Horizontal analog trigger bar (DOM) with light-shield and hard-press markers, value and state as text. */
function triggerBar(label, name) {
  let markLo; let markHi;
  const fill = h('div.arena-trig-fill');
  const val = h('span.arena-trig-val', '0.0%');
  const state = h('span.arena-trig-state', triggerLevel(0));
  const el = h('div.arena-trig', { role: 'group', 'aria-label': name },
    h('span.arena-trig-label', { 'aria-hidden': 'true' }, label),
    h('div.arena-trig-track', { 'aria-hidden': 'true' }, fill,
      markLo = h('span.arena-trig-mark', { title: t('Shield starts') }),
      markHi = h('span.arena-trig-mark.hard', { title: t('Hard press') })),
    val, state);
  let view = '';
  return {
    el,
    /** v: the trigger in the current view (Melee value 0..1, or raw 0..1); mel: meleeTrigger() result. */
    set(v, mel, nextView) {
      if (nextView !== view) {
        view = nextView;
        // Melee view: the light-shield band is 43..140 of 140. Raw view: the same band in raw 0..255 terms.
        const lo = view === 'melee' ? TRIGGER.SHIELD_MIN : MELEE.TRIGGER_MIN / 255;
        const hi = view === 'melee' ? 1 : MELEE.TRIGGER_MAX / 255;
        markLo.style.left = `${lo * 100}%`; markHi.style.left = `${hi * 100}%`;
      }
      fill.style.transform = `scaleX(${Math.max(0, Math.min(1, v))})`;
      const level = mel.value >= TRIGGER.HARD ? 'hard' : mel.value >= TRIGGER.SHIELD_MIN ? 'shield' : 'low';
      if (fill.dataset.level !== level) { fill.dataset.level = level; state.textContent = triggerLevel(mel.value); }
      const text = view === 'melee' ? meleeTriggerText(mel) : pctText(v, 1);
      if (val.textContent !== text) val.textContent = text;
    },
  };
}

export function renderLab(panel, app) {
  const { input } = app;
  const cleanups = [];

  // ---- Sticks ------------------------------------------------------------------------------------
  const names = { main: t('Main stick'), c: t('C-stick') };
  const main = stickPanel(names.main, 'red', 'circle');
  const cstick = stickPanel(names.c, 'yellow', 'diamond');
  const announce = announcer();
  let view = store.get('labView') === 'raw' ? 'raw' : 'melee';
  const viewSeg = segmented({
    options: [{ value: 'melee', label: t('Melee processing') }, { value: 'raw', label: t('Raw') }],
    value: view, tone: 'red', ariaLabel: t('Stick and trigger values'),
    onChange: (v) => { view = v; store.set('labView', v); viewNote.textContent = viewText(); },
  });
  const viewText = () => (view === 'melee'
    ? t('What the game sees: GameCube values clamped to an 80-unit circle (steps of 0.0125), with the per-axis deadzone below 23 units (0.2875). Shaded cross: deadzone. Dashed lines: dash (x ±0.8) and tap jump / fast fall (y ±0.6625).')
    : t('Your controller’s raw output (1.0 = full scale). The solid dashed circle is where the game’s 80-unit clamp sits; the shaded cross and lines are the game’s thresholds in raw terms.'));
  const viewNote = h('p.small.muted', viewText());
  const sticksCard = card({ title: t('Sticks'), subtitle: t('Compare what the game reads with your controller’s raw output.'), icon: 'joystick', tone: 'red',
    actions: announce.button },
  viewSeg, viewNote, h('div.arena-lab-sticks', main.el, cstick.el), announce.region);

  // ---- Triggers & buttons -----------------------------------------------------------------------
  const trigL = triggerBar('L', t('Left trigger'));
  const trigR = triggerBar('R', t('Right trigger'));
  const btnGrid = h('div.arena-rawbtns');
  const axesList = h('div.arena-rawaxes');
  const rawHead = h('div.arena-raw-head.small.muted', t('Buttons'));
  const axesHead = h('div.arena-raw-head.small.muted', t('Axes'));
  let rawLayout = '';
  const rawCard = card({ title: t('Triggers & raw inputs'), subtitle: t('Analog triggers read 0–140 in the game: the light shield starts at {min} ({pct}%) and 140 is a full press; a digital press always counts as full. Below: every input your controller reports through the active source.', { min: MELEE.TRIGGER_MIN, pct: Math.round(TRIGGER.SHIELD_MIN * 100) }), icon: 'trigger', tone: 'blue' },
    trigL.el, trigR.el, rawHead, btnGrid, axesHead, axesList);
  let btnNodes = []; let axisNodes = [];

  // ---- Roundness test ---------------------------------------------------------------------------
  const trace = new CircleTrace();
  let traceStick = store.get('labStick') || 'main';
  const traceCanvas = h('canvas.arena-lab-trace', { role: 'img', 'aria-label': t('Traced stick outline compared to a perfect circle') });
  const traceStats = h('div');
  const roundCard = card({
    title: t('Stick roundness'), subtitle: t('Slowly roll the stick around the rim two or three times. The shape is compared with a perfect circle.'), icon: 'calibrate', tone: 'green',
    actions: button({ label: t('Reset'), icon: 'refresh', size: 'sm', variant: 'ghost', onClick: () => trace.reset() }),
  },
  segmented({ options: [{ value: 'main', label: names.main }, { value: 'c', label: names.c }], value: traceStick, tone: 'green', ariaLabel: t('Stick to test'),
    onChange: (v) => { traceStick = v; store.set('labStick', v); trace.reset(); } }),
  h('div.arena-lab-traceflex', traceCanvas, traceStats));

  // ---- Poll-rate probe ----------------------------------------------------------------------------
  const probeOut = h('div.stack', { style: { '--gap': '8px' } });
  const histo = h('canvas.arena-lab-histo', { role: 'img', 'aria-label': t('Histogram of update intervals') });
  const progress = progressBar({ message: t('Measuring…') });
  progress.hidden = true;
  const ageLine = h('span');
  const hojaLine = h('span');
  const missedLine = h('span');
  let probe = null;
  let lastProbe = null;
  const probeBtn = button({
    label: t('Measure poll rate'), icon: 'bolt', variant: 'primary', size: 'sm',
    onClick: async () => {
      if (probe) return;
      const gp = input.activePad();
      if (!gp) { probeOut.replaceChildren(callout({ tone: 'yellow', text: t('The probe measures the browser’s gamepad data, and {name} isn’t visible there yet — press a button on it. (Over USB, the report rate is shown below.)', { name: input.deviceName() }) })); return; }
      probeBtn.disabled = true;
      progress.hidden = false;
      progress.set(0, t('Keep moving the stick in circles…'));
      probe = probePollRate(gp.index, 3000, (k) => progress.set(k * 100));
      const r = await probe.done;
      probe = null;
      if (!panel.isConnected) return;
      progress.hidden = true;
      probeBtn.disabled = false;
      lastProbe = r;
      if (r.changes >= 10) { input.lastProbeRate = r.rate; hint.refresh(); }
      showProbe(r);
    },
  });
  function showProbe(r) {
    if (!r.changes || r.changes < 10) {
      probeOut.replaceChildren(callout({ tone: 'yellow', title: t('Not enough updates.'), text: t('Most browsers only report new data when something changes — keep moving the stick in circles while measuring.') }));
      return;
    }
    probeOut.replaceChildren(
      kv([
        [t('Estimated rate'), h('strong', `${Math.round(r.rate)} Hz`)],
        [t('Median interval'), `${r.median.toFixed(2)} ms`],
        [t('95th percentile'), `${r.p95.toFixed(2)} ms`],
        [t('Jitter (std. dev.)'), `${r.jitter.toFixed(2)} ms`],
        [t('Updates seen'), String(r.changes)],
      ]),
      histo);
    drawHisto(r.intervals);
  }
  function drawHisto(intervals) {
    const th = app.theme;
    const { w, h: hh, dpr } = fitCanvas(histo);
    const ctx = histo.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, hh);
    const maxMs = 20; const bins = 40;
    const counts = new Array(bins).fill(0);
    for (const d of intervals) counts[Math.min(bins - 1, Math.floor((d / maxMs) * bins))]++;
    const peak = Math.max(...counts, 1);
    const bw = (w - 20) / bins;
    ctx.fillStyle = th.blue;
    counts.forEach((c, i) => { const bh = (c / peak) * (hh - 22); ctx.fillRect(10 + i * bw + 1, hh - 16 - bh, Math.max(1, bw - 2), bh); });
    ctx.fillStyle = th.muted;
    ctx.font = `10px ${th.fontUi}`;
    ctx.textBaseline = 'bottom';
    for (const ms of [0, 4, 8, 12, 16, 20]) {
      const x = 10 + (ms / maxMs) * (w - 20);
      ctx.textAlign = ms === 0 ? 'left' : ms === 20 ? 'right' : 'center';
      ctx.fillText(`${ms} ms`, x, hh);
    }
  }
  const pollCard = card({
    title: t('Polling probe'), icon: 'bolt', tone: 'yellow',
    subtitle: t('Turns the browser’s Gamepad timestamps into an update rate. Browsers sample controllers at their own pace (Chrome ≈ 250 Hz), so the result is the lower of the two.'),
    actions: probeBtn,
  }, progress, probeOut,
  kv([[t('Data age at frame start'), ageLine], [t('HOJA USB stream'), hojaLine],
    [t('Taps between browser polls'), missedLine]]),
  h('p.small.muted', t('Taps that started and ended between two Gamepad API polls are invisible to the browser. When the HOJA USB stream is running they are still seen there, counted here, and handed to the game (with the default button mapping).')));

  // ---- Snapback watch ----------------------------------------------------------------------------
  const snapList = h('ol.arena-snaplist');
  const snapEmpty = h('p.small.muted', t('Flick the main stick to the rim and let go. If it bounces past the center to the other side, it’s listed here. (Sampled once per display frame, as a game would.)'));
  let snapCount = 0;
  const snapCount$ = h('span.badge', '0');
  const watch = new SnapbackWatch((e) => {
    snapCount++;
    snapCount$.textContent = String(snapCount);
    snapEmpty.hidden = true;
    snapList.prepend(h('li', describeSnap(e)));
    while (snapList.children.length > 8) snapList.lastElementChild.remove();
  });
  const snapCard = card({ title: t('Snapback watch'), subtitle: t('Catches stick rebound after release.'), icon: 'snapback', tone: 'lavender', actions: snapCount$ }, snapEmpty, snapList);

  const src = sourceCard(app, { lab: true });
  cleanups.push(() => src.destroy?.());
  const hint = steamHint(app);
  cleanups.push(() => hint.destroy());
  panel.append(h('div.stack', src, hint, sticksCard, rawCard, h('div.grid-2.arena-lab-pair', roundCard, snapCard), pollCard));

  // ---- Per-frame update --------------------------------------------------------------------------
  const ages = [];
  let n = 0;
  const offTick = app.onFrame((now, s) => {
    const th = app.theme;
    const sraw = s.raw; const mel = s.melee;
    if (view === 'melee') { main.draw(s.lx, s.ly, th, mel.main); cstick.draw(s.cx, s.cy, th, mel.c); }
    else { main.draw(sraw.lx, sraw.ly, th, null); cstick.draw(sraw.cx, sraw.cy, th, null); }
    trigL.set(view === 'melee' ? s.l : sraw.l, mel.l, view);
    trigR.set(view === 'melee' ? s.r : sraw.r, mel.r, view);
    announce.offer(now, () => [describeStickSpoken(names.main, s.lx, s.ly), describeStickSpoken(names.c, s.cx, s.cy)].join(' '));
    watch.update(sraw.lx, sraw.ly, now); // hardware behaviour: raw values
    const [tx, ty] = traceStick === 'main' ? [sraw.lx, sraw.ly] : [sraw.cx, sraw.cy];
    trace.add(tx, ty);
    drawTrace(traceCanvas, trace, th);

    // Raw buttons / axes of the active source (rebuilt only when the layout changes).
    const raw = input.raw;
    let buttons = []; let axes = []; let labels = null;
    if (raw.kind === 'gamepad') { buttons = raw.buttons; axes = raw.axes; }
    else if (raw.kind === 'usb-raw') { buttons = raw.inputs.map((x) => x.value / 127); labels = raw.inputs.map((_, i) => input.codeName(i)); }
    if (raw.kind === 'gamepad') { const faces = input.faceNames(input.activePad()); labels = buttons.map((_, i) => (faces[i] ? `${i} · ${faces[i]}` : String(i))); }
    const layout = `${raw.kind}|${buttons.length}|${axes.length}|${raw.id || ''}`;
    if (layout !== rawLayout) {
      rawLayout = layout;
      const note = (text) => h('span.small.muted', text);
      btnNodes = buttons.map((_, i) => h('span.arena-rawbtn', { title: raw.kind === 'gamepad' ? t('Button {i}', { i }) : labels[i] }, labels ? labels[i] : String(i)));
      btnGrid.replaceChildren(...(btnNodes.length ? btnNodes : [note(raw.kind === 'usb-sticks'
        ? t('The sticks-only USB stream carries no buttons — switch the USB stream back to Buttons + sticks.')
        : t('Waiting for input from {name}…', { name: input.deviceName() }))]));
      axisNodes = axes.map((_, i) => { const val = h('span.mono'); const bar = h('span.arena-rawaxis-fill'); return { el: h('div.arena-rawaxis', h('span.small.muted', t('Axis {i}', { i })), h('span.arena-rawaxis-track', bar), val), val, bar }; });
      axesList.replaceChildren(...(axisNodes.length ? axisNodes.map((a) => a.el) : [note(raw.kind === 'gamepad' ? t('No axes reported.')
        : t('Over USB the sticks arrive as the LX/LY/RX/RY direction inputs above (7 bits per direction), or as 12-bit values in the sticks-only stream.'))]));
      rawHead.textContent = raw.kind === 'usb-raw' ? t('Every mapper input sent over USB (value 0–127)') : raw.kind === 'gamepad' ? t('Buttons (Gamepad API)') : t('Buttons');
      axesHead.textContent = raw.kind === 'gamepad' ? t('Axes (Gamepad API)') : t('Sticks');
    }
    buttons.forEach((v, i) => {
      const node = btnNodes[i];
      const on = raw.kind === 'usb-raw' ? raw.inputs[i].pressed : v >= 0.5;
      if (node.classList.contains('on') !== on) node.classList.toggle('on', on); // .on also underlines + bars (not color alone)
      node.style.setProperty('--v', v.toFixed(2));
    });
    axes.forEach((v, i) => {
      const a = axisNodes[i];
      const txt = (v >= 0 ? ' ' : '') + v.toFixed(4);
      if (a.val.textContent !== txt) a.val.textContent = txt;
      a.bar.style.left = `${(50 + Math.max(-1, Math.min(1, v)) * 50).toFixed(2)}%`;
    });

    if (raw.kind === 'gamepad' && raw.timestamp) { ages.push(now - raw.timestamp); if (ages.length > 120) ages.shift(); }
    if ((n++ & 15) === 0) {
      const m = median(ages);
      const ageTxt = raw.kind === 'gamepad' && Number.isFinite(m) ? t('{ms} ms (median, while moving)', { ms: m.toFixed(1) }) : t('— (Gamepad API only)');
      if (ageLine.textContent !== ageTxt) ageLine.textContent = ageTxt;
      const rate = input.usbRate();
      const hr = !rate ? t('Not receiving') : input.usb.kind === 'sticks' ? t('{n} reports/s (joystick stream)', { n: Math.round(rate) })
        : t('{n} reports/s (raw stream)', { n: Math.round(rate) });
      if (hojaLine.textContent !== hr) hojaLine.textContent = hr;
      const mt = raw.kind !== 'gamepad' ? t('— (Gamepad API only)')
        : t('{n} seen over USB · {r} recovered', { n: input.missedTaps, r: input.recoveredTaps });
      if (missedLine.textContent !== mt) missedLine.textContent = mt;
      paintTraceStats();
    }
  });
  cleanups.push(offTick);

  let lastSummaryKey = '';
  function paintTraceStats() {
    const s = trace.summary();
    const key = s ? `${s.coverage.toFixed(2)}|${s.mean.toFixed(3)}|${s.min.toFixed(3)}|${s.max.toFixed(3)}|${s.corners.length}` : 'none';
    if (key === lastSummaryKey) return;
    lastSummaryKey = key;
    if (!s) { traceStats.replaceChildren(h('p.small.muted', t('Waiting for the stick to reach the rim…'))); return; }
    const ratio = s.diagonal / s.cardinal;
    traceStats.replaceChildren(kv([
      [t('Coverage'), `${Math.round(s.coverage * 100)}%`],
      [t('Average reach'), s.mean.toFixed(3)],
      [t('Min / max'), `${s.min.toFixed(3)} / ${s.max.toFixed(3)}`],
      [t('Out of round'), `${s.roundness.toFixed(1)}%`],
      [t('Diagonal vs cardinal'), Number.isFinite(ratio) ? `${(ratio * 100).toFixed(1)}%` : '—'],
      [t('Corners found'), s.corners.length ? s.corners.map((c) => `${c.angle.toFixed(0)}°`).join(' · ') : '—'],
    ]));
  }
  paintTraceStats();
  if (lastProbe) showProbe(lastProbe);

  return () => {
    probe?.cancel();
    input.setLabSticksOnly(false); // Play needs buttons
    for (const fn of cleanups) fn();
    releaseCanvases(panel);
  };
}

/** Traced outline vs ideal circle. */
function drawTrace(canvas, trace, t) {
  const { w, h: hh, dpr } = fitCanvas(canvas);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, hh);
  const cx = w / 2; const cy = hh / 2;
  const R = Math.min(w, hh) / 2 / 1.2;
  ctx.fillStyle = t.sunken;
  ctx.beginPath(); ctx.arc(cx, cy, R * 1.18, 0, TAU); ctx.fill();
  ctx.strokeStyle = alpha(t.muted, 0.3);
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(cx - R * 1.15, cy); ctx.lineTo(cx + R * 1.15, cy); ctx.moveTo(cx, cy - R * 1.15); ctx.lineTo(cx, cy + R * 1.15); ctx.stroke();
  // Ideal circle.
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = t.accent;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
  ctx.setLineDash([]);
  const pts = trace.points();
  if (pts.length > 1) {
    ctx.beginPath();
    pts.forEach((p, i) => {
      const a = (p.angle * Math.PI) / 180;
      const x = cx + Math.cos(a) * p.r * R; const y = cy - Math.sin(a) * p.r * R;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    });
    if (pts.length > 150) ctx.closePath();
    ctx.fillStyle = alpha(t.green, 0.16);
    if (pts.length > 150) ctx.fill();
    ctx.strokeStyle = t.green;
    ctx.lineWidth = 2;
    ctx.stroke();
    for (const p of pts) {
      const a = (p.angle * Math.PI) / 180;
      ctx.fillStyle = t.green;
      ctx.fillRect(cx + Math.cos(a) * p.r * R - 1, cy - Math.sin(a) * p.r * R - 1, 2, 2);
    }
  }
  const s = trace.points().length > 8 ? trace.summary() : null;
  if (s) {
    for (const c of s.corners) {
      const a = (c.angle * Math.PI) / 180;
      ctx.fillStyle = t.yellow;
      ctx.beginPath(); ctx.arc(cx + Math.cos(a) * c.r * R, cy - Math.sin(a) * c.r * R, 3.5, 0, TAU); ctx.fill();
    }
  }
}

