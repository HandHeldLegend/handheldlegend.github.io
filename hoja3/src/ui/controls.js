/**
 * controls.js — The shared UI kit. Every factory returns a plain HTMLElement.
 *
 * Conventions:
 *   - Value controls expose `el.value` (get/set without firing callbacks) and call `onChange(value)`
 *     when the *user* changes them. Sliders also call `onInput(value)` while dragging.
 *   - `tone` is one of 'red' | 'yellow' | 'blue' | 'green' | 'lavender' (the SFC splashes).
 *   - Styling lives in css/components.css. Don't add inline colors in sections.
 */
import { h, clamp } from './dom.js';
import { icon } from './icons.js';
import { t, fmt as format } from '../i18n/index.js';

const toneClass = (tone) => (tone ? `tone-${tone}` : null);

// ---------------------------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------------------------

/**
 * @param {{label?: string, icon?: string, variant?: 'primary'|'tonal'|'ghost'|'danger'|'success'|'warning'|'info',
 *          size?: 'sm'|'lg', block?: boolean, title?: string, disabled?: boolean, onClick?: Function, iconOnly?: boolean}} o
 */
export function button(o = {}) {
  const cls = ['btn'];
  if (o.variant) cls.push(`btn-${o.variant}`);
  if (o.size) cls.push(`btn-${o.size}`);
  if (o.block) cls.push('btn-block');
  if (o.iconOnly || (o.icon && !o.label)) cls.push('btn-icon');
  const el = h('button', {
    type: 'button', class: cls, title: o.title, 'aria-label': o.title || o.label,
    disabled: !!o.disabled, onclick: o.onClick,
  }, o.icon && icon(o.icon), o.label && h('span.btn-label', o.label));
  el.setLabel = (text) => { const l = el.querySelector('.btn-label'); if (l) l.textContent = text; };
  return el;
}

/**
 * A button that runs an async task and shows busy → ok/fail feedback (replaces hoja2's
 * single-shot-button). `run` returns truthy for success.
 */
export function asyncButton(o) {
  const el = button(o);
  const label = o.label;
  el.addEventListener('click', async () => {
    if (el.dataset.state === 'busy') return;
    el.dataset.state = 'busy';
    const spin = h('span.spinner.motion-ok');
    el.prepend(spin);
    el.setLabel(o.busyLabel || label);
    let ok = false;
    try { ok = (await o.run()) !== false; } catch (err) { console.error(err); ok = false; }
    spin.remove();
    if (!el.isConnected) return;
    el.dataset.state = ok ? 'ok' : 'fail';
    el.setLabel(ok ? (o.okLabel || label) : (o.failLabel || t('Failed')));
    setTimeout(() => { delete el.dataset.state; el.setLabel(label); }, ok ? 1200 : 1800);
  });
  return el;
}

// ---------------------------------------------------------------------------------------------
// Value controls
// ---------------------------------------------------------------------------------------------

/** Normalize options: ['A','B'] -> [{value:0,label:'A'},...]; objects pass through. */
function normOptions(options) {
  return options.map((o, i) => (typeof o === 'object' ? o : { value: i, label: String(o) }));
}

/**
 * Segmented control (radio group).
 * @param {{options: Array<string|{value:any,label:string,icon?:string,disabled?:boolean}>, value?: any,
 *          onChange?: (v:any)=>void, tone?: string, ariaLabel?: string, disabled?: boolean}} o
 */
