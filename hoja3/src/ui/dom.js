/**
 * dom.js — A tiny hyperscript helper. No framework, no virtual DOM.
 *
 *   h('div.card.compact', { onclick: fn, dataset: { id: 1 } }, 'text', otherNode, [more, nodes])
 *
 * - The tag may carry `.class` and `#id` shorthands.
 * - Props: `class`/`className` (string or array), `style` (string or object), `dataset` (object),
 *   `on<event>` handlers, `text`, `html` (trusted strings only!), and anything else as an
 *   attribute (booleans toggle the attribute; null/undefined/false are skipped).
 * - Children: nodes, strings, numbers, arrays (flattened); null/false/undefined are skipped.
 */
export function h(tag, props, ...children) {
  if (props instanceof Node || typeof props === 'string' || Array.isArray(props)) {
    children.unshift(props);
    props = null;
  }
  const [, name = 'div', rest = ''] = tag.match(/^([a-z0-9-]*)(.*)$/i);
  const isSvg = name === 'svg' || name === 'use' || name === 'path' || name === 'circle' || name === 'g' ||
    name === 'line' || name === 'rect' || name === 'polyline' || name === 'polygon' || name === 'text' || name === 'ellipse';
  const el = isSvg ? document.createElementNS('http://www.w3.org/2000/svg', name) : document.createElement(name || 'div');

  for (const m of rest.matchAll(/([.#])([\w-]+)/g)) {
    if (m[1] === '.') el.classList.add(m[2]);
    else el.id = m[2];
  }

  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value == null || value === false) continue;
      if (key === 'class' || key === 'className') {
        for (const c of [].concat(value).join(' ').split(/\s+/)) if (c) el.classList.add(c);
      } else if (key === 'style') {
        if (typeof value === 'string') el.style.cssText += value;
        else for (const [k, v] of Object.entries(value)) {
          if (k.startsWith('--')) el.style.setProperty(k, v);
          else el.style[k] = v;
        }
      } else if (key === 'dataset') {
        Object.assign(el.dataset, value);
      } else if (key === 'text') {
        el.textContent = value;
      } else if (key === 'html') {
        el.innerHTML = value;
      } else if (key.startsWith('on') && typeof value === 'function') {
        el.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (key in el && !isSvg && typeof value !== 'string') {
        el[key] = value; // properties like .value, .checked, .disabled
      } else {
        el.setAttribute(key, value === true ? '' : value);
      }
    }
  }
  append(el, children);
  return el;
}

/** Append children (flattening arrays, skipping empties). */
export function append(el, children) {
  for (const c of [].concat(children).flat(Infinity)) {
    if (c == null || c === false || c === true) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

/** Replace all children of `el`. */
export function replace(el, ...children) {
  el.replaceChildren();
  return append(el, children);
}

/** Escape a string for safe interpolation into HTML. */
export function esc(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * Fill {placeholders} in an (already translated) string with nodes, so markup can sit inside one
 * translatable sentence:  fillNodes(translatedText, { drive: h('strong', 'RPI-RP2') })
 * where translatedText is e.g. “Open the drive named {drive}” after t().
 * Returns an array of strings and nodes for h()/append(). Unknown placeholders are left as text.
 */
export function fillNodes(text, nodes = {}) {
  return String(text).split(/(\{\w+\})/).filter(Boolean).map((part) => {
    const m = part.match(/^\{(\w+)\}$/);
    return m && m[1] in nodes ? nodes[m[1]] : part;
  });
}

/** Clamp a number. */
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * Load a stylesheet once (for section-specific CSS that lives next to the view).
 *   loadStyles(new URL('./joysticks.css', import.meta.url))
 */
export function loadStyles(url) {
  const href = String(url);
  if (document.querySelector(`link[data-href="${href}"]`)) return;
  document.head.append(Object.assign(document.createElement('link'), { rel: 'stylesheet', href }));
  document.head.lastElementChild.dataset.href = href;
}
