/**
 * Input view — button remapping per output mode, analog trigger modes and analog calibration.
 * Port of hoja2/modules/input-md.js (+ components input-mapping-display, input-config-panel,
 * button-grid, multi-position-button, tristate-button, single-shot-button).
 *
 * Data (see mapping.js for field-level details):
 *   static  `input`  inputInfoStatic_s — which of the 36 input slots this build has (type + name).
 *                    Only those are shown: every custom build has its own layout.
 *   config  `input`  inputConfig_s — one remap profile per output mode (Switch, XInput, SNES, N64,
 *                    GameCube, SInput), 36 inputConfigSlot_s each, indexed by input code.
 *   config  `hover`  hoverConfig_s — analog input calibration; hover_calibration_set == 0 makes the
 *                    app show an attention badge (session.refreshAttention()).
 *
 * Protocol / order of operations (same as hoja2):
 *   mount          device.setInputMode(false) → raw 0xFF stream (all 36 inputs, 7-bit + pressed bit,
 *                  plus one "focused" input at 12 bits); MAPPER_CMD_WEBUSB_<MODE> so that stream runs
 *                  the profile being edited (resent whenever the mode tab changes).
 *   open editor    device.setFocusedInput(code) → the focused field tracks that input.
 *   edit           patch the slot, session.commit('input') (debounced write; firmware applies it live).
 *   reset mode     MAPPER_CMD_DEFAULT_<MODE> (or DEFAULT_ALL) → re-read the `input` block.
 *   calibrate      hover block commands, see calibration.js.
 *
 * URL state: #/input?tab=remap|calibrate&mode=<switch|xinput|snes|n64|gamecube|sinput (alias steam)>&input=<code key>
 * (e.g. #/input?mode=xinput&input=lt_analog). Input keys are mapper_input_code_t names without
 * INPUT_CODE_, lower-cased; the build's own input name (e.g. "zl") also works.
 */
import { h, loadStyles } from '../../ui/dom.js';
import { card, button, segmented, select, tabView, callout, badge, infoTip } from '../../ui/controls.js';
import { toast, openDialog, confirmDialog } from '../../ui/overlay.js';
import { icon } from '../../ui/icons.js';
import { decodeText } from '../../device/struct.js';
import { t, fmt, N_ } from '../../i18n/index.js';
import { onInputReport } from '../../device/reports.js';
import {
  MODES, INPUT_CODES, INPUT_TYPE, OUTPUT_MODE, ANALOG_FULL, getMode, modeForReportFormat, outputOf, readProfile,
  effectiveMode, isAnalogInput,
} from './mapping.js';
import { glyph, meter, outputName } from './parts.js';
import { createEditor } from './editor.js';
import { createCalibration, renderCalibrationTab } from './calibration.js';

loadStyles(new URL('./input.css', import.meta.url));

/** Glyph-name form of a label ('D Up' → 'dup'), to tell whether an input sends its own button. */

/** Width at which the editor sits beside the input grid instead of opening as a dialog. */
const SPLIT = '(min-width: 1100px)';

const GROUPS = [
  { type: INPUT_TYPE.DIGITAL, title: N_('Buttons'), tip: null },
  { type: INPUT_TYPE.HOVER, title: N_('Analog inputs'),
    tip: N_('Hall-effect inputs that measure how far they are pressed, such as analog triggers. They can act as a button with an adjustable activation point, as rapid trigger, or as a full analog output.') },
  { type: INPUT_TYPE.JOYSTICK, title: N_('Stick directions'),
    tip: N_('Each stick direction can be sent somewhere else too — for example to the d-pad or a button.') },
];

