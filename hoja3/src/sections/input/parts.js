/**
 * parts.js — Small widgets used across the Input section: glyphs and live meters.
 */
import { h, clamp } from '../../ui/dom.js';
import { t } from '../../i18n/index.js';
import { glyphUrl, TRANSLATED_LABELS } from './mapping.js';

/**
 * Display text for an output label or a build's input name. Labels double as glyph names, so the
 * data stays English; descriptive ones ('D Up', 'Capture', 'South'…) are translated here, while
 * names printed on the hardware (A, ZL, Start, Home…) are shown unchanged.
 */
export const outputName = (label) => (TRANSLATED_LABELS.has(label) ? t(label) : label);

/**
 * Turn a translated sentence with {placeholders} into DOM children, so parts of it can be markup
 * while the sentence stays whole for translators: rich(t(…), { button: h('strong', …) }).
 */
export function rich(text, nodes) {
  return text.split(/(\{\w+\})/).filter(Boolean).map((part) => {
    const k = part.match(/^\{(\w+)\}$/)?.[1];
    return k && k in nodes ? nodes[k] : part;
  });
}

/**
 * A button glyph for a label. Glyph PNGs are white-on-transparent, so they are drawn as a CSS mask
 * filled with `currentColor` — that way they follow the theme (and tone) instead of vanishing in
 * light mode. Labels without a glyph render as a text chip of the same size.
 * @param {string} label
 * @param {{shape?: 'circle'|'square', size?: number, off?: boolean}} [o]
 *   shape only affects the text fallback (inputs are circles, outputs squares, like hoja2).
 * @returns {HTMLElement & {set: (label: string, off?: boolean) => void}}
 */
export function glyph(label, o = {}) {
  const el = h('span.inp-glyph', { class: o.shape || 'circle', style: o.size ? { '--g': `${o.size}px` } : null, 'aria-hidden': 'true' });
  el.set = (text, off = false) => {
    const url = glyphUrl(off ? 'disabled' : text);
    el.classList.toggle('off', off);
    el.classList.toggle('chip', !url);
    el.replaceChildren(url
      ? h('span.glyph', { style: { '--glyph': `url("${url}")` } })
      : h('span.glyph-text', text || '?'));
  };
  el.set(label, !!o.off);
  return el;
}

/**
 * Horizontal live meter. `set(fraction, pressed)` paints the fill (0..1) and pressed color;
 * `mark(fraction|null)` shows a threshold marker. Writes are skipped when nothing changed, because
 * reports arrive at ~125 Hz for every input.
 * @param {{large?: boolean, label?: string}} [o]
 */
export function meter(o = {}) {
  const markEl = h('span.inp-meter-mark');
  const el = h('div.inp-meter', { class: o.large ? 'lg' : null, role: 'meter', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-label': o.label },
    h('span.inp-meter-fill'), markEl);
  let lastV = -1;
  let lastP = null;
  el.set = (fraction, pressed) => {
    const v = Math.round(clamp(fraction, 0, 1) * 1000) / 1000;
    if (v !== lastV) { el.style.setProperty('--v', v); el.setAttribute('aria-valuenow', Math.round(v * 100)); lastV = v; }
    if (pressed !== lastP) { el.classList.toggle('pressed', !!pressed); lastP = pressed; }
  };
  el.mark = (fraction) => {
    el.classList.toggle('has-mark', fraction != null);
    if (fraction != null) el.style.setProperty('--m', clamp(fraction, 0, 1));
  };
  el.set(0, false);
  return el;
}