export function segmented(o) {
  const opts = normOptions(o.options);
  const thumb = h('span.seg-thumb');
  const el = h('div.seg', { role: 'radiogroup', 'aria-label': o.ariaLabel, class: toneClass(o.tone) }, thumb);
  let current = o.value;

  const buttons = opts.map((opt) => h('button', {
    type: 'button', role: 'radio', 'aria-checked': 'false', disabled: !!(o.disabled || opt.disabled),
    onclick: () => {
      if (opt.value === current) return;
      set(opt.value);
      o.onChange?.(opt.value);
    },
  }, opt.icon && icon(opt.icon), opt.label));
  el.append(...buttons);

  function place() {
    const idx = opts.findIndex((x) => x.value === current);
    buttons.forEach((b, i) => b.setAttribute('aria-checked', String(i === idx)));
    const b = buttons[idx];
    if (!b || !b.offsetWidth) { thumb.style.width = '0'; return; }
    thumb.style.width = `${b.offsetWidth}px`;
    thumb.style.transform = `translateX(${b.offsetLeft}px)`;
  }
  function set(v) { current = v; place(); }

  // Keyboard: arrows move selection like a native radio group.
  el.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    const enabled = opts.filter((x, i) => !buttons[i].disabled);
    const i = enabled.findIndex((x) => x.value === current);
    const next = enabled[clamp(i + (e.key === 'ArrowRight' ? 1 : -1), 0, enabled.length - 1)];
    if (next && next.value !== current) { set(next.value); o.onChange?.(next.value); buttons[opts.indexOf(next)].focus(); }
    e.preventDefault();
  });

  new ResizeObserver(place).observe(el);
  Object.defineProperty(el, 'value', { get: () => current, set });
  set(current);
  return el;
}

/** On/off switch. */
export function toggle(o = {}) {
  const input = h('input', { type: 'checkbox', role: 'switch', checked: !!o.checked, disabled: !!o.disabled, 'aria-label': o.label });
  input.addEventListener('change', () => o.onChange?.(input.checked));
  const el = h('label.switch', { class: toneClass(o.tone) }, input, h('span.track'));
  Object.defineProperty(el, 'value', { get: () => input.checked, set: (v) => { input.checked = !!v; } });
  Object.defineProperty(el, 'disabled', { get: () => input.disabled, set: (v) => { input.disabled = !!v; } });
  return el;
}

/**
 * Slider + numeric box, kept in sync. Layout: [‹] [range] [›] [number][unit].
 * The ‹ › buttons move by exactly `step` (click = one step; press-and-hold repeats and commits once on release).
 * @param {{min:number,max:number,step?:number,value:number,unit?:string,onInput?:Function,onChange?:Function,
 *          tone?:string, disabled?:boolean, decimals?:number, ariaLabel?: string}} o
 */