export function mount(root, ctx) {
  const { session, device } = ctx;

  // ---- What this build has ---------------------------------------------------------------------
  const infos = session.static.input.input_info;
  /**
   * Physical inputs present on this build. `name` is the build's own name (also the glyph name and a
   * deep-link value); `label` is the display text (descriptive names like 'D Up' translated).
   * @type {Array<{code:number, key:string, name:string, label:string, type:number}>}
   */
  const inputs = INPUT_CODES
    .map(({ code, key }) => ({ code, key, type: infos[code]?.input_type ?? INPUT_TYPE.UNUSED,
      name: decodeText(infos[code]?.input_name ?? new Uint8Array()) || key.replace(/_/g, ' ') }))
    .filter((i) => i.type !== INPUT_TYPE.UNUSED)
    .map((i) => ({ ...i, label: outputName(i.name) }));
  const hoverInputs = inputs.filter((i) => i.type === INPUT_TYPE.HOVER);

  /** Resolve a deep-link value (code key, build name or number) to an input. */
  const findInput = (value) => {
    if (value == null || value === '') return null;
    const v = String(value).toLowerCase().replace(/\s+/g, '');
    return inputs.find((i) => i.key.toLowerCase() === v) || inputs.find((i) => i.name.toLowerCase().replace(/\s+/g, '') === v)
      || inputs.find((i) => String(i.code) === v) || null;
  };

  // ---- State -------------------------------------------------------------------------------------
  const state = {
    mode: getMode(ctx.params.mode)?.id || modeForReportFormat(session.config.gamepad.gamepad_default_mode),
    selected: null, // input code being edited
  };
  const calib = createCalibration(session);
  /** Handlers fed with every decoded raw report (registered by whatever is on screen). */
  const live = new Set();
  const splitMq = matchMedia(SPLIT);
  let editor = null;
  let dialog = null;
  let remap = null; // { aside, markSelected, setModeUI, refreshTiles } while the Remap tab is shown

  // ---- Device setup: raw stream + live loop ------------------------------------------------------
  device.setInputMode(false).catch((err) => console.warn('[input] setInputMode failed', err));
  previewMode();

  let latest = null;
  let drawn = null;
  const stopReports = onInputReport(device, (r) => { if (r.kind === 'raw') latest = r; });
  let raf = requestAnimationFrame(function loop() {
    raf = requestAnimationFrame(loop);
    if (!latest || latest === drawn) return;
    drawn = latest;
    for (const fn of live) fn(drawn);
    if (editor) editor.live(drawn.focused);
  });

  /** Tell the firmware which profile the WebUSB stream should run (MAPPER_CMD_WEBUSB_<MODE>). */
  async function previewMode() {
    try {
      await session.flush();
      const { status } = await session.command('input', getMode(state.mode).preview);
      if (!status) console.warn('[input] mode preview not confirmed');
    } catch (err) {
      console.warn('[input] mode preview failed', err);
    }
  }

  // ---- Editor placement: side panel when wide, dialog otherwise -----------------------------------

  function openEditor(code, { updateUrl = true } = {}) {
    const input = inputs.find((i) => i.code === code);
    if (!input) return;
    closeEditor({ updateUrl: false, keepCalibration: state.selected === code }); // same input in another mode/place
    state.selected = code;
    device.setFocusedInput(code).catch((err) => console.warn('[input] setFocusedInput failed', err));
    if (updateUrl) ctx.setParams({ input: input.key.toLowerCase() });

    editor = createEditor({ session, modeId: state.mode, input, inputs, calib, onChange: (c) => remap?.refreshTiles(c) });
    if (splitMq.matches && remap) {
      remap.aside.replaceChildren(card({ title: editor.title, icon: 'input', tone: 'lavender', class: 'inp-aside-card',
        actions: button({ icon: 'close', variant: 'ghost', title: t('Close editor'), onClick: () => closeEditor() }) }, editor.el));
    } else {
      dialog = openDialog({
        title: editor.title, icon: 'input', tone: 'lavender', body: editor.el,
        actions: [{ label: t('Done'), variant: 'primary', value: true }],
        onClose: () => { if (dialog) { dialog = null; closeEditor(); } },
      });
      dialog.el.classList.add('inp-dialog');
    }
    remap?.markSelected(code);
  }

  function closeEditor({ updateUrl = true, keepCalibration = false } = {}) {
    if (editor) { editor.destroy({ keepCalibration }); editor = null; }
    if (dialog) { const d = dialog; dialog = null; d.close(); }
    state.selected = null;
    if (remap) { remap.aside.replaceChildren(asidePlaceholder()); remap.markSelected(null); }
    if (updateUrl) ctx.setParams({ input: null });
  }

  const asidePlaceholder = () => h('div.inp-aside-empty',
    h('span.face.soft.tone-lavender', { style: { '--size': '48px' } }, icon('input')),
    h('strong', t('Pick an input')),
    h('p.muted.small', t('Choose a button on the left to see what it does and change it.')));

  // Re-place an open editor when the layout crosses the split breakpoint.
  const onSplit = () => { if (state.selected != null) { const c = state.selected; openEditor(c, { updateUrl: false }); } };
  splitMq.addEventListener('change', onSplit);

  // Escape closes the side panel; preventDefault() tells the shell not to navigate home.
  const onKey = (e) => {
    if (e.key !== 'Escape' || state.selected == null || dialog || document.querySelector('dialog[open]')) return;
    if (e.target.closest?.('input, textarea, select')) return;
    e.preventDefault();
    closeEditor();
  };
  window.addEventListener('keydown', onKey, true);

  // ---- Mode -------------------------------------------------------------------------------------

  function setMode(id, { updateUrl = true } = {}) {
    const mode = getMode(id); // also resolves aliases (?mode=steam)
    if (!mode || mode.id === state.mode) return;
    state.mode = mode.id;
    if (updateUrl) ctx.setParams({ mode: id });
    previewMode();
    remap?.setModeUI();
    if (state.selected != null) openEditor(state.selected, { updateUrl: false }); // same input, new mode
  }

  async function resetModes(all) {
    const mode = getMode(state.mode);
    const ok = await confirmDialog({
      title: all ? t('Reset every mode?') : t('Reset {mode} mode?', { mode: mode.label }),
      message: all
        ? t('All six layouts go back to this controller\'s defaults. Your changes in every mode are lost.')
        : t('Every input in {mode} mode goes back to this controller\'s default layout and settings. Other modes are not affected.', { mode: mode.label }),
      confirmLabel: t('Reset'), danger: true,
    });
    if (!ok) return;
    try {
      await session.flush();
      const { status } = await session.command('input', all ? 'DEFAULT_ALL' : mode.reset);
      if (!status) throw new Error('not confirmed');
      await session.refresh('input');
      session.commit('input'); // re-send what we just read: harmless, and lights up Save
      remap?.refreshTiles();
      editor?.refresh();
      toast(all ? t('All modes reset to defaults — press Save to keep it.')
        : t('{mode} mode reset to defaults — press Save to keep it.', { mode: mode.label }), { tone: 'green' });
    } catch (err) {
      console.warn('[input] reset failed', err);
      toast(t('The controller did not confirm the reset. Try again.'), { tone: 'red' });
    }
  }

  // ---- Remap tab ----------------------------------------------------------------------------------

  function renderRemap(panel) {
    const tiles = new Map();

    const modeSeg = segmented({
      options: MODES.map((m) => ({ value: m.id, label: m.label })), value: state.mode, tone: 'lavender', ariaLabel: t('Output mode'),
      onChange: (id) => setMode(id),
    });
    // Six modes don't fit a phone-width segmented control, so phones get a select (CSS picks one).
    const modeSelect = select({
      options: MODES.map((m) => ({ value: m.id, label: t('{mode} mode', { mode: m.label }) })), value: state.mode, ariaLabel: t('Output mode'),
      onChange: (id) => setMode(id),
    });
    const where = h('p.muted.small');
    const unsupported = h('div');
    const resetBtn = button({ label: t('Reset this mode'), icon: 'refresh', size: 'sm', variant: 'tonal', onClick: () => resetModes(false) });
    resetBtn.dataset.tip = t('Quickly reset this mode to its default layout.');
    const resetAll = button({ label: t('Reset all modes'), size: 'sm', variant: 'ghost', onClick: () => resetModes(true) });

    const modeCard = card({ title: t('Output mode'), icon: 'gamepad', tone: 'lavender',
      subtitle: t('Each mode has its own layout. Pick the one you play in, then tap a button below to change it.') },
    h('div.inp-mode-seg', modeSeg), h('div.inp-mode-select', modeSelect), where, unsupported, h('div.row', resetBtn, resetAll));

    const grid = h('div.stack', { style: { '--gap': 'var(--space-4)' } });
    const inputsCard = card({ title: t('Buttons & inputs'), icon: 'input', tone: 'lavender', subtitle: t('What each input sends.') }, grid);
    const subtitle = inputsCard.querySelector('.card-sub');
    const aside = h('aside.inp-aside', asidePlaceholder());
    const layout = h('div.inp-layout', inputsCard, aside);
    const syncSplit = () => { layout.classList.toggle('split', splitMq.matches); aside.hidden = !splitMq.matches; };
    syncSplit();
    splitMq.addEventListener('change', syncSplit);

    // Calibration reminder (only when this build has analog inputs to calibrate).
    const attention = hoverInputs.length && !session.config.hover.hover_calibration_set
      ? callout({ tone: 'yellow', title: t('Analog inputs need calibration.'), text: `${t('Calibrate them so presses register across their full travel.')} ` },
        button({ label: t('Calibrate now'), size: 'sm', variant: 'tonal', icon: 'calibrate', onClick: () => { tabs?.select('calibrate'); ctx.setParams({ tab: 'calibrate' }); } }))
      : null;

    /**
     * One tile per physical input: input glyph › output glyph (the glyph pair is the label), a foot
     * row with the analog mode pill or "Off", and a live meter. Full names go in the tooltip and the
     * accessible name.
     */
    function tile(input) {
      const inG = glyph(input.name, { size: 38 });
      const outG = glyph('', { shape: 'square', size: 38 });
      const foot = h('span.inp-tile-foot');
      const m = meter();
      const el = h('button.inp-tile', { type: 'button', onclick: () => openEditor(input.code) },
        h('span.inp-tile-map', inG, icon('chevron-right'), outG),
        foot, m);
      el.update = () => {
        const s = readProfile(session, state.mode)[input.code];
        const out = outputOf(state.mode, s.output_code);
        const modeLabel = getMode(state.mode).label;
        outG.set(out ? out.label : 'Off', !out);
        el.classList.toggle('is-off', !out);
        // No "remapped" highlight: each board can override its default maps (hoja config defaults_<mode>),
        // so the app can't know the true default. The glyph pair + tooltip state the mapping exactly.
        // Analog inputs: show how they behave at a glance.
        const md = isAnalogInput(input.type) ? effectiveMode(input.type, out?.type, s.output_mode) : null;
        const pct = fmt.percent(Math.round((s.threshold_delta / ANALOG_FULL) * 100) / 100);
        foot.replaceChildren(
          !out ? h('span.inp-tile-off', t('Disabled'))
            : md === OUTPUT_MODE.THRESHOLD ? h('span.inp-tile-pill', t('Threshold {value}', { value: pct }))
              : md === OUTPUT_MODE.RAPID ? h('span.inp-tile-pill', t('Rapid'))
                : md === OUTPUT_MODE.PASSTHROUGH ? h('span.inp-tile-pill', t('Analog')) : '');
        const sentence = out
          ? t('{input} sends {output} in {mode} mode.', { input: input.label, output: outputName(out.label), mode: modeLabel })
          : t('{input} is off in {mode} mode.', { input: input.label, mode: modeLabel });
        const detail = md === OUTPUT_MODE.THRESHOLD ? t('Threshold mode, activation point {value}.', { value: pct })
          : md === OUTPUT_MODE.RAPID ? t('Rapid trigger mode.') : md === OUTPUT_MODE.PASSTHROUGH ? t('Full analog mode.') : '';
        const text = detail ? `${sentence} ${detail}` : sentence;
        el.title = text;
        el.setAttribute('aria-label', text);
      };
      el.live = (v) => {
        if (!v) return;
        m.set(v.value / 127, v.pressed);
        if (v.pressed !== el._p) { el._p = v.pressed; el.classList.toggle('is-pressed', v.pressed); }
      };
      el.update();
      tiles.set(input.code, el);
      return el;
    }

    function buildGrid() {
      tiles.clear();
      grid.replaceChildren(...GROUPS.map((g) => {
        const list = inputs.filter((i) => i.type === g.type);
        return list.length > 0 && h('section.inp-group',
          h('h3.inp-group-title', t(g.title), h('span.faint', fmt.number(list.length)), g.tip && infoTip(t(g.tip))),
          h('div.inp-grid', list.map(tile)));
      }).filter(Boolean));
      if (!inputs.length) grid.append(h('p.muted', t('This controller did not report any remappable inputs.')));
      markSelected(state.selected);
    }

    function markSelected(code) {
      for (const [c, t] of tiles) t.setAttribute('aria-current', String(c === code));
    }

    function setModeUI() {
      const mode = getMode(state.mode);
      modeSeg.value = mode.id;
      modeSelect.value = mode.id;
      where.replaceChildren(h('strong', t('{mode}:', { mode: mode.label })), ' ', t(mode.where));
      unsupported.replaceChildren(mode.requires && !session.caps[mode.requires]
        ? callout({ tone: 'blue', text: t('This controller doesn\'t have a {mode} connection, so this layout is only kept for completeness.', { mode: mode.label }) })
        : '');
      resetBtn.setLabel(t('Reset {mode}', { mode: mode.label }));
      subtitle.textContent = t('What each input sends in {mode} mode. Pressed inputs light up.', { mode: mode.label });
      for (const t of tiles.values()) t.update();
    }

    const onReport = (r) => { if (r.inputs) for (const [code, t] of tiles) t.live(r.inputs[code]); };
    live.add(onReport);

    buildGrid();
    remap = {
      aside, markSelected, setModeUI,
      refreshTiles: (code) => { if (code == null) for (const t of tiles.values()) t.update(); else tiles.get(code)?.update(); },
    };
    setModeUI();
    panel.append(h('div.stack', attention, modeCard, layout));

    // Re-open the editor in the new container if one was open (e.g. after switching tabs).
    if (state.selected != null) openEditor(state.selected, { updateUrl: false });

    return () => {
      live.delete(onReport);
      splitMq.removeEventListener('change', syncSplit);
      if (dialog || editor) closeEditor(); // leaving the tab (page teardown closes the editor first)
      remap = null;
    };
  }

  // ---- Page ---------------------------------------------------------------------------------------

  const showCalibration = hoverInputs.length > 0 || !session.config.hover.hover_calibration_set;
  const initialInput = findInput(ctx.params.input);
  let tabs = null;
  if (initialInput) state.selected = initialInput.code;

  if (showCalibration) {
    tabs = tabView({
      tone: 'lavender',
      value: initialInput ? 'remap' : ctx.params.tab,
      tabs: [
        { id: 'remap', label: t('Remap'), icon: 'input', render: renderRemap },
        { id: 'calibrate', label: t('Analog calibration'), icon: 'calibrate',
          render: (panel) => renderCalibrationTab(panel, { session, calib, hoverInputs, live }) },
      ],
      onChange: (id) => ctx.setParams({ tab: id }),
    });
    root.append(tabs);
  } else {
    const panel = h('div.stack');
    root.append(panel);
    const cleanup = renderRemap(panel);
    tabs = { destroy: cleanup, select: () => {} };
  }

  // The nav shows the "needs calibration" badge; mirror it on the calibration tab until it's done.
  const tabBadge = badge('!', 'yellow');
  tabBadge.classList.add('inp-tab-badge');
  tabBadge.title = t('Needs calibration');
  const paintTabBadge = () => {
    const need = hoverInputs.length > 0 && !session.config.hover.hover_calibration_set && calib.active == null;
    if (need) tabs.querySelector?.('[role="tab"]:last-child')?.append(tabBadge);
    else tabBadge.remove();
  };
  const offTabBadge = showCalibration ? calib.on(paintTabBadge) : () => {};
  if (showCalibration) paintTabBadge();

  return {
    update(params) {
      if (params.mode) setMode(params.mode, { updateUrl: false });
      const inp = findInput(params.input);
      if (inp && inp.code !== state.selected) {
        if (tabs?.value !== 'remap') tabs.select('remap');
        openEditor(inp.code, { updateUrl: false });
      } else if (!inp && state.selected != null && !params.input) {
        closeEditor({ updateUrl: false });
      }
      if (!inp && params.tab && tabs?.value !== params.tab) tabs.select(params.tab);
    },
    destroy() {
      cancelAnimationFrame(raf);
      stopReports();
      splitMq.removeEventListener('change', onSplit);
      window.removeEventListener('keydown', onKey, true);
      offTabBadge();
      closeEditor({ updateUrl: false });
      tabs?.destroy?.();
      if (calib.active != null) calib.stop({ quiet: true }); // never leave the controller calibrating
      live.clear();
    },
  };
}
