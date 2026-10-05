/**
 * Arena — a gameplay testing sandbox: try your controller in an original, platform-fighter-inspired
 * arena, with frame-accurate feedback on the techniques that stress a controller, plus an input lab.
 *
 * It tests OUR controllers only: it needs a HOJA controller connected to the app and reads nothing
 * else (see input.js — Gamepad API pad matched by USB vendor/product, or the HOJA USB stream).
 * While disconnected a connect prompt is shown (and the page re-renders on session state changes).
 *
 * Module map:
 *   constants.js   every tunable number (thresholds, frame windows, physics)
 *   input.js       matched Gamepad API pad / HOJA USB stream → one snapshot per animation frame
 *   controller.js  per-60 Hz-frame input state: edges, smash detection, tilt-zone frame counts
 *   fighter.js     the fighter's state machine; game.js the simulation; stage.js / moves.js data
 *   render.js      canvas drawing; hud.js input display; analysis.js lab measurements
 *   play.js / lab.js / help.js   the three tabs; theme.js CSS-token colors; store.js prefs
 *
 * Deep links: #/arena?mode=targets (or free) opens Play in that mode; ?tab=lab|help opens a tab;
 * ?fighter=<id> picks a fighter (constants.js FIGHTERS).
 */
import { h, loadStyles } from '../../ui/dom.js';
import { tabView, emptyState, button } from '../../ui/controls.js';
import { connectController } from '../../app/shell.js';
import { startDemo } from '../../device/mock.js';
import { InputManager } from './input.js';
import { Game } from './game.js';
import { store } from './store.js';
import { FIGHTERS } from './constants.js';
import { readTheme, watchTheme } from './theme.js';
import { renderPlay } from './play.js';
import { renderLab } from './lab.js';
import { renderHelp } from './help.js';
import { t } from '../../i18n/index.js';
import { toast } from '../../ui/overlay.js';

const TABS = ['play', 'lab', 'help'];

function resolveParams(params = {}) {
  const out = {};
  if (params.mode === 'free' || params.mode === 'targets') { out.mode = params.mode; out.tab = 'play'; }
  if (params.mode === 'lab') out.tab = 'lab';
  if (params.mode === 'help' || params.mode === 'controls') out.tab = 'help';
  if (TABS.includes(params.tab)) out.tab = params.tab;
  if (FIGHTERS.some((f) => f.id === params.fighter)) out.fighter = params.fighter;
  return out;
}

export function mount(root, ctx) {
  loadStyles(new URL('./arena.css', import.meta.url));
  let inner = null;
  let shownConnected = null;
  const render = () => {
    const connected = !!ctx.session.connected;
    if (connected === shownConnected) return;
    shownConnected = connected;
    inner?.destroy();
    root.replaceChildren();
    inner = connected ? mountArena(root, ctx) : mountConnectPrompt(root);
  };
  render();
  const offState = ctx.session.on('state', render);
  return {
    update(params) { inner?.update?.(params); },
    destroy() { offState(); inner?.destroy(); inner = null; },
  };
}

function mountConnectPrompt(root) {
  root.append(emptyState({
    icon: 'usb', tone: 'red', title: t('Connect your controller to use the Arena'),
    text: t('The Arena tests the HOJA controller connected to this app — it doesn’t read any other gamepad. Plug it in with a USB data cable, then press Connect.'),
    action: h('div.row', { style: { justifyContent: 'center' } },
      button({ label: t('Connect controller'), icon: 'usb', variant: 'primary', size: 'lg', disabled: !navigator.usb, onClick: connectController }),
      button({ label: t('Try the demo'), icon: 'play', variant: 'ghost', onClick: () => startDemo() })),
  }));
  return { destroy() {} };
}

function mountArena(root, ctx) {
  const input = new InputManager({ device: ctx.device, session: ctx.session });
  if (input.bindingsReset) {
    toast(t('Arena button mapping was reset: A and B now follow the labels printed on your controller.'), { tone: 'blue', timeout: 6000 });
  }
  const frameFns = new Set();
  const themeFns = new Set();
  const feedFns = new Set();
  const initial = resolveParams(ctx.params);

  const game = new Game({
    mode: initial.mode || store.get('mode') || 'free',
    fighter: initial.fighter || store.get('fighter'),
    tapJump: store.get('tapJump'),
    jumpBuffer: store.get('jumpBuffer'),
    bestTime: store.get('bestTime'),
    onFeedback: (e) => { for (const fn of feedFns) fn(e); },
    onRecord: (ms) => store.set('bestTime', ms),
  });
  if (initial.mode) store.set('mode', initial.mode);
  if (initial.fighter) store.set('fighter', initial.fighter);

  /** Shared context handed to every tab. */
  const app = {
    input, game,
    session: ctx.session, device: ctx.device,
    theme: readTheme(),
    paused: false,
    setParams: (p) => ctx.setParams?.(p),
    setPaused(v) { app.paused = !!v; },
    onFrame(fn) { frameFns.add(fn); return () => frameFns.delete(fn); },
    onTheme(fn) { themeFns.add(fn); return () => themeFns.delete(fn); },
    onFeedback(fn) { feedFns.add(fn); return () => feedFns.delete(fn); },
  };
  const offTheme = watchTheme((th) => { app.theme = th; for (const fn of themeFns) fn(th); });

  const tabs = tabView({
    tone: 'red',
    value: initial.tab || store.get('tab') || 'play',
    tabs: [
      { id: 'play', label: t('Play'), icon: 'arena', render: (p) => renderPlay(p, app) },
      { id: 'lab', label: t('Input lab'), icon: 'joystick', render: (p) => renderLab(p, app) },
      { id: 'help', label: t('Controls & help'), icon: 'help', render: (p) => renderHelp(p, app) },
    ],
    onChange: (id) => { store.set('tab', id); ctx.setParams?.({ tab: id }); },
  });
  root.append(tabs);

  // One animation-frame loop for the whole page: poll input once, then let the visible tab work.
  let raf = 0;
  let errors = 0;
  const loop = (now) => {
    raf = requestAnimationFrame(loop);
    const snap = input.poll(now);
    for (const fn of frameFns) {
      try { fn(now, snap); } catch (err) { if (errors++ < 5) console.error('[arena]', err); }
    }
  };
  raf = requestAnimationFrame(loop);

  // Pause the game when the page is hidden (the browser also stops animation frames).
  const onVisibility = () => { if (document.hidden) app.setPaused(true); };
  document.addEventListener('visibilitychange', onVisibility);

  return {
    update(params) {
      const p = resolveParams(params);
      if (p.mode && p.mode !== game.mode) { game.setMode(p.mode); store.set('mode', p.mode); }
      if (p.fighter && p.fighter !== game.fighter.profile.id) { game.setFighter(p.fighter); store.set('fighter', p.fighter); }
      if (p.tab && p.tab !== tabs.value) tabs.select(p.tab);
    },
    destroy() {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibility);
      tabs.destroy();
      offTheme();
      frameFns.clear();
      themeFns.clear();
      feedFns.clear();
      input.destroy().catch(() => {}); // also puts the controller back on its default input stream
    },
  };
}
