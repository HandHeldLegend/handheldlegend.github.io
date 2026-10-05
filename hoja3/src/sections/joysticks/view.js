/**
 * Joysticks view — port of hoja2/modules/analog-md.js (+ joystick-visual, angle-modifier, number-selector).
 *
 * Layout (shared left/right pattern, see "Left/right layouts" in docs/SECTIONS.md):
 *   notice      "needs calibrating" callout
 *   live split  .lr-split — one live visualizer card per stick (+ the Left/Right switch on narrow pages)
 *   tabs        a single tab strip; each panel holds any shared content plus another .lr-split whose
 *               columns hold the same card for each stick, so left and right line up row by row:
 *     calibrate  status, guided calibration (calibration.js, always every stick) | resting centers per stick
 *     sensitivity center/edge deadzones and response curve (settings.js) in compact rows + a small live
 *                curve preview (the old id `deadzone` still deep-links here)
 *     angles     angle map editor (angle-map.js)
 *     axes       per-axis invert (only when the build reports analog invert_allowed, like hoja2)
 * Every split marks the selected stick's column with data-active. The container query in components.css
 * shows both columns side by side on wide pages (≥ 640px) and only the active one, picked with the switch,
 * on narrow pages. Single-stick builds get .single: one full-width column and no switch.
 *
 * Deep links: #/joysticks?stick=right&tab=sensitivity — reflected back with ctx.setParams. On wide pages
 * ?stick= scrolls to that stick's column (its editor card when ?tab= is given too) and highlights it.
 *
 * Live data: device.setInputMode(true) switches the controller to the 0xFE joystick stream; reports
 * carry each stick before deadzones (r.sticks.snapback) and the final output (r.sticks.deadzone), both
 * centered ±2048. One report subscription feeds both sticks' visualizers and curve previews; these only
 * store the values and invalidate their canvasSurface, so each canvas repaints at most once per animation
 * frame and both repaint in the same frame.
 *
 * Writes: scalar settings go through settingField (debounced session.commit). Angle-map edits and
 * calibration push the block immediately and re-read it, matching hoja2's write → re-read sequence.
 */
import { h, loadStyles } from '../../ui/dom.js';
import { card, callout, segmented, tabView, badge, kv, button } from '../../ui/controls.js';
import { prefersReducedMotion } from '../../ui/canvas-surface.js';
import { settingField, refreshSettings } from '../../settings/field.js';
import { onInputReport } from '../../device/reports.js';
import { stickVisual } from './stick-visual.js';
import { curveGraph } from './curve-graph.js';
import { angleMapEditor } from './angle-map.js';
import { openCalibration } from './calibration.js';
import { enabledSlots, prefix } from './analog.js';
import { expStoredToMultiplier } from './settings.js';
import { getSetting } from '../../settings/schema.js';
import { t, N_, fmt, i18n } from '../../i18n/index.js';
import { richText } from './rich-text.js';

loadStyles(new URL('./joysticks.css', import.meta.url));

const TONE = 'red';
const STICK_LABEL = { left: N_('Left stick'), right: N_('Right stick') };
/** Width from which .lr-split shows both columns (keep in sync with the container query in components.css). */
const SPLIT_WIDE = 640; // mirrors the .lr-split container query in css/components.css
/** How long the deep-link highlight stays on (the lr-flash animation is 1.2 s). */
const HIGHLIGHT_MS = 1300;
/** Old deep-link tab ids → current ones (the Deadzones tab became Sensitivity). */
const TAB_ALIASES = { deadzone: 'sensitivity', deadzones: 'sensitivity' };
const tabId = (id) => TAB_ALIASES[id] || id;

