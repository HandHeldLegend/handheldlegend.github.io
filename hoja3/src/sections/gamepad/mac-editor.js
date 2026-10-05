/**
 * mac-editor.js — Six hex-byte boxes for the controller's base MAC address
 * (port of hoja2/components/mac-address-selector.js).
 *
 *   const ed = macEditor({ value: [0x7c, 0xbb, ...], onChange: (bytes) => ... });
 *   ed.value = bytes;    // set without firing onChange
 *
 * Behavior kept from hoja2: hex-only, uppercase, auto-advance after two digits, Backspace on an
 * empty box and ←/→ move between boxes, focus selects the byte, pasting a whole address fills all
 * six boxes, and short bytes are zero-padded ("A" → "0A").
 * Difference: onChange fires once per committed edit (blur / Enter / paste) rather than on every
 * keystroke, so half-typed bytes aren't written to the controller.
 */
import { h } from '../../ui/dom.js';
import { t } from '../../i18n/index.js';

const hex2 = (n) => (Number(n) & 0xff).toString(16).toUpperCase().padStart(2, '0');

/**
 * @param {{value: ArrayLike<number>, onChange?: (bytes: number[]) => void}} o
 */
export function macEditor(o) {
  const inputs = Array.from({ length: 6 }, (_, i) => h('input.input.mono.mac-byte', {
    type: 'text', maxLength: 2, spellcheck: false, autocomplete: 'off', inputmode: 'text',
    autocapitalize: 'characters', 'aria-label': t('MAC byte {n} of 6', { n: i + 1 }),
  }));
  const el = h('div.mac-editor', { role: 'group', 'aria-label': t('MAC address') },
    inputs.flatMap((inp, i) => (i ? [h('span.mac-sep', { 'aria-hidden': 'true' }, ':'), inp] : [inp])));

  let committed = '';
  const bytes = () => inputs.map((inp) => parseInt(inp.value || '0', 16) & 0xff);
  const paint = (arr) => inputs.forEach((inp, i) => { inp.value = hex2(arr[i] ?? 0); });
  const commit = () => {
    const b = bytes();
    paint(b); // normalize padding/case
    const key = b.join(',');
    if (key === committed) return;
    committed = key;
    o.onChange?.(b);
  };
  const focus = (i) => { const box = inputs[i]; if (box) { box.focus(); box.select(); } };

  inputs.forEach((inp, i) => {
    inp.addEventListener('input', () => {
      const clean = inp.value.toUpperCase().replace(/[^0-9A-F]/g, '').slice(0, 2);
      if (clean !== inp.value) inp.value = clean;
      if (clean.length === 2 && i < 5) focus(i + 1);
    });
    inp.addEventListener('focus', () => inp.select());
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && inp.value === '' && i > 0) { e.preventDefault(); focus(i - 1); }
      else if (e.key === 'ArrowLeft' && i > 0 && inp.selectionStart === 0) { e.preventDefault(); focus(i - 1); }
      else if (e.key === 'ArrowRight' && i < 5 && inp.selectionEnd === inp.value.length) { e.preventDefault(); focus(i + 1); }
      else if (e.key === 'Enter') { inp.blur(); commit(); }
    });
    inp.addEventListener('paste', (e) => {
      const text = (e.clipboardData || window.clipboardData)?.getData('text') || '';
      const digits = text.replace(/[^0-9a-f]/gi, '').toUpperCase();
      if (digits.length <= 2) return; // a single byte: let the browser paste it normally
      e.preventDefault();
      const parts = digits.match(/.{1,2}/g) || [];
      parts.slice(0, 6 - i).forEach((p, k) => { inputs[i + k].value = p; });
      commit();
    });
  });
  // Commit when focus leaves the whole group, not when hopping between boxes.
  el.addEventListener('focusout', (e) => { if (!el.contains(e.relatedTarget)) commit(); });

  const set = (arr) => { paint(Array.from(arr)); committed = bytes().join(','); };
  set(o.value);
  Object.defineProperty(el, 'value', { get: bytes, set });
  return el;
}

/** Format bytes as "7C:BB:8A:12:34:56". */
export const formatMac = (arr) => Array.from(arr, hex2).join(':');
