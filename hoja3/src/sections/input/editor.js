/**
 * editor.js — The per-input editor (port of hoja2's input-config-panel + button-grid popups).
 *
 * Shows what one physical input sends in the selected output mode and lets the customer change it:
 *   - output picker (grouped by kind, "None" disables the input, shows which input already uses each);
 *   - live meter of the focused input (raw report bytes 15–16: 12-bit value + pressed bit; the app
 *     selects the input with device.setFocusedInput(code) when the editor opens);
 *   - for analog inputs: rapid trigger / threshold / full-analog mode, the activation point or rapid
 *     trigger sensitivity (threshold_delta), copy/paste of those settings (hoja2 JSON format), and
 *     per-input calibration for hall-effect inputs;
 *   - "output when pressed" (static_output) when a press drives an analog output.
 * Every change patches the profile slot and pushes the `input` block (see mapping.js writeSlot).
 */
import { h } from '../../ui/dom.js';
import { button, segmented, slider, field, badge, infoTip } from '../../ui/controls.js';
import { toast } from '../../ui/overlay.js';
import { icon } from '../../ui/icons.js';
import { t, fmt, N_ } from '../../i18n/index.js';
import {
  INPUT_TYPE, OUTPUT_TYPE, OUTPUT_MODE, ANALOG_FULL, GAMECUBE_MIN_ANALOG, MODE_LABEL, MODE_CLIP_NAME, CLIPBOARD_HEADER,
  INPUT_TYPE_LABEL, OUTPUT_TYPE_LABEL, getMode, outputsFor, outputOf, readProfile, writeSlot,
  modeOptions, defaultOutputMode, effectiveMode, usesThreshold, usesStaticOutput, isAnalogInput,
} from './mapping.js';
import { glyph, meter, outputName } from './parts.js';

/** Order and headings of the output picker groups. */
const PICKER_GROUPS = [
  [OUTPUT_TYPE.DIGITAL, N_('Buttons')],
  [OUTPUT_TYPE.DPAD, N_('D-pad')],
  [OUTPUT_TYPE.HOVER, N_('Analog triggers')],
  [OUTPUT_TYPE.JOYSTICK, N_('Stick directions')],
];

const MODE_HELP = {
  [OUTPUT_MODE.RAPID]: N_('Presses as soon as it moves down, and releases as soon as it starts coming back up — great for fast repeated presses.'),
  [OUTPUT_MODE.THRESHOLD]: N_('Counts as pressed once it passes the activation point, like a normal button with an adjustable trigger point.'),
  [OUTPUT_MODE.PASSTHROUGH]: N_('Sends the full analog travel, so games see exactly how far it is pressed.'),
};

/** Last copied settings, used when the browser won't let us read the clipboard. */
let memoryClip = null;

const toPct = (raw) => Math.round((raw / ANALOG_FULL) * 100);
/** A whole percentage (0..100) formatted for the active language. */
const pctText = (pct) => fmt.percent(pct / 100);
const fromPct = (pct) => Math.round((pct / 100) * ANALOG_FULL);

/**
 * @param {{session: object, modeId: string, input: {code:number, key:string, name:string, label:string, type:number},
 *          inputs: Array<{code:number,name:string,label:string,type:number}>, calib: object,
 *          onChange: (code:number)=>void}} o
 *   `inputs` (all physical inputs) are used for "already used by" hints; `onChange` lets the page
 *   refresh the input's tile after an edit.
 * @returns {{el: HTMLElement, title: string, live: (focused:{value:number,pressed:boolean})=>void,
 *            refresh: ()=>void, destroy: ()=>void}}
 */
