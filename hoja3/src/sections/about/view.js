/**
 * Help & about — quick troubleshooting, links, version info and third-party attributions.
 */
import { h, fillNodes } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { card, kv, button } from '../../ui/controls.js';
import { pwa, loadVersion } from '../../app/pwa.js';
import { LAYOUT } from '../../device/struct.js';
import { ATTRIBUTIONS } from './attributions.js';
import { t, N_ } from '../../i18n/index.js';

const WHATS_NEW = 'https://docs.handheldlegend.com/s/portal/doc/whats-new-xmtMoBg2Pu';

const FAQ = [
  [N_('The controller won’t connect'), N_('Hold A (South) while plugging it in, use a data-capable USB cable, and close other tabs or apps using the controller. Only Switch and Steam modes talk to this app.')],
  [N_('My browser says USB isn’t supported'), N_('Use Chrome, Edge, Opera or another Chromium browser on Windows, macOS, Linux, ChromeOS or Android. Safari, Firefox and all iOS browsers don’t support WebUSB.')],
  [N_('My changes disappeared after unplugging'), N_('Changes apply instantly but are only stored when you press Save. The Save button glows yellow while there are unsaved changes.')],
  [N_('The stick drifts or doesn’t reach the corners'), N_('Open Joysticks and run calibration. Then check the deadzone. The Arena’s Input lab shows exactly what the controller reports.')],
  [N_('A firmware update was interrupted'), N_('Hold BOOTSEL while plugging in, then open Firmware → Install and pick your controller. Your board is very hard to permanently brick.')],
];

function link(href, text) {
  return h('a', { href, target: '_blank', rel: 'noopener' }, text, ' ', icon('external'));
}

export function mount(root) {
  const version = h('span', pwa.version || '…');
  loadVersion().then((v) => { version.textContent = v || 'dev'; });

  root.append(
    card({ title: t('Quick help'), icon: 'help', tone: 'blue' },
      h('div.faq', FAQ.map(([q, a]) => h('details', h('summary', t(q)), h('p.muted', t(a)))))),

    card({ title: t('About'), icon: 'info', tone: 'lavender' },
      h('p', fillNodes(t('{app} configures, calibrates and updates controllers running HOJA firmware from Hand Held Legend. It runs entirely in your browser and works offline once installed.'), { app: h('strong', 'HHL Gamepad Config') })),
      kv([
        [t('App version'), version],
        [t('Firmware layout'), `HOJA-LIB-RP2040 @ ${LAYOUT.source?.ref ?? t('unknown')}`],
      ]),
      h('div.row',
        button({ label: t('What’s new'), icon: 'sparkle', variant: 'tonal', onClick: () => window.open(WHATS_NEW, '_blank', 'noopener') }),
        link('https://handheldlegend.com', 'handheldlegend.com'),
        link('https://github.com/HandHeldLegend/HOJA-LIB-RP2040', t('Firmware source')))),

    card({ title: t('For AI assistants'), icon: 'link', tone: 'green', subtitle: t('Let an assistant help you set up your controller.') },
      h('p.muted.small', fillNodes(t('Every page and many settings can be opened with a link. Assistants can read the guide at {guide} or use the HHL Gamepad Config MCP server to build links for you. Links that change settings always ask you to confirm first.'),
        { guide: h('a', { href: 'llms.txt', target: '_blank' }, 'llms.txt') }))),

    card({ title: t('Attributions'), icon: 'sparkle', tone: 'red', subtitle: t('Made possible by these people and projects.') },
      h('ul.attributions', ATTRIBUTIONS.map((a) => h('li',
        h('div', h('strong', a.name), ' — ', a.author, ' · ', h('span.badge', a.license)),
        h('div.muted.small', t(a.usedFor), ' · ', h('a', { href: a.url, target: '_blank', rel: 'noopener' }, t('source')))))),
      h('p.faint.xs', t('Super Famicom-inspired colors are a tribute; this app is not affiliated with or endorsed by Nintendo.'))),
  );

  root.append(h('style', `
    .faq details { border-bottom: 1px dashed var(--border); padding: 10px 0; }
    .faq details:last-child { border-bottom: 0; }
    .faq summary { cursor: pointer; font-weight: 600; list-style: none; display: flex; justify-content: space-between; gap: 12px; }
    .faq summary::after { content: "+"; color: var(--text-muted); font-weight: 700; transition: transform var(--dur-med) var(--ease-out); }
    .faq details[open] summary::after { transform: rotate(45deg); }
    .faq details p { margin-top: 6px; font-size: var(--text-sm); }
    .attributions { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
    .attributions li { min-width: 0; overflow-wrap: anywhere; }
    .attributions .badge { white-space: normal; }
  `));
}
