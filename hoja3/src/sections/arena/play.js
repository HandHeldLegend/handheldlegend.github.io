/**
 * play.js — The "Play" tab: the arena canvas, toolbar (mode, pause, frame-step, speed, reset),
 * per-action feedback chips, live input display and session stats.
 *
 * Timing: the shared loop in view.js polls input once per animation frame and calls tick(now, snap).
 * Here a fixed-timestep accumulator advances the simulation in exact 1/60 s steps (scaled by the
 * speed setting); rendering interpolates between the last two sim frames.
 */
import { h } from '../../ui/dom.js';
import { button, segmented, select, card } from '../../ui/controls.js';
import { STEP_MS, MAX_STEPS_PER_RAF, SPEEDS, FIGHTERS } from './constants.js';
import { Renderer } from './render.js';
import { releaseCanvases } from './theme.js';
import { InputDisplay } from './hud.js';
import { formatTime } from './game.js';
import { store } from './store.js';
import { steamHint } from './help.js';
import { t } from '../../i18n/index.js';

export function renderPlay(panel, app) {
  const { input, game } = app;
  const timers = new Set();
  const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); };

  // ---- Toolbar ---------------------------------------------------------------------------------
  const modeSeg = segmented({
    options: [{ value: 'free', label: t('Free play') }, { value: 'targets', label: t('Target test') }],
    value: game.mode, tone: 'red', ariaLabel: t('Arena mode'),
    onChange: (v) => { store.set('mode', v); app.setParams({ mode: v }); game.setMode(v); refocus(); },
  });
  const pauseBtn = button({ label: t('Pause'), icon: 'stop', variant: 'tonal', size: 'sm', onClick: () => { app.setPaused(!app.paused); refocus(); } });
  const stepBtn = button({ label: t('Frame'), icon: 'chevron-right', variant: 'ghost', size: 'sm', title: t('Advance one frame (while paused)'), onClick: () => { stepOnce(); refocus(); } });
  const speedSel = select({
    options: SPEEDS.map((s) => ({ value: s, label: t('Speed {n}×', { n: s === 1 ? '1' : s === 0.5 ? '½' : '¼' }) })),
    value: store.get('speed') ?? 1, ariaLabel: t('Simulation speed'),
    onChange: (v) => { store.set('speed', v); refocus(); },
  });
  speedSel.classList.add('arena-speed');
  const resetBtn = button({ label: t('Reset'), icon: 'refresh', variant: 'ghost', size: 'sm', title: t('Reset position / restart run (R or Select)'), onClick: () => { game.resetRun(); refocus(); } });
  const toolbar = h('div.arena-toolbar', modeSeg, h('div.spacer'), h('div.arena-tools', pauseBtn, stepBtn, speedSel, resetBtn));

  // ---- Fighter picker (radio group; arrow keys move the selection) ---------------------------------
  const fighterBtns = FIGHTERS.map((f) => h('button.arena-fighter', {
    type: 'button', role: 'radio', 'data-id': f.id, tabindex: '-1',
    style: { '--f-body': `var(--${f.look.body})`, '--f-band': `var(--${f.look.band})` },
    onclick: () => chooseFighter(f.id, true),
  }, h('span.arena-fighter-dot', { 'aria-hidden': 'true' }), h('span.arena-fighter-name', f.name), h('span.arena-fighter-feel', t(f.feel))));
  const picker = h('div.arena-fighters', {
    role: 'radiogroup', 'aria-label': t('Fighter'),
    onkeydown: (e) => {
      const i = FIGHTERS.findIndex((f) => f.id === game.fighter.profile.id);
      const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!d) return;
      e.preventDefault();
      const next = FIGHTERS[(i + d + FIGHTERS.length) % FIGHTERS.length];
      chooseFighter(next.id, false);
      fighterBtns.find((b) => b.dataset.id === next.id)?.focus();
    },
  }, fighterBtns);
  function syncPicker() {
    for (const b of fighterBtns) {
      const on = b.dataset.id === game.fighter.profile.id;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    }
  }
  function chooseFighter(id, focusStage) {
    if (id !== game.fighter.profile.id) {
      game.setFighter(id);
      store.set('fighter', id);
      app.setParams({ fighter: id });
    }
    syncPicker();
    if (focusStage) refocus();
  }
  syncPicker();

  // ---- Stage -----------------------------------------------------------------------------------
  const canvas = h('canvas.arena-canvas', { 'aria-label': t('Arena: a small round fighter on a stage with platforms and targets') });
  const sourceChip = h('span.arena-chip', h('span.arena-chip-dot'), h('span.arena-chip-text', t('No input yet')));
  const stat = h('div.arena-hud-right');
  const feed = h('div.arena-feed', { 'aria-live': 'polite' });
  const overlay = h('div.arena-overlay', { hidden: true });
  const banner = h('div.arena-banner', { hidden: true });
  const stage = h('div.arena-stage', { tabindex: '0', onpointerdown: () => stage.focus({ preventScroll: true }) },
    canvas, h('div.arena-hud-top', sourceChip, stat), feed, overlay, banner);
  const refocus = () => stage.focus({ preventScroll: true });

  // ---- Below the stage -------------------------------------------------------------------------
  const display = new InputDisplay();
  const statsBody = h('div.arena-stats');
  const statsCard = card({ title: t('Session stats'), subtitle: t('How consistent your inputs are this session.'), icon: 'sparkle', tone: 'green',
    actions: button({ label: t('Clear'), variant: 'ghost', size: 'sm', onClick: () => { game.resetStats(); paintStats(true); } }) }, statsBody);
  const inputCard = card({ title: t('Live input'), subtitle: t('Exactly what the arena reads each frame.'), icon: 'joystick', tone: 'red',
    actions: display.announce.button }, display.canvas, display.readouts);

  const hint = steamHint(app);
  panel.append(h('div.arena-play', toolbar, picker, stage, hint, h('div.grid-2', inputCard, statsCard)));

  const renderer = new Renderer(canvas);
  const offTheme = app.onTheme((th) => renderer.setTheme(th));

  // ---- Feedback chips ----------------------------------------------------------------------------
  const offFeed = app.onFeedback(({ text, tone }) => {
    const chip = h('div.arena-feed-chip', { class: `tone-${tone}` }, text);
    feed.prepend(chip);
    while (feed.children.length > 4) feed.lastElementChild.remove();
    later(() => chip.classList.add('leaving'), 2600);
    later(() => chip.remove(), 2900);
    statsDirty = true;
  });

  // ---- Stats -------------------------------------------------------------------------------------
  let statsDirty = true;
  const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—');
  const rows = {};
  function paintStats(force) {
    if (!statsDirty && !force) return;
    statsDirty = false;
    const s = game.stats;
    const data = [
      ['wd', t('Wavedashes'), `${s.wavedash.n}`, s.wavedash.n
        ? t('{pct} frame-perfect · avg {angle}°', { pct: pct(s.wavedash.perfect, s.wavedash.n), angle: (s.wavedash.angleSum / s.wavedash.n).toFixed(1) })
        : t('Jump, then airdodge diagonally down')],
      ['lc', t('L-cancels'), `${s.lcancel.ok}/${s.lcancel.n}`, s.lcancel.n ? t('{pct} success', { pct: pct(s.lcancel.ok, s.lcancel.n) }) : t('Press shield/Z just before an aerial lands')],
      ['sh', t('Short hops'), `${s.hops.short}/${s.hops.n}`, s.hops.n ? t('{pct} of jumps', { pct: pct(s.hops.short, s.hops.n) }) : t('Tap jump and let go quickly')],
      ['db', t('Dash backs'), `${s.dashback.ok}/${s.dashback.n}`, s.dashback.n ? t('{pct} frame-perfect', { pct: pct(s.dashback.perfect, s.dashback.n) }) : t('Dash, then flick the other way')],
      ['ff', t('Fast falls'), `${s.fastfall.n}`, s.fastfall.n ? t('{pct} frame-perfect', { pct: pct(s.fastfall.perfect, s.fastfall.n) }) : t('Flick down at the top of a jump')],
      ['sd', t('Shield drops'), `${s.shieldDrop.ok}/${s.shieldDrop.n}`, s.shieldDrop.n ? pct(s.shieldDrop.ok, s.shieldDrop.n) : t('Shield on a platform, then down-diagonal')],
      ['misc', t('Ledge grabs · targets · KOs'), `${s.ledge} · ${s.targets} · ${s.ko}`, ''],
      ['snap', t('Snapbacks seen'), `${s.snapback}`, s.snapback ? t('Stick bounced past center after release (see Input lab)') : t('None so far')],
    ];
    for (const [id, label, val, sub] of data) {
      if (!rows[id]) {
        rows[id] = { val: h('span.arena-stat-val'), sub: h('span.arena-stat-sub') };
        statsBody.append(h('div.arena-stat', h('span.arena-stat-label', label), rows[id].val, rows[id].sub));
      }
      if (rows[id].val.textContent !== val) rows[id].val.textContent = val;
      if (rows[id].sub.textContent !== sub) rows[id].sub.textContent = sub;
    }
  }
  paintStats(true);

  // ---- HUD text ----------------------------------------------------------------------------------
  let lastHud = '';
  function paintHud() {
    let text;
    if (game.mode === 'targets') {
      const time = formatTime(game.elapsedMs());
      text = game.bestTime != null
        ? t('{time} · {n} left · Best {best}', { time, n: game.targetsLeft, best: formatTime(game.bestTime) })
        : t('{time} · {n} left · No record yet', { time, n: game.targetsLeft });
    } else {
      text = t('Targets {left}/{total}', { left: game.targetsLeft, total: game.targets.length });
    }
    if (app.paused) text = t('Paused · {status}', { status: text });
    if (text !== lastHud) { stat.textContent = text; lastHud = text; }
    if (modeSeg.value !== game.mode) modeSeg.value = game.mode; // deep link changed the mode
    if (picker.dataset.current !== game.fighter.profile.id) { picker.dataset.current = game.fighter.profile.id; syncPicker(); }

    const src = input.describeSource();
    const chipText = sourceChip.lastElementChild;
    if (chipText.textContent !== src) chipText.textContent = src;
    if (sourceChip.dataset.source !== input.source) sourceChip.dataset.source = input.source;

    const waiting = input.source === 'none';

    // Overlay: prompt for input until something arrives; target-test results.
    let ov = '';
    if (!input.lastInputAt) ov = waiting ? 'prompt-wait' : 'prompt';
    else if (game.timer.state === 'done') ov = 'done';
    if (overlay.dataset.kind !== ov || ov === 'done') setOverlay(ov);
    // Banner: paused / ready hints.
    const bn = app.paused ? t('Paused · Start / P resumes · D-pad → / . steps one frame')
      : game.timer.state === 'ready' ? t('Target test — the clock starts when you move') : '';
    if (banner.textContent !== bn) { banner.textContent = bn; banner.hidden = !bn; }
    if (pauseBtn.dataset.paused !== String(app.paused)) {
      pauseBtn.dataset.paused = String(app.paused);
      pauseBtn.setLabel(app.paused ? t('Resume') : t('Pause'));
      const use = pauseBtn.querySelector('use');
      use?.setAttribute('href', use.getAttribute('href').replace(/#i-.*$/, app.paused ? '#i-play' : '#i-stop'));
      stepBtn.disabled = !app.paused;
    }
  }

  let lastDoneText = '';
  function setOverlay(kind) {
    overlay.dataset.kind = kind;
    if (!kind) { overlay.hidden = true; overlay.replaceChildren(); return; }
    overlay.hidden = false;
    if (kind.startsWith('prompt')) {
      const name = input.deviceName();
      overlay.replaceChildren(h('div.arena-overlay-card',
        h('div.arena-overlay-title', kind === 'prompt-wait' ? t('Waiting for input from {name}…', { name }) : t('Press any button on {name}', { name })),
        h('p.muted.small', t('The Arena reads only the controller connected to this app — through the browser’s gamepad support when it can see it, otherwise straight over USB.'))));
      return;
    }
    const best = game.bestTime;
    const txt = `${formatTime(game.elapsedMs())}|${best}`;
    if (txt === lastDoneText) return;
    lastDoneText = txt;
    overlay.replaceChildren(h('div.arena-overlay-card',
      h('div.arena-overlay-title', t('Cleared in {time}', { time: formatTime(game.elapsedMs()) })),
      h('p.muted.small', best != null && Math.abs(best - game.elapsedMs()) < 1 ? t('New personal best!') : t('Best: {time}', { time: formatTime(best) })),
      button({ label: t('Try again'), icon: 'refresh', variant: 'primary', size: 'sm', onClick: () => { game.resetRun(); lastDoneText = ''; refocus(); } })));
  }

  // ---- Loop --------------------------------------------------------------------------------------
  let acc = 0;
  let last = 0;
  let lastSnap = input.state;
  let n = 0;

  /** One simulation frame with every press latched since the previous one (no tap is lost). */
  function simStep(snap) {
    const presses = input.takePresses();
    game.step(presses ? { ...snap, presses } : snap);
  }

  function stepOnce(snap = lastSnap) {
    if (!app.paused) return;
    simStep(snap);
    acc = 0;
  }

  let wasPaused = app.paused;
  function tick(now, snap) {
    lastSnap = snap;
    if (snap.edges.start) app.setPaused(!app.paused);
    // Presses made while paused (and not used by a frame step) shouldn't fire on resume.
    if (wasPaused && !app.paused) input.clearPresses();
    wasPaused = app.paused;
    if (snap.edges.select) game.resetRun();
    if (snap.edges.step && app.paused) stepOnce(snap);

    const dt = last ? Math.min(100, now - last) : 0;
    last = now;
    if (!app.paused) {
      acc += dt * (store.get('speed') ?? 1);
      let steps = 0;
      while (acc >= STEP_MS && steps < MAX_STEPS_PER_RAF) { simStep(snap); acc -= STEP_MS; steps++; }
      if (steps === MAX_STEPS_PER_RAF) acc = 0;
    }
    renderer.draw(game, app.paused ? 1 : acc / STEP_MS, { showHitboxes: store.get('showHitboxes'), stick: { x: snap.lx, y: snap.ly } });
    display.draw(snap, app.theme, now);
    if ((n++ & 7) === 0) { paintHud(); paintStats(); }
  }

  input.captureKeys = true;
  input.clearPresses(); // presses made on another tab
  const offTick = app.onFrame(tick);
  paintHud();
  later(refocus, 0);

  return () => {
    hint.destroy();
    offTick();
    offTheme();
    offFeed();
    for (const id of timers) clearTimeout(id);
    timers.clear();
    input.captureKeys = false;
    releaseCanvases(panel);
  };
}
