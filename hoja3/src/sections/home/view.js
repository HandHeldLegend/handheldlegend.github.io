/**
 * Home — connect hero (disconnected) or device overview (connected), plus the section grid.
 */
import { h, replace, fillNodes } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { button, card, callout, badge, face, kv } from '../../ui/controls.js';
import { SECTIONS } from '../registry.js';
import { connectController, unavailableReason } from '../../app/shell.js';
import { startDemo, isDemo } from '../../device/mock.js';
import { firmwareStatus, openUpdateWizard, formatFwVersion } from '../../firmware/updater.js';
import { t } from '../../i18n/index.js';

function tiles(session) {
  return h('div.tiles', SECTIONS.filter((s) => s.id !== 'home').map((s) => {
    const reason = unavailableReason(s);
    const att = session.attention[s.id];
    return h('a.tile', {
      href: `#/${s.id}`, class: [`tone-${s.tone}`, reason && session.connected ? 'disabled' : null, reason && !session.connected ? 'waiting' : null].filter(Boolean),
      title: reason || t(s.summary),
    },
    face(s.icon, s.tone, 42),
    h('div', h('div.tile-title', t(s.title)), h('div.tile-sub', t(s.summary))),
    att && h('span.tile-badge', badge(att.level === 'warn' ? t('Needs attention') : t('Update'), att.level === 'warn' ? 'yellow' : 'blue')));
  }));
}

function hero() {
  const webusb = !!navigator.usb;
  return h('section.hero',
    h('div',
      h('h1', t('Let’s set up your controller')),
      h('p', t('Plug your HOJA controller in with a USB data cable, then connect. Everything you change applies instantly — press Save to keep it.')),
      h('div.hero-actions',
        button({ label: t('Connect controller'), icon: 'usb', variant: 'primary', size: 'lg', disabled: !webusb, onClick: connectController }),
        button({ label: t('Try the demo'), icon: 'play', variant: 'ghost', size: 'lg', onClick: () => startDemo() })),
      !webusb && h('div', { style: { marginTop: '16px' } }, callout({ tone: 'red', title: t('USB isn’t available in this browser.'), text: t('Use Chrome, Edge or another Chromium browser on desktop or Android. iPhone and iPad browsers can’t connect to controllers yet — but the Arena and demo work.') }))),
    h('img.hero-art', { src: 'assets/icons/app/icon-512.png', alt: '' }));
}

function connectTips() {
  return card({ title: t('Having trouble connecting?'), icon: 'help', tone: 'blue' },
    h('ul.tips',
      h('li', fillNodes(t('Hold {a} (or the {south} button) while plugging in to start the controller in config mode.'), { a: h('strong', 'A'), south: h('strong', t('South')) })),
      h('li', t('Use a cable that carries data — many charge-only cables don’t.')),
      h('li', t('Only Switch and Steam modes talk to this app. If you changed the default mode, hold A while plugging in.')),
      h('li', fillNodes(t('Blank board or bricked? Hold BOOTSEL while plugging in, then open {firmware} to install HOJA.'), { firmware: h('a', { href: '#/firmware' }, t('Firmware')) }))));
}

function deviceCard(session) {
  const fw = firmwareStatus();
  const updateBtn = fw.state === 'available'
    ? button({ label: t('Update firmware'), icon: 'download', variant: 'primary', onClick: () => openUpdateWizard() })
    : button({ label: t('Firmware'), icon: 'firmware', variant: 'tonal', onClick: () => { location.hash = '#/firmware'; } });
  const atts = Object.entries(session.attention);
  return card({ class: 'device-card' },
    h('div.device-head',
      face('gamepad', 'lavender', 56),
      h('div', { style: { flex: 1, minWidth: 0 } },
        h('div.device-name.ellipsis', session.info.name),
        h('div.row', { style: { '--gap': '8px', marginTop: '4px' } },
          badge(isDemo() ? t('Demo controller') : t('Connected'), isDemo() ? 'lavender' : 'green'),
          fw.state === 'available' && badge(t('Update available'), 'blue'),
          fw.state === 'current' && badge(t('Firmware up to date'), 'green'))),
      updateBtn),
    kv([
      session.info.maker && [t('Maker'), session.info.maker],
      [t('Firmware build'), formatFwVersion(session.info.fwVersion)],
    ]),
    atts.map(([id, a]) => callout({ tone: a.level === 'warn' ? 'yellow' : 'blue', text: `${t(a.text)} ` },
      h('a', { href: `#/${id}` }, t('Open'), icon('chevron-right')))));
}

export function mount(root, { session }) {
  const render = () => {
    replace(root,
      session.connected ? deviceCard(session) : hero(),
      !session.connected && connectTips(),
      h('h2.section-heading', { style: { marginTop: '8px' } }, session.connected ? t('Configure') : t('Explore')),
      tiles(session));
  };
  render();
  const offs = [session.on('attention', render), session.on('firmware', render)];
  return () => offs.forEach((f) => f());
}
