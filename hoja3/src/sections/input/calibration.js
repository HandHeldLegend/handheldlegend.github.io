/**
 * calibration.js — Analog ("hover" / hall-effect) input calibration for the Input section.
 *
 * Protocol (config block `hover`, hoverConfig_s; command encoding in mapping.js HOVER_CMD):
 *   start  → firmware sets hover_calibration_set = 0, resets min/max of the channel(s) and then
 *            widens them while the user presses each input through its full travel;
 *   stop   → firmware sets hover_calibration_set = 1 and reloads the scalers (hover_init()).
 * Both only change RAM. We then re-read the block, mark it unsaved (so Save lights up — the user must
 * Save to keep the calibration) and refresh the app's "needs attention" badge.
 */
import { h } from '../../ui/dom.js';
import { card, button, badge, callout } from '../../ui/controls.js';
import { toast } from '../../ui/overlay.js';
import { t, fmt } from '../../i18n/index.js';
import { HOVER_CMD } from './mapping.js';
import { glyph, meter, rich } from './parts.js';

/**
 * Calibration state shared by the calibration tab and the per-input editor.
 * `active` is null, 'all', or the input code being calibrated.
 * @returns {{active: null|'all'|number, start: (target:'all'|number)=>Promise<boolean>,
 *            stop: ()=>Promise<boolean>, on: (fn:Function)=>Function}}
 */
export function createCalibration(session) {
  const listeners = new Set();
  const emit = () => { for (const fn of listeners) fn(api.active); };

  const api = {
    active: null,
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    async start(target) {
      if (api.active != null) await api.stop({ quiet: true });
      await session.flush();
      const { status } = await session.command('hover', target === 'all' ? HOVER_CMD.startAll : HOVER_CMD.start(target));
      if (!status) {
        toast(t('The controller did not start calibrating. Try again.'), { tone: 'red' });
        return false;
      }
      api.active = target;
      emit();
      return true;
    },

    async stop({ quiet = false } = {}) {
      if (api.active == null) return true;
      api.active = null;
      emit();
      const { status } = await session.command('hover', HOVER_CMD.stop);
      try {
        await session.refresh('hover');
        session.commit('hover'); // re-send what we just read: harmless, and lights up Save
      } catch (err) {
        console.warn('[input] could not re-read hover calibration', err);
      }
      session.refreshAttention();
      emit();
      if (!quiet) {
        toast(status ? t('Calibration finished — press Save to keep it.') : t('The controller did not confirm the calibration.'),
          { tone: status ? 'green' : 'red' });
      }
      return status;
    },
  };
  return api;
}

/**
 * Render the "Analog calibration" tab.
 * @param {HTMLElement} panel
 * @param {{session: object, calib: ReturnType<typeof createCalibration>, hoverInputs: Array<{code:number,name:string,label:string}>,
 *          live: Set<Function>}} deps  `live` receives raw input reports (registered while mounted)
 * @returns {Function} cleanup
 */
export function renderCalibrationTab(panel, { session, calib, hoverInputs, live }) {
  const status = h('span');
  const mainBtn = button({ variant: 'primary', size: 'lg', icon: 'calibrate', label: t('Start calibration') });
  const activeNote = callout({ tone: 'blue', icon: 'calibrate', title: t('Calibrating.'),
    text: t('Fully press and release every analog input 3–4 times, then press Finish.') });

  const rows = hoverInputs.map((input) => {
    const m = meter({ label: t('{input} live value', { input: input.label }) });
    const range = h('span.faint.xs.inp-range');
    const btn = button({ size: 'sm', variant: 'ghost', label: t('Calibrate'), icon: 'calibrate',
      onClick: () => run(() => (calib.active === input.code ? calib.stop() : calib.start(input.code))) });
    const row = h('div.inp-cal-row',
      glyph(input.name, { size: 34 }),
      h('div.inp-cal-main', h('div.inp-cal-name', h('strong', input.label), range), m),
      btn);
    return { input, row, m, range, btn };
  });

  async function run(fn) {
    mainBtn.disabled = true;
    rows.forEach((r) => { r.btn.disabled = true; });
    try { await fn(); } finally { paint(); }
  }

  mainBtn.addEventListener('click', () => run(() => (calib.active != null ? calib.stop() : calib.start('all'))));

  function paint() {
    const active = calib.active;
    const set = !!session.config.hover.hover_calibration_set;
    status.replaceChildren(active != null ? badge(t('Calibrating…'), 'blue') : set ? badge(t('Calibrated'), 'green') : badge(t('Needs calibration'), 'yellow'));
    mainBtn.disabled = false;
    mainBtn.className = `btn btn-lg ${active != null ? 'btn-warning' : 'btn-primary'}`;
    mainBtn.setLabel(active != null ? t('Finish calibration') : t('Start calibration'));
    activeNote.hidden = active == null;
    const slots = session.config.hover.config;
    for (const r of rows) {
      const busy = active === r.input.code;
      r.btn.disabled = active != null && !busy;
      r.btn.setLabel(busy ? t('Finish') : t('Calibrate'));
      r.row.classList.toggle('is-active', active === 'all' || busy);
      const s = slots[r.input.code];
      // min/max are raw 12-bit readings; an uncalibrated channel spans the whole range (or is inverted).
      r.range.textContent = s && s.max > s.min ? t('Range {min}–{max}', { min: pct(s.min), max: pct(s.max) }) : t('Not calibrated');
    }
  }
  const pct = (raw) => fmt.percent(Math.round((raw / 4095) * 100) / 100);

  const onReport = (r) => {
    if (!r.inputs) return;
    for (const row of rows) {
      const v = r.inputs[row.input.code];
      if (v) row.m.set(v.value / 127, v.pressed);
    }
  };
  live.add(onReport);
  const offCalib = calib.on(paint);
  paint();

  panel.append(
    card({ title: t('Analog calibration'), icon: 'calibrate', tone: 'lavender', actions: status,
      subtitle: t('Teach the controller the full travel of its analog (hall-effect) inputs, such as triggers.') },
      h('ol.inp-steps',
        h('li', rich(t('Press {button}.'), { button: h('strong', t('Start calibration')) })),
        h('li', t('Fully press and release every analog input below 3–4 times.')),
        h('li', rich(t('Press {button}.'), { button: h('strong', t('Finish calibration')) })),
        h('li', rich(t('Check each bar now reaches both ends, then press {button}.'), { button: h('strong', t('Save')) }))),
      h('div.row', mainBtn),
      activeNote,
      rows.length
        ? h('div.inp-cal-list', rows.map((r) => r.row))
        : h('p.muted.small', t('This controller has no analog inputs to calibrate.'))),
  );

  return () => { live.delete(onReport); offCalib(); };
}
