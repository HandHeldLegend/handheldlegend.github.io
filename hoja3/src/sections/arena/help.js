/**
 * help.js — The "Controls & help" tab: input source + button mapping, options, controls, a short
 * technique guide and the "About this arena" note. Also exports sourceCard() for the Input lab.
 *
 * The Arena only reads the controller connected to the app (see input.js for how it is found).
 */
import { h } from '../../ui/dom.js';
import { button, card, field, toggle, callout, kv, segmented } from '../../ui/controls.js';
import { STICK, FRAMES, KEYS, MELEE } from './constants.js';
import { ACTIONS, STICK_AXES, sourceLabel, padName, padMode } from './input.js';
import { store } from './store.js';
import { formatTime } from './game.js';
import { t, plural } from '../../i18n/index.js';

const keyName = (code) => code.replace(/^Key/, '').replace('Period', '.');
const kbds = (codes) => [...new Set(codes.map(keyName))].flatMap((k, i) => [i ? ' / ' : null, h('kbd', k)]);
/** A translated sentence with a {keys} placeholder replaced by <kbd> elements (word order stays the translator's). */
const withKeys = (text, codes) => {
  const [before, after = ''] = text.split('{keys}');
  return h('span', before, kbds(codes), after);
};

/**
 * Card: how the connected controller is being read.
 * @param {{lab?: boolean}} o  lab: also offer the USB joystick stream (12-bit sticks, no buttons)
 */
export function sourceCard(app, o = {}) {
  const { input } = app;
  const body = h('div.stack', { style: { '--gap': '12px' } });
  const live = h('span.arena-live-source');
  const c = card({ title: t('Input source'), subtitle: t('Only {name} is read — other controllers are ignored.', { name: input.deviceName() }), icon: 'gamepad', tone: 'blue' },
    h('div.arena-source-line', h('span.muted.small', t('Reading:')), live), body);

  let lastKey = '';
  function render() {
    const key = `${input.source}|${input.matched.length}|${input.otherPads}|${input.hiResSticks}|${input.labSticksOnly}`;
    if (key === lastKey) return;
    lastKey = key;
    const nodes = [];
    const ids = input.deviceIdText();
    if (input.source === 'gamepad') {
      const gp = input.activePad();
      const name = gp ? padName(gp.id) : '—';
      nodes.push(h('p.small.muted', [
        ids ? t('The browser sees this controller as “{name}” (USB {ids}).', { name, ids }) : t('The browser sees this controller as “{name}”.', { name }),
        input.matched.length > 1 ? t('{n} identical controllers are visible; the one you used last is read.', { n: input.matched.length }) : null,
      ].filter(Boolean).join(' ')));
      nodes.push(field({
        label: t('12-bit sticks over USB'),
        tip: t('Takes stick positions straight from the controller’s USB data (12-bit, after its own deadzone processing, about 125 times a second) instead of the browser’s gamepad data. Buttons still come from the gamepad data.'),
        description: t('Full-resolution stick values from the HOJA USB stream.'),
        control: toggle({ checked: input.hiResSticks, tone: 'blue', label: t('12-bit sticks over USB'), onChange: (v) => input.setHiResSticks(v) }),
      }));
    } else {
      nodes.push(callout({
        tone: 'blue', title: t('Reading over USB.'),
        text: ids
          ? t('The browser hasn’t exposed {name} as a gamepad yet (it usually appears after a button press), so input comes straight from the controller’s USB data.', { name: input.deviceName() })
          : t('This controller is read straight from its USB data stream.'),
      }));
      if (o.lab) {
        nodes.push(field({
          label: t('USB stream'), stacked: true,
          description: t('Buttons + sticks gives every button and analog trigger, with sticks at 7 bits per direction. Sticks only gives full 12-bit stick positions but no buttons or triggers. (The Play tab always uses Buttons + sticks.)'),
          control: segmented({
            options: [{ value: false, label: t('Buttons + sticks') }, { value: true, label: t('Sticks only (12-bit)') }],
            value: input.labSticksOnly, tone: 'blue', ariaLabel: t('USB stream'), onChange: (v) => input.setLabSticksOnly(v),
          }),
        }));
      }
    }
    if (input.otherPads) {
      nodes.push(h('p.small.faint', plural(input.otherPads, '{n} other controller is connected to this computer and ignored.',
        '{n} other controllers are connected to this computer and ignored.')));
    }
    body.replaceChildren(...nodes);
  }
  render();
  input.addEventListener('change', render);
  let n = 0;
  const off = app.onFrame(() => {
    if ((n++ & 15) !== 0) return;
    const d = input.describeSource();
    if (live.textContent !== d) live.textContent = d;
  });
  c.destroy = () => { input.removeEventListener('change', render); off(); };
  return c;
}