export function mount(root, ctx) {
  const { session, device } = ctx;
  const cfg = () => session.config.analog;
  const st = session.static.analog;

  // Which sticks/axes this build has (analogInfoStatic_s).
  const sticks = ['left', 'right'].filter((s) => session.caps[`${s}Stick`]);
  const axes = { left: { x: !!st.axis_lx, y: !!st.axis_ly }, right: { x: !!st.axis_rx, y: !!st.axis_ry } };
  const invertAllowed = !!st.invert_allowed;
  const single = sticks.length < 2;

  const linked = ctx.params.stick || ctx.sub?.[0];
  let stick = sticks.includes(linked) ? linked : sticks[0]; // active column (the one shown on narrow pages)
  let tab = tabId(ctx.params.tab);
  const curves = {};       // stick → curve preview while the deadzone tab is open
  const angleEditors = {}; // stick → angle map editor while the angles tab is open

  // ---- Left/right splits -------------------------------------------------------------------
  /** Every .lr-split on the page (live views + the open tab's), so data-active stays in sync. */
  const page = h('div.stack.js-page');

  /**
   * A left/right split with one column per stick. `build(s)` returns that stick's column content.
   * @param {(s: string) => Node|Node[]} build
   * @param {{switcher?: Node}} [o]
   */
  function split(build, o = {}) {
    return h('div.lr-split', { class: single ? 'single' : null },
      !single && o.switcher && h('div.lr-switch', o.switcher),
      h('div.lr-cols', sticks.map((s) => h('section.lr-col', {
        dataset: { side: s }, 'data-active': s === stick, 'aria-label': t(STICK_LABEL[s]),
      }, build(s)))));
  }

  function markActive() {
    for (const col of page.querySelectorAll('.lr-col')) col.toggleAttribute('data-active', col.dataset.side === stick);
  }

  // ---- Live visualizers (one per stick) -----------------------------------------------------
  const live = Object.fromEntries(sticks.map((s) => {
    const visual = stickVisual({ tone: TONE, stick: s });
    const el = card({ title: t(STICK_LABEL[s]), subtitle: t('Live view'), icon: 'joystick', tone: TONE, class: 'js-visual-card' }, visual.el);
    return [s, { visual, el }];
  }));

  /** Push a stick's deadzones / angle map / curve into its visualizers. */
  function syncStick(s) {
    const c = cfg();
    const p = prefix(s);
    live[s].visual.setDeadzones(c[`${p}_deadzone`], c[`${p}_deadzone_outer`]);
    live[s].visual.setSlots(enabledSlots(session, s).map((x) => x.slot));
    curves[s]?.set({ inner: c[`${p}_deadzone`], outer: c[`${p}_deadzone_outer`], exp: expStoredToMultiplier(c[`${p}_exp_scaler`]) });
  }
  const syncAll = () => sticks.forEach(syncStick);

  // ---- Calibration notice ---------------------------------------------------------------
  const notice = h('div');
  function renderNotice() {
    notice.replaceChildren();
    if (cfg().analog_calibration_set) return;
    notice.append(callout({ tone: 'red', title: sticks.length > 1 ? t('Your sticks need calibrating.') : t('Your stick needs calibrating.') },
      sticks.length > 1
        ? t('Follow the guided steps — it takes about a minute. Both sticks are calibrated at once.')
        : t('Follow the guided steps — it takes about a minute.'),
      h('div.row', { style: { marginTop: 'var(--space-2)' } },
        button({ label: t('Calibrate now'), icon: 'calibrate', variant: 'danger', size: 'sm', onClick: calibrate }))));
  }

  function calibrate() {
    openCalibration({
      session, sticks,
      onFinished: () => { afterReload(); },
    });
  }

  /** Re-sync everything after the analog block was re-read from the controller. */
  function afterReload() {
    if (!root.isConnected) return;
    renderNotice();
    refreshSettings(root);
    Object.values(angleEditors).forEach((e) => e.refresh());
    renderCalibrateTab?.();
    syncAll();
  }

  // ---- Stick switch (narrow pages) ------------------------------------------------------
  const stickSeg = segmented({
    options: ['left', 'right'].map((s) => ({ value: s, label: s === 'left' ? t('Left') : t('Right'), disabled: !sticks.includes(s) })),
    value: stick, tone: TONE, ariaLabel: t('Stick'),
    onChange: (v) => selectStick(v, true),
  });

  function selectStick(next, fromUser) {
    if (!sticks.includes(next) || next === stick) return;
    stick = next;
    stickSeg.value = stick;
    markActive();
    if (fromUser) ctx.setParams({ stick });
  }

  // ---- Tabs ------------------------------------------------------------------------------
  /** Editor card for one stick inside a tab's split. */
  const stickCard = (s, subtitle, ...children) =>
    card({ title: t(STICK_LABEL[s]), subtitle, tone: TONE, class: 'js-stick-card' }, ...children);

  let renderCalibrateTab = null;

  function calibrateTab(panel) {
    const status = h('div.stack');
    const centers = {};
    renderCalibrateTab = () => {
      const c = cfg();
      const set = !!c.analog_calibration_set;
      status.replaceChildren(
        h('div.row',
          set ? badge(t('Calibrated'), 'green') : badge(t('Not calibrated'), 'red'),
          h('span.muted.small', t('Calibration measures how far each stick reaches in every direction and where it rests.'))),
        h('ol.cal-steps.small',
          h('li', ...richText(single ? N_('Let go of the stick and press {calibrate}.') : N_('Let go of the sticks and press {calibrate}.'),
            { calibrate: h('strong', t('Calibrate')) })),
          h('li', single ? t('Slowly roll the stick around its edge a few times.') : t('Slowly roll each stick around its edge a few times.')),
          h('li', ...richText(N_('Press {finish}, check the live view, then {save}.'),
            { finish: h('strong', t('Finish')), save: h('strong', t('Save')) }))),
        h('div.row', button({ label: single ? t('Calibrate stick') : t('Calibrate sticks'), icon: 'calibrate', variant: 'danger', onClick: calibrate })),
        h('p.muted.small', t('Drifting after calibrating? Raise the center deadzone on the Sensitivity tab.')));
      for (const s of sticks) {
        const center = (axis) => (axes[s][axis] ? fmt.number(c[`${prefix(s)}${axis}_center`], { useGrouping: false }) : '—');
        centers[s].replaceChildren(kv([['X', h('span.mono', center('x'))], ['Y', h('span.mono', center('y'))]]));
      }
    };
    for (const s of sticks) centers[s] = h('div');
    panel.append(h('div.stack',
      card({ title: single ? t('Calibrate your stick') : t('Calibrate your sticks'), icon: 'calibrate', tone: TONE }, status),
      split((s) => stickCard(s, t('Resting center (raw, captured when calibration starts)'), centers[s]))));
    renderCalibrateTab();
    return () => { renderCalibrateTab = null; };
  }

  /** Short one-line help per sensitivity control; the full description moves into the "?" tip. */
  const SENS_HELP = {
    Deadzone: N_('Movement ignored around the center.'),
    OuterDeadzone: N_('Where full output starts, measured from the rim.'),
    Curve: N_('1.00 = linear. Higher = finer control near the center.'),
  };

  /** A compact sensitivity row: short help line, description + advice in the tip. */
  function sensField(s, name, o) {
    const def = getSetting(`joysticks.${s}${name}`);
    const row = settingField(def, { ...o, description: t(SENS_HELP[name]) });
    const tip = row.querySelector('.field-label .tip');
    if (tip) {
      const text = [t(def.description), t(def.tip)].join(i18n.lang === 'ja' ? '' : ' ');
      tip.dataset.tip = text;
      tip.setAttribute('aria-label', text);
    }
    return row;
  }

  function sensitivityTab(panel) {
    panel.append(split((s) => {
      curves[s] = curveGraph();
      const o = { tone: TONE, onChange: () => syncStick(s) };
      syncStick(s);
      return card({ title: t('{stick} · Sensitivity', { stick: t(STICK_LABEL[s]) }), tone: TONE, class: 'js-stick-card js-sens-card' },
        h('div.js-sens',
          h('div.js-fields',
            sensField(s, 'Deadzone', o),
            sensField(s, 'OuterDeadzone', o),
            sensField(s, 'Curve', o)),
          h('figure.js-curve-wrap',
            curves[s].el,
            h('figcaption.js-curve-legend', t('Input distance % → output %. Shaded: deadzones. Dot: your stick now.')))));
    }));
    return () => {
      for (const s of Object.keys(curves)) { curves[s].destroy(); delete curves[s]; }
    };
  }

  function anglesTab(panel) {
    panel.append(split((s) => {
      angleEditors[s] = angleMapEditor({ session, stick: s, tone: TONE, onChanged: () => syncStick(s) });
      return stickCard(s, t('Angle map'), angleEditors[s].el);
    }));
    return () => { for (const s of Object.keys(angleEditors)) { angleEditors[s].destroy?.(); delete angleEditors[s]; } };
  }

  function axesTab(panel) {
    panel.append(h('div.stack',
      split((s) => {
        const rows = ['x', 'y'].filter((a) => axes[s][a])
          .map((a) => settingField(`joysticks.${s}Invert${a.toUpperCase()}`, { tone: TONE }));
        return stickCard(s, t('Axis direction'), rows.length ? rows : h('p.muted', t('This stick has no adjustable axes.')));
      }),
      callout({ tone: 'yellow', text: t('Inverting an axis changes the raw stick direction — calibrate again afterwards.') })));
  }

  const tabs = tabView({
    tabs: [
      { id: 'calibrate', label: t('Calibration'), icon: 'calibrate', render: calibrateTab },
      { id: 'sensitivity', label: t('Sensitivity'), icon: 'sliders', render: sensitivityTab },
      { id: 'angles', label: t('Angle map'), icon: 'joystick', render: anglesTab },
      invertAllowed && { id: 'axes', label: t('Axes'), icon: 'refresh', render: axesTab },
    ].filter(Boolean),
    value: tab, tone: TONE,
    onChange: (id) => { tab = id; ctx.setParams({ tab: id }); },
  });
  tab = tabs.value;
  tabs.classList.add('js-tabs');

  // ---- Deep-link focus (wide pages) --------------------------------------------------------
  let highlightTimer = 0;
  let focusFrame = 0;

  /** On wide pages: scroll to a stick's column (its editor card when `toEditor`) and flash it. */
  function focusStick(s, toEditor) {
    cancelAnimationFrame(focusFrame);
    focusFrame = requestAnimationFrame(() => {
      const liveSplit = page.querySelector('.lr-split');
      if (single || !root.isConnected || !liveSplit || liveSplit.clientWidth < SPLIT_WIDE) return;
      const cols = [...page.querySelectorAll(`.lr-col[data-side="${s}"]`)];
      clearTimeout(highlightTimer);
      for (const col of page.querySelectorAll('.lr-col[data-highlight]')) col.removeAttribute('data-highlight');
      void page.offsetWidth; // restart the flash animation
      cols.forEach((col) => col.setAttribute('data-highlight', ''));
      highlightTimer = setTimeout(() => cols.forEach((col) => col.removeAttribute('data-highlight')), HIGHLIGHT_MS);
      const target = (toEditor && cols[cols.length - 1]) || cols[0];
      target?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: toEditor ? 'start' : 'nearest' });
    });
  }

  // ---- Assemble ---------------------------------------------------------------------------
  renderNotice();
  syncAll();
  page.classList.toggle('two-sticks', !single);
  page.append(
    notice,
    split((s) => live[s].el, { switcher: stickSeg }),
    tabs);
  root.append(page);
  // On phones the tab strip scrolls: make sure a deep-linked tab is visible.
  requestAnimationFrame(() => {
    const bar = tabs.querySelector('.tabs');
    const sel = bar?.querySelector('[aria-selected="true"]');
    if (bar && sel) bar.scrollLeft = Math.max(0, sel.offsetLeft - bar.offsetLeft - 16);
  });
  if (sticks.includes(linked)) focusStick(linked, !!ctx.params.tab);

  // ---- Live input --------------------------------------------------------------------------
  device.setInputMode(true)?.catch?.((err) => console.warn('[joysticks] input mode', err));
  const stopInput = onInputReport(device, (r) => {
    if (!r.sticks) return;
    const a = r.sticks.snapback;
    const b = r.sticks.deadzone;
    for (const s of sticks) {
      const [ix, iy, ox, oy] = s === 'right' ? [a.rx, a.ry, b.rx, b.ry] : [a.lx, a.ly, b.lx, b.ly];
      live[s].visual.setInput(ix, iy, ox, oy);
      curves[s]?.setLive(Math.hypot(ix, iy) / 2048, Math.hypot(ox, oy) / 2048);
    }
  });

  return {
    update(params) {
      const nextTab = tabId(params.tab);
      if (nextTab && nextTab !== tabs.value) tabs.select(nextTab);
      if (sticks.includes(params.stick)) {
        selectStick(params.stick, false);
        focusStick(params.stick, !!params.tab);
      }
    },
    destroy() {
      stopInput();
      cancelAnimationFrame(focusFrame);
      clearTimeout(highlightTimer);
      tabs.destroy();
      for (const { visual } of Object.values(live)) visual.destroy();
      device.setInputMode(false)?.catch?.(() => {});
    },
  };
}