export function slider(o) {
  const step = o.step ?? 1;
  const decimals = o.decimals ?? (String(step).split('.')[1]?.length || 0);
  let disabled = !!o.disabled;
  const range = h('input', { type: 'range', min: o.min, max: o.max, step, disabled, 'aria-label': o.ariaLabel });
  // A text box (not type=number) so the value shows and accepts the locale's decimal separator ("1,20" in Spanish);
  // both "," and "." are accepted when typing. Clamped and snapped to `step` like the range.
  const num = h('input.input.num', {
    type: 'text', inputmode: decimals ? 'decimal' : 'numeric', autocomplete: 'off', spellcheck: false, disabled,
    role: 'spinbutton', 'aria-valuemin': o.min, 'aria-valuemax': o.max, 'aria-label': o.ariaLabel,
  });
  const stepBtn = (dir) => h('button.slider-step', {
    type: 'button',
    'aria-label': o.ariaLabel
      ? (dir < 0 ? t('Decrease {label}', { label: o.ariaLabel }) : t('Increase {label}', { label: o.ariaLabel }))
      : (dir < 0 ? t('Decrease') : t('Increase')),
  }, icon('chevron-right', dir < 0 ? 'flip' : ''));
  const dec = stepBtn(-1);
  const inc = stepBtn(1);
  const el = h('div.slider', { class: toneClass(o.tone) }, dec, range, inc, h('span.num-wrap', num, o.unit && h('span.unit', o.unit)));

  const show = (v) => format.number(Number(v), { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: false });
  const parse = (text) => {
    const s = String(text).trim().replace(/\s/g, '').replace(',', '.');
    return s === '' || !/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s) ? NaN : Number(s);
  };
  function paint(v) {
    range.value = v;
    num.value = show(v);
    num.setAttribute('aria-valuenow', v);
    range.style.setProperty('--pct', `${((v - o.min) / (o.max - o.min || 1)) * 100}%`);
    dec.disabled = disabled || v <= o.min;
    inc.disabled = disabled || v >= o.max;
  }
  function norm(v) {
    let n = Number(v);
    if (!Number.isFinite(n)) n = o.min;
    n = clamp(Math.round(n / step) * step, o.min, o.max);
    return Number(n.toFixed(decimals));
  }
  let current = norm(o.value);
  paint(current);

  range.addEventListener('input', () => { current = norm(range.value); paint(current); o.onInput?.(current); });
  range.addEventListener('change', () => o.onChange?.(current));
  const commitNum = () => {
    const typed = parse(num.value);
    if (!Number.isFinite(typed)) { paint(current); return; } // not a number: restore the last value
    current = norm(typed); paint(current); o.onInput?.(current); o.onChange?.(current);
  };
  num.addEventListener('change', commitNum);
  num.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') num.blur();
    else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { // like a native number box
      e.preventDefault();
      if (nudge(e.key === 'ArrowUp' ? 1 : -1)) o.onChange?.(current);
    }
  });

  // ‹ › step buttons. Returns true if the value moved.
  const nudge = (dir) => {
    const next = norm(current + dir * step);
    if (next === current) return false;
    current = next;
    paint(current);
    o.onInput?.(current);
    return true;
  };
  let hold = null; // { timer, changed }
  const endHold = () => {
    if (!hold) return;
    clearTimeout(hold.timer);
    clearInterval(hold.timer);
    const { changed } = hold;
    hold = null;
    document.removeEventListener('pointerup', endHold);
    if (changed) o.onChange?.(current);
  };
  for (const [btn, dir] of [[dec, -1], [inc, 1]]) {
    btn.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || btn.disabled) return;
      endHold();
      hold = { changed: nudge(dir), timer: 0 };
      document.addEventListener('pointerup', endHold); // the button may disable itself at min/max mid-hold
      hold.timer = setTimeout(() => {
        if (!hold) return;
        hold.timer = setInterval(() => {
          if (!hold) return;
          if (nudge(dir)) hold.changed = true;
          else endHold(); // reached the limit
        }, 60);
      }, 400);
    });
    for (const type of ['pointerup', 'pointercancel', 'pointerleave', 'blur']) btn.addEventListener(type, endHold);
    // Keyboard (Enter/Space) produces a click with detail 0; pointer clicks are handled above.
    btn.addEventListener('click', (e) => { if (e.detail === 0 && nudge(dir)) o.onChange?.(current); });
  }

  Object.defineProperty(el, 'value', { get: () => current, set: (v) => { current = norm(v); paint(current); } });
  Object.defineProperty(el, 'disabled', {
    get: () => disabled,
    set: (v) => { disabled = !!v; range.disabled = num.disabled = disabled; if (disabled) endHold(); paint(current); },
  });
  return el;
}

/** Compact − value + stepper. */
export function stepper(o) {
  const step = o.step ?? 1;
  const input = h('input', { type: 'number', min: o.min, max: o.max, step, inputmode: 'numeric', 'aria-label': o.ariaLabel });
  let current = clamp(Number(o.value) || 0, o.min, o.max);
  const set = (v, fire) => {
    current = clamp(Math.round(Number(v) / step) * step, o.min, o.max);
    input.value = current;
    if (fire) o.onChange?.(current);
  };
  const el = h('div.stepper',
    h('button', { type: 'button', 'aria-label': t('Decrease'), onclick: () => set(current - step, true) }, icon('minus')),
    input,
    h('button', { type: 'button', 'aria-label': t('Increase'), onclick: () => set(current + step, true) }, icon('plus')));
  input.addEventListener('change', () => set(input.value, true));
  set(current, false);
  Object.defineProperty(el, 'value', { get: () => current, set: (v) => set(v, false) });
  return el;
}

/** Native select. options: strings or {value,label,disabled}. */
export function select(o) {
  const opts = normOptions(o.options);
  const el = h('select.select', { disabled: !!o.disabled, 'aria-label': o.ariaLabel },
    o.placeholder && h('option', { value: '', disabled: true }, o.placeholder),
    opts.map((x, i) => h('option', { value: String(i), disabled: !!x.disabled }, x.label)));
  const toIndex = (v) => opts.findIndex((x) => x.value === v);
  el.addEventListener('change', () => o.onChange?.(opts[Number(el.selectedOptions[0]?.value)]?.value));
  Object.defineProperty(el, 'value', {
    get: () => opts[Number(el.selectedOptions[0]?.value)]?.value,
    set: (v) => { const i = toIndex(v); el.selectedIndex = i < 0 ? -1 : i + (o.placeholder ? 1 : 0); },
  });
  el.value = o.value;
  return el;
}