/**
 * USB report intervals from the HOJA firmware cores (core_switch.c / core_sinput.c, USB transport):
 * Switch mode sends a report every 8000 µs, Steam (SInput) mode every 1000 µs.
 */
const SWITCH_USB_HZ = 125;
const STEAM_USB_HZ = 1000;

/**
 * Small, dismissible hint shown while the matched pad is in Switch mode: Steam mode reports faster.
 * Hidden in every other case (USB stream, Steam mode, no pad). Returns an element with .destroy().
 */
export function steamHint(app) {
  const { input } = app;
  const measured = h('span');
  const close = button({ icon: 'close', size: 'sm', variant: 'ghost', title: t('Hide this tip'),
    onClick: () => { store.set('hideSteamHint', true); render(); } });
  const el = h('div.arena-hint', { hidden: true },
    callout({ tone: 'blue', icon: 'bolt', title: t('Faster input in Steam mode.') },
      t('Steam mode sends USB reports up to {x}× as often as Switch mode ({fast} Hz vs {slow} Hz). For the most responsive testing, set Default mode to Steam on the Gamepad page.',
        { x: STEAM_USB_HZ / SWITCH_USB_HZ, fast: STEAM_USB_HZ, slow: SWITCH_USB_HZ }),
      ' ', h('a', { href: '#/gamepad' }, t('Open the Gamepad page')), ' ', measured),
    close);
  function render() {
    const gp = input.source === 'gamepad' ? input.activePad() : null;
    const show = !!gp && padMode(gp.id) === 'switch' && !store.get('hideSteamHint');
    if (el.hidden === show) el.hidden = !show;
    const r = input.lastProbeRate;
    const txt = r ? t('(Measured here: {hz} Hz.)', { hz: Math.round(r) }) : t('(Measure it with the polling probe in the Input lab.)');
    if (measured.textContent !== txt) measured.textContent = txt;
  }
  render();
  input.addEventListener('change', render);
  el.destroy = () => input.removeEventListener('change', render);
  el.refresh = render;
  return el;
}