export function createEditor(o) {
  const { session, modeId, input, inputs, calib } = o;
  const mode = getMode(modeId);
  const el = h('div.inp-editor');
  let pickerOpen = false;
  let liveMeter = null;
  let liveText = null;
  let livePressed = null;

  const slot = () => readProfile(session, modeId)[input.code];

  function write(patch) {
    writeSlot(session, modeId, input.code, patch);
    o.onChange?.(input.code);
  }

  // ---- Output picker -----------------------------------------------------------------------

  function choose(outCode) {
    const out = outputOf(modeId, outCode);
    const patch = { output_code: out ? out.code : -1 };
    // Keep the mode valid for the new pair (firmware defaults, as hoja2 did when the panel re-rendered).
    const opts = modeOptions(input.type, out?.type);
    if (opts.length && !opts.includes(slot().output_mode)) patch.output_mode = defaultOutputMode(input.type, out.type);
    write(patch);
    pickerOpen = false;
    render();
  }

  function picker(current) {
    // Who uses each output now, for the "used by" hints.
    const profile = readProfile(session, modeId);
    const usedBy = new Map();
    for (const inp of inputs) {
      if (inp.code === input.code) continue;
      const c = profile[inp.code].output_code;
      if (c >= 0) usedBy.set(c, [...(usedBy.get(c) || []), inp.label]);
    }
    let outputs = outputsFor(modeId);
    // SInput output codes mirror the physical input codes; like hoja2, only offer the ones this
    // controller actually has (plus whatever is currently selected).
    if (modeId === 'sinput') {
      const present = new Set(inputs.map((i) => i.code));
      outputs = outputs.filter((x) => present.has(x.code) || x.code === current);
    }

    // `label` is the glyph name (English); the text shows its translation.
    const choice = (code, label, type, hint) => h('button.inp-choice', {
      type: 'button', 'aria-pressed': String(code === current), title: hint ? t(hint) : null,
      onclick: () => choose(code),
    },
    glyph(label, { shape: 'square', size: 30, off: code < 0 }),
    h('span.inp-choice-text', h('span.inp-choice-label', code < 0 ? t('None') : outputName(label)),
      code >= 0 && usedBy.has(code) && h('span.inp-choice-used', t('used by {inputs}', { inputs: fmt.list(usedBy.get(code)) }))));

    return h('div.inp-picker', { role: 'group', 'aria-label': t('Outputs in {mode} mode', { mode: mode.label }) },
      h('div.inp-picker-head', h('strong', t('Send in {mode} mode', { mode: mode.label })),
        button({ label: t('Cancel'), size: 'sm', variant: 'ghost', onClick: () => { pickerOpen = false; render(); } })),
      h('div.inp-choices', choice(-1, 'None', OUTPUT_TYPE.DISABLED, N_('Disable this input in this mode'))),
      PICKER_GROUPS.map(([type, heading]) => {
        const list = outputs.filter((x) => x.type === type);
        return list.length > 0 && h('div.inp-picker-group',
          h('div.inp-picker-title', t(heading)),
          h('div.inp-choices', list.map((x) => choice(x.code, x.label, x.type, x.hint))));
      }));
  }

  // ---- Copy / paste (hoja2-compatible JSON) -------------------------------------------------

  async function copySettings() {
    const s = slot();
    const out = outputOf(modeId, s.output_code);
    const m = effectiveMode(input.type, out?.type, s.output_mode);
    const data = { header: CLIPBOARD_HEADER, mode: MODE_CLIP_NAME[m] || 'default', delta: s.threshold_delta, output: s.static_output };
    memoryClip = data;
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      toast(t('Settings copied — open another analog input and press Paste.'), { tone: 'green' });
    } catch {
      toast(t('Settings copied inside the app (clipboard access was blocked).'), { tone: 'blue' });
    }
  }

  async function pasteSettings() {
    let data = null;
    try { data = JSON.parse(await navigator.clipboard.readText()); } catch { data = memoryClip; }
    if (!data || data.header !== CLIPBOARD_HEADER) {
      toast(t('Nothing to paste — copy an analog input\'s settings first.'), { tone: 'yellow' });
      return;
    }
    const out = outputOf(modeId, slot().output_code);
    const patch = {};
    const m = Number(Object.keys(MODE_CLIP_NAME).find((k) => MODE_CLIP_NAME[k] === data.mode));
    if (modeOptions(input.type, out?.type).includes(m)) patch.output_mode = m;
    const clamp4096 = (v) => Math.max(0, Math.min(ANALOG_FULL, parseInt(v, 10) || 0));
    if (data.delta !== undefined) patch.threshold_delta = clamp4096(data.delta);
    if (data.output !== undefined) patch.static_output = clamp4096(data.output);
    write(patch);
    render();
    toast(t('Settings pasted.'), { tone: 'green' });
  }

  // ---- Render ---------------------------------------------------------------------------------

  function render() {
    const s = slot();
    const out = outputOf(modeId, s.output_code);
    const opts = modeOptions(input.type, out?.type);
    const m = effectiveMode(input.type, out?.type, s.output_mode);
    const showThreshold = usesThreshold(input.type, out?.type, m);
    const showStatic = usesStaticOutput(input.type, out?.type, m);
    const analog = isAnalogInput(input.type);

    // Header: input → output (the output is the button that opens the picker).
    const outBtn = h('button.inp-out-btn', {
      type: 'button', 'aria-expanded': String(pickerOpen), onclick: () => { pickerOpen = !pickerOpen; render(); },
    },
    glyph(out ? out.label : 'Off', { shape: 'square', size: 44, off: !out }),
    h('span.inp-out-text',
      h('span.inp-out-label', out ? outputName(out.label) : t('Nothing')),
      h('span.inp-out-kind', out ? t(out.hint || OUTPUT_TYPE_LABEL[out.type]) : t('Input disabled in this mode'))),
    h('span.inp-out-change', t('Change'), icon('chevron-down')));

    const head = h('div.inp-ed-head',
      h('div.inp-ed-in', glyph(input.name, { size: 44 }),
        h('span.inp-out-text', h('span.inp-out-label', input.label), h('span.inp-out-kind', t(INPUT_TYPE_LABEL[input.type])))),
      h('span.inp-ed-arrow', icon('chevron-down'), t('sends in {mode} mode', { mode: mode.label })),
      outBtn);

    // Live view of the focused input.
    liveMeter = meter({ large: true, label: t('{input} live value', { input: input.label }) });
    liveText = h('span.inp-live-val', pctText(0));
    livePressed = badge(t('Released'), null);
    liveMeter.mark(showThreshold && m === OUTPUT_MODE.THRESHOLD ? s.threshold_delta / ANALOG_FULL : null);
    const liveBlock = h('div.inp-live',
      h('div.inp-live-head', h('span.inp-live-title', t('Live'), infoTip(t('What the controller reports for this input with the current settings. Press it to test.'))),
        livePressed, h('span.spacer'), liveText),
      liveMeter);

    const parts = [head, pickerOpen && picker(s.output_code), liveBlock];

    if (opts.length) {
      parts.push(field({
        label: t('Mode'), stacked: true,
        description: t(MODE_HELP[m]),
        control: segmented({
          options: opts.map((v) => ({ value: v, label: t(MODE_LABEL[v]) })), value: m, tone: 'lavender', ariaLabel: t('Analog mode'),
          onChange: (v) => { write({ output_mode: v }); render(); },
        }),
      }));
    } else if (analog && !out) {
      parts.push(h('p.muted.small', t('Pick an output to set how this analog input behaves.')));
    }

    if (showThreshold) {
      const isRapid = m === OUTPUT_MODE.RAPID;
      parts.push(field({
        label: isRapid ? t('Rapid trigger sensitivity') : t('Activation point'), stacked: true,
        tip: isRapid
          ? t('How far it has to travel to change state: down this much to press, back up this much to release. Smaller = quicker re-presses, but more sensitive to light touches.')
          : t('How far you press before it counts. {half} is halfway down.', { half: pctText(50) }),
        description: isRapid ? t('Travel needed to press or release.') : t('How far down it must go to count as pressed.'),
        control: slider({
          min: 1, max: 99, step: 1, unit: '%', value: toPct(s.threshold_delta), tone: 'lavender',
          ariaLabel: isRapid ? t('Rapid trigger sensitivity') : t('Activation point'),
          onInput: (v) => {
            write({ threshold_delta: fromPct(v) });
            if (!isRapid) liveMeter.mark(fromPct(v) / ANALOG_FULL);
          },
        }),
      }));
    }

    if (showStatic) {
      const gcTrigger = modeId === 'gamecube' && out.type === OUTPUT_TYPE.HOVER;
      parts.push(field({
        label: t('Output when pressed'), stacked: true,
        description: t('How far {output} is pushed when this input fires.', { output: outputName(out.label) }),
        tip: gcTrigger ? t('In GameCube mode, analog triggers driven this way always output at least {min} (the console\'s resting minimum).', { min: pctText(toPct(GAMECUBE_MIN_ANALOG)) }) : null,
        control: slider({
          min: 0, max: 100, step: 1, unit: '%', value: toPct(s.static_output), tone: 'lavender', ariaLabel: t('Output when pressed'),
          onInput: (v) => write({ static_output: fromPct(v) }),
        }),
      }));
    }

    if (input.type === INPUT_TYPE.HOVER) parts.push(calibrateRow());

    if (analog && out) {
      parts.push(h('div.row.inp-ed-tools',
        button({ label: t('Copy settings'), icon: 'copy', size: 'sm', variant: 'ghost', onClick: copySettings }),
        button({ label: t('Paste settings'), icon: 'download', size: 'sm', variant: 'ghost', onClick: pasteSettings }),
        infoTip(t('Copy this input\'s mode and values, then paste them onto another analog input.'))));
    }

    el.replaceChildren(...parts.filter(Boolean));
  }

  // Per-input calibration (hall-effect inputs only), shares state with the calibration tab.
  let calibBtn = null;
  function calibrateRow() {
    calibBtn = button({ size: 'sm', variant: 'tonal', icon: 'calibrate', label: t('Calibrate'),
      onClick: async () => {
        calibBtn.disabled = true;
        if (calib.active === input.code) await calib.stop();
        else await calib.start(input.code);
        paintCalib();
      } });
    const row = field({
      label: t('Calibration'),
      description: t('Press Calibrate, push it all the way down and release 3–4 times, then press Finish.'),
      control: calibBtn,
    });
    paintCalib();
    return row;
  }
  function paintCalib() {
    if (!calibBtn) return;
    const mine = calib.active === input.code;
    calibBtn.disabled = calib.active != null && !mine;
    calibBtn.className = `btn btn-sm ${mine ? 'btn-warning' : 'btn-tonal'}`;
    calibBtn.setLabel(mine ? t('Finish') : calib.active === 'all' ? t('Calibrating all…') : t('Calibrate'));
  }
  const offCalib = calib.on(paintCalib);

  render();

  return {
    el,
    title: t('{input} in {mode} mode', { input: input.label, mode: mode.label }),
    /** Paint the live meter from the focused-input field of a raw report (0..4095). */
    live(focused) {
      if (!focused || !liveMeter) return;
      const f = focused.value / 4095;
      liveMeter.set(f, focused.pressed);
      const pct = pctText(Math.round(f * 100));
      if (liveText.textContent !== pct) liveText.textContent = pct;
      const label = focused.pressed ? t('Pressed') : t('Released');
      if (livePressed.textContent !== label) {
        livePressed.textContent = label;
        livePressed.className = `badge ${focused.pressed ? 'tone-green' : ''}`.trim();
      }
    },
    refresh: render,
    /** @param {{keepCalibration?: boolean}} [opts] keep calibrating when the same input is re-opened */
    async destroy({ keepCalibration = false } = {}) {
      offCalib();
      // Leaving the editor ends this input's calibration (hoja2 stopped calibration on close).
      if (!keepCalibration && calib.active === input.code) await calib.stop();
    },
  };
}