/** Text input. onChange fires on blur/Enter (not every keystroke). */
export function textInput(o = {}) {
  const el = h('input.input', {
    type: o.type || 'text', value: o.value ?? '', placeholder: o.placeholder, maxLength: o.maxLength,
    spellcheck: false, autocomplete: 'off', class: o.mono ? 'mono' : null, 'aria-label': o.ariaLabel,
    style: o.width ? { width: o.width } : null,
  });
  let last = el.value;
  const commit = () => { if (el.value !== last) { last = el.value; o.onChange?.(el.value); } };
  el.addEventListener('change', commit);
  el.addEventListener('keydown', (e) => { if (e.key === 'Enter') el.blur(); });
  if (o.onInput) el.addEventListener('input', () => o.onInput(el.value));
  return el;
}

/** Color picker: swatch (native picker) + hex text box. Values are '#rrggbb'. */
export function colorField(o) {
  const norm = (v) => {
    let s = String(v || '').trim().replace(/^#/, '');
    if (/^[0-9a-f]{3}$/i.test(s)) s = s.split('').map((c) => c + c).join('');
    return /^[0-9a-f]{6}$/i.test(s) ? `#${s.toLowerCase()}` : null;
  };
  let current = norm(o.value) || '#000000';
  const picker = h('input', { type: 'color', value: current, 'aria-label': o.ariaLabel || t('Pick color') });
  const swatch = h('span.swatch', { style: { background: current } }, picker);
  const hex = h('input.input', { value: current.toUpperCase(), maxLength: 7, spellcheck: false, 'aria-label': t('Hex color') });
  const el = h('div.color-field', swatch, hex);

  const set = (v, fire) => {
    const n = norm(v);
    if (!n) { hex.value = current.toUpperCase(); return; }
    current = n;
    picker.value = n;
    swatch.style.background = n;
    hex.value = n.toUpperCase();
    if (fire) o.onChange?.(n);
  };
  picker.addEventListener('input', () => { set(picker.value, false); o.onInput?.(current); });
  picker.addEventListener('change', () => set(picker.value, true));
  hex.addEventListener('change', () => set(hex.value, true));
  hex.addEventListener('keydown', (e) => { if (e.key === 'Enter') hex.blur(); });
  Object.defineProperty(el, 'value', { get: () => current, set: (v) => set(v, false) });
  return el;
}

// ---------------------------------------------------------------------------------------------
// Layout & display
// ---------------------------------------------------------------------------------------------

/** A labeled setting row. `control` may be any element (or array of elements). */
export function field(o) {
  return h('div.field', { class: o.stacked ? 'stacked' : null, dataset: o.settingKey ? { setting: o.settingKey } : null },
    h('div.field-text',
      h('div.field-label', o.label, o.tip && infoTip(o.tip), o.badge),
      o.description && h('div.field-desc', o.description)),
    h('div.field-control', o.control));
}

/**
 * Card container.
 * @param {{title?: string, subtitle?: string, icon?: string, tone?: string, actions?: Node|Node[],
 *          class?: string, id?: string}} o
 */
export function card(o = {}, ...children) {
  const head = (o.title || o.icon || o.actions) && h('div.card-head',
    o.icon && h('span.face.soft', { style: { '--size': '36px' } }, icon(o.icon)),
    h('div',
      o.title && h('div.card-title', o.title),
      o.subtitle && h('div.card-sub', o.subtitle)),
    o.actions && h('div.card-actions', o.actions));
  return h('section.card', { class: [toneClass(o.tone), o.class].filter(Boolean), id: o.id }, head, children);
}

export function callout(o, ...children) {
  const tone = o.tone || 'blue';
  const ico = o.icon || { red: 'warning', yellow: 'warning', green: 'check', blue: 'info', lavender: 'sparkle' }[tone];
  return h('div.callout', { class: toneClass(tone), role: tone === 'red' ? 'alert' : 'note' },
    icon(ico),
    h('div', o.title && h('strong', o.title, ' '), o.text, children));
}

export function badge(text, tone) {
  return h('span.badge', { class: toneClass(tone) }, text);
}

/** Status dot; `live` adds a soft pulse. */
export function dot(tone, live = false) {
  return h('span.dot', { class: [toneClass(tone), live ? 'live' : null].filter(Boolean) });
}

/** A "?" bubble; text shows on hover, focus or tap (handled globally by overlay.js). */
export function infoTip(text) {
  return h('button.tip', { type: 'button', 'data-tip': text, 'aria-label': text }, '?');
}

/** Progress bar. Returns an element with .set(pct, message) and .busy(bool). */
export function progressBar(o = {}) {
  const fill = h('div.progress-fill');
  const msg = h('span.msg', o.message || '');
  const pct = h('span.pct', format.percent(0));
  const el = h('div.progress', { role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100 },
    h('div.progress-meta', msg, pct), h('div.progress-track', fill));
  el.set = (percent, message) => {
    if (percent != null) {
      const p = clamp(Math.round(percent), 0, 100);
      fill.style.width = `${p}%`;
      pct.textContent = format.percent(p / 100);
      el.setAttribute('aria-valuenow', p);
      el.dataset.indeterminate = 'false';
    }
    if (message != null) msg.textContent = message;
  };
  el.busy = (on) => { el.dataset.active = String(!!on); };
  el.indeterminate = (on, message) => { el.dataset.indeterminate = String(!!on); if (message != null) msg.textContent = message; pct.textContent = on ? '' : pct.textContent; };
  return el;
}

/**
 * Tabs with lazily-rendered panels.
 * @param {{tabs: Array<{id:string,label:string,icon?:string,render:(panel:HTMLElement)=>void|Function}>,
 *          value?: string, onChange?: (id:string)=>void, tone?: string}} o
 * Returns an element with `.select(id)`; each tab's render may return a cleanup fn.
 */
export function tabView(o) {
  const bar = h('div.tabs', { role: 'tablist', class: toneClass(o.tone) });
  const panel = h('div.tab-panel', { role: 'tabpanel' });
  const el = h('div.stack', bar, panel);
  let current = null;
  let cleanup = null;
  const buttons = new Map();
  for (const t of o.tabs) {
    const b = h('button', { type: 'button', role: 'tab', 'aria-selected': 'false', onclick: () => select(t.id, true) },
      t.icon && icon(t.icon), t.label);
    buttons.set(t.id, b);
    bar.append(b);
  }
  function select(id, fire) {
    const tab = o.tabs.find((t) => t.id === id) || o.tabs[0];
    if (current === tab.id) return;
    current = tab.id;
    for (const [k, b] of buttons) b.setAttribute('aria-selected', String(k === tab.id));
    if (typeof cleanup === 'function') cleanup();
    panel.replaceChildren();
    panel.style.animation = 'none'; void panel.offsetWidth; panel.style.animation = '';
    cleanup = tab.render(panel);
    if (fire) o.onChange?.(tab.id);
  }
  el.select = (id) => select(id, false);
  el.destroy = () => { if (typeof cleanup === 'function') cleanup(); };
  Object.defineProperty(el, 'value', { get: () => current });
  select(o.value, false);
  return el;
}

/** Empty state (used e.g. when no controller is connected). */
export function emptyState(o) {
  return h('div.empty', { class: toneClass(o.tone) },
    h('div.empty-art', icon(o.icon || 'gamepad')),
    h('h3', o.title),
    o.text && h('p', o.text),
    o.action);
}

/** Definition list from [[label, value], ...]. */
export function kv(pairs) {
  return h('dl.kv', pairs.filter(Boolean).flatMap(([k, v]) => [h('dt', k), h('dd', v)]));
}

/** Section-icon "face button". */
export function face(iconName, tone, size) {
  return h('span.face', { class: toneClass(tone), style: size ? { '--size': `${size}px` } : null }, icon(iconName));
}