/** Button mapping for the connected controller (layouts differ between Switch and SInput modes). */
function bindingsCard(app) {
  const { input } = app;
  const body = h('div');
  let cancelCapture = null;
  const c = card({ title: t('Button mapping'), subtitle: t('Saved per output mode in this browser — Switch and Steam modes report buttons differently.'), icon: 'sliders', tone: 'lavender' }, body);

  let lastKey = '';
  function render(force) {
    const gp = input.activePad();
    const key = input.source === 'none' ? 'none' : input.bindingKey();
    if (!force && key === lastKey) return;
    lastKey = key;
    cancelCapture?.();
    cancelCapture = null;
    if (key === 'none') {
      body.replaceChildren(h('p.muted.small', t('Waiting for input from {name}…', { name: input.deviceName() })));
      return;
    }
    const map = input.bindingsFor(key);
    const rows = [];
    const row = (label, current, onSet, onAdd, hint, kind) => {
      const value = h('span.arena-bind-val', current);
      const setBtn = button({ label: t('Set'), size: 'sm', variant: 'tonal' });
      const addBtn = onAdd && button({ label: t('Add'), icon: 'plus', size: 'sm', variant: 'ghost', title: t('Add another input for this action') });
      const start = (fn) => {
        cancelCapture?.();
        value.textContent = hint;
        value.classList.add('waiting');
        const timer = setTimeout(() => { cancelCapture?.(); render(true); }, 7000);
        const stop = input.capture(kind, (src) => { clearTimeout(timer); cancelCapture = null; fn(src); render(true); });
        cancelCapture = () => { clearTimeout(timer); stop(); };
      };
      setBtn.addEventListener('click', () => start(onSet));
      addBtn?.addEventListener('click', () => start(onAdd));
      rows.push(h('div.arena-bind-row', h('span.arena-bind-label', label), value, h('span.arena-bind-btns', setBtn, addBtn)));
    };
    if (gp) {
      for (const a of STICK_AXES) {
        const b = map[a.id];
        row(t(a.label), b.inv ? t('Axis {i} (inverted)', { i: b.i }) : t('Axis {i}', { i: b.i }), (src) => input.setBinding(key, a.id, src), null, `${t(a.hint)}…`, 'axis');
      }
    }
    for (const a of ACTIONS) {
      const list = [].concat(map[a.id] || []);
      row(t(a.label), list.map((s) => sourceLabel(s, gp?.mapping, input.sourceNames(gp))).join(' + ') || t('Unbound'),
        (src) => input.setBinding(key, a.id, [src]),
        (src) => input.setBinding(key, a.id, [...list, src]),
        a.kind === 'analog' ? t('Squeeze the trigger…') : t('Press a button…'), a.kind === 'analog' ? 'analog' : 'button');
    }
    body.replaceChildren(
      h('div.arena-bind-head',
        h('span.small.muted', gp
          ? (gp.mapping === 'standard' ? t('Gamepad layout: {name} (standard mapping)', { name: padName(gp.id) })
            : t('Gamepad layout: {name} (non-standard mapping)', { name: padName(gp.id) }))
          : t('USB stream layout (physical buttons; sticks are read directly)')),
        button({ label: t('Reset to defaults'), icon: 'refresh', size: 'sm', variant: 'ghost', onClick: () => { input.resetBindings(key); render(true); } })),
      h('div.arena-binds', rows));
  }
  render(true);
  const onChange = () => render(false);
  input.addEventListener('change', onChange);
  c.destroy = () => { cancelCapture?.(); input.removeEventListener('change', onChange); };
  return c;
}

function optionsCard(app) {
  const best = h('span', formatTime(store.get('bestTime')));
  return card({ title: t('Options'), icon: 'settings', tone: 'yellow' },
    field({ label: t('Tap jump'), description: t('Flicking the stick up jumps (a fast flick past the threshold, like a smash).'),
      control: toggle({ checked: store.get('tapJump'), tone: 'yellow', label: t('Tap jump'), onChange: (v) => { store.set('tapJump', v); app.game.tapJump = v; } }) }),
    field({ label: t('Jump buffer'), description: t('Off: like the classic games, a jump pressed while the fighter can’t act is dropped (a chip explains why). On: it is retried for {n} frames.', { n: FRAMES.JUMP_BUFFER }),
      control: toggle({ checked: !!store.get('jumpBuffer'), tone: 'yellow', label: t('Jump buffer'), onChange: (v) => { store.set('jumpBuffer', v); app.game.jumpBuffer = v; } }) }),
    field({ label: t('Show hitboxes'), description: t('Draw attack hitboxes, the collision point and ledge-grab boxes.'),
      control: toggle({ checked: store.get('showHitboxes'), tone: 'yellow', label: t('Show hitboxes'), onChange: (v) => store.set('showHitboxes', v) }) }),
    field({ label: t('Target test record'), description: t('Your best time is kept in this browser.'),
      control: [best, button({ label: t('Clear'), size: 'sm', variant: 'ghost', onClick: () => { store.set('bestTime', null); app.game.bestTime = null; best.textContent = formatTime(null); } })] }));
}

function controlsCard() {
  const rows = [
    [t('Move · walk · dash'), t('Main stick')],
    [t('Aerials · tilts (direction)'), t('C-stick')],
    [t('Attack · special'), 'A · B'],
    [t('Jump'), t('X or Y (or flick the stick up with Tap jump on)')],
    [t('Shield · airdodge'), t('Analog L / R (a lighter press = light shield), or the left bumper')],
    [t('Z (grab · L-cancel)'), t('Z / right bumper')],
    [t('Pause / resume'), withKeys(t('Start, or {keys}'), KEYS.start)],
    [t('Frame advance (paused)'), withKeys(t('D-pad right, or {keys}'), KEYS.step)],
    [t('Reset / restart run'), withKeys(t('Select / Back, or {keys}'), KEYS.select)],
  ];
  return card({ title: t('Controls'), subtitle: t('Defaults — change them under Button mapping. The keyboard only pauses, frame-advances and resets; your controller does all the playing.'), icon: 'input', tone: 'green' },
    kv(rows));
}

