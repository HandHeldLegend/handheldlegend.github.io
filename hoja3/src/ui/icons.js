/**
 * icons.js — Line icons from the SVG sprite at assets/icons/ui.svg.
 *
 *   icon('gamepad')            -> <svg class="icon"><use href="assets/icons/ui.svg#i-gamepad"/></svg>
 *   icon('warning', 'icon-lg')
 *
 * The sprite is precached by the service worker, so icons work offline. See
 * assets/icons/preview.html for the full catalog.
 */
const SPRITE = new URL('../../assets/icons/ui.svg', import.meta.url).pathname;
const NS = 'http://www.w3.org/2000/svg';

export function icon(name, extraClass = '') {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', `icon ${extraClass}`.trim());
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const use = document.createElementNS(NS, 'use');
  use.setAttribute('href', `${SPRITE}#i-${name}`);
  svg.append(use);
  return svg;
}
