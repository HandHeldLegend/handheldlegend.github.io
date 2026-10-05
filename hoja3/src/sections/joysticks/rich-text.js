/**
 * rich-text.js — Translate a whole sentence that contains inline elements (e.g. bold button names).
 *
 *   richText('Press {finish}, then check the result.', { finish: h('strong', t('Finish')) })
 *
 * The sentence is translated as one string (so translators can move the {placeholders}); each
 * placeholder is then replaced by its node. Placeholders without a node are left as text.
 */
import { t } from '../../i18n/index.js';

/** @returns {Array<string|Node>} children for h(). */
export function richText(text, nodes) {
  return t(text).split(/\{(\w+)\}/).map((part, i) => (i % 2 ? (nodes[part] ?? `{${part}}`) : part)).filter((x) => x !== '');
}