function techCard(app) {
  const P = app.game.fighter.P;
  const tech = [
    [t('Walk vs dash'), t('Push the stick slowly to walk (speed follows how far you push). Flick it past {threshold} within {n} frames of leaving the center to dash.', { threshold: STICK.SMASH_X, n: STICK.SMASH_WINDOW })],
    [t('Dash back / dash dance'), t('During the first {n} frames of a dash, flick the other way. The feedback counts how many frames the stick was seen in the "tilt zone" on the way — 2 or more and it reads as a slow turn instead. Stick bounce (snapback) shows up here too.', { n: FRAMES.DASH })],
    [t('Short hop vs full hop'), t('Release jump within {n} frames (≈{ms} ms) of pressing it for a short hop; hold it for a full hop.', { n: P.JUMPSQUAT, ms: Math.round(P.JUMPSQUAT * 16.7) })],
    [t('Double jump & fast fall'), t('Jump again in the air. At or after the top of a jump, flick down to fall faster — the feedback shows how many frames after the peak you were.')],
    [t('Airdodge, wavedash & waveland'), t('Press shield in the air; the stick picks the direction. Jump and airdodge diagonally into the ground on the first airborne frame to wavedash — the angle is shown (shallower = longer slide). Airdodging onto a platform from a fall is a waveland; letting go of the ledge, double jumping and airdodging onto the stage is a ledgedash.')],
    [t('L-cancel'), t('Press shield or Z within {n} frames before an aerial lands to halve the landing lag.', { n: FRAMES.LCANCEL })],
    [t('Shield & light shield'), t('Press a trigger past {threshold} to shield. A lighter press gives a bigger shield. The shield shrinks as it wears down — hold too long and it breaks.', { threshold: `${MELEE.TRIGGER_MIN}/${MELEE.TRIGGER_MAX}` })],
    [t('Shield drop'), t('Shield on a platform, then push the stick down at {min}–{max}° from straight down (a down-diagonal notch is ideal). Straight down flicks spot dodge instead.', { min: STICK.SPOTDODGE_CONE, max: STICK.SHIELD_DROP_MAX })],
    [t('Ledge'), t('Fall next to a ledge to grab it. Then: toward the stage or up to climb, jump to leap off, away or down to let go.')],
  ];
  return card({ title: t('Technique guide'), subtitle: t('What each feedback message is measuring. Frame windows shown for {fighter}.', { fighter: app.game.fighter.profile.name }), icon: 'help', tone: 'red' },
    h('dl.arena-tech', tech.flatMap(([k, v]) => [h('dt', k), h('dd', v)])));
}

function aboutCard() {
  return card({ title: t('About this arena'), icon: 'info', tone: 'lavender' },
    h('p.small', t('The Arena is a place to put your HOJA controller through its paces. It reads only the controller connected to this app — never other gamepads — so what you see is exactly what your controller sends.')),
    h('p.small', t('It is an original platform-fighter sandbox inspired by classic competitive platform fighters and the movement techniques their players love. The fighters are original characters whose movement is modelled on publicly documented attributes of classic platform-fighter characters (speeds, gravity, jumpsquat, traction), and the input handling follows the documented behaviour of the classic GameCube games. It was written from scratch for this app: the characters, stage, art and code are all our own, and it uses no game code, data files or assets of any kind.')),
    h('p.small', t('Not affiliated with or endorsed by Nintendo or HAL Laboratory.')),
    h('p.small.muted', t('Frame windows and thresholds are tuned to feel familiar and to demand a lot of a controller, so it’s a good place to try a new stick module, gate or setting — but results won’t exactly match any particular game.')));
}

export function renderHelp(panel, app) {
  const cards = [sourceCard(app), bindingsCard(app)];
  panel.append(h('div.stack', cards, optionsCard(app), controlsCard(), techCard(app), aboutCard()));
  return () => cards.forEach((c) => c.destroy?.());
}

