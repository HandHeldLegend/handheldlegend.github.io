/**
 * Firmware — update the connected controller, install HOJA on a blank board, and recovery tools.
 *
 * The flashing itself lives in src/firmware/ (updater.js state machine + picoboot.js protocol);
 * this page is the friendly front door to it. Deep link: #/firmware?build=<id> preselects a build
 * in the installer.
 */
import { h, replace, fillNodes } from '../../ui/dom.js';
import { icon } from '../../ui/icons.js';
import { card, button, asyncButton, callout, kv, badge } from '../../ui/controls.js';
import { connectController } from '../../app/shell.js';
import { listBuilds, NUKE_BUILD } from '../../firmware/builds.js';
import {
  firmwareStatus, openUpdateWizard, openInstallWizard, checkForFirmwareUpdate, exitBootloader, formatFwVersion,
} from '../../firmware/updater.js';
import { t, N_ } from '../../i18n/index.js';

const STATUS_TEXT = {
  unknown: [N_('Not checked'), null],
  checking: [N_('Checking…'), 'lavender'],
  current: [N_('Up to date'), 'green'],
  available: [N_('Update available'), 'blue'],
  offline: [N_('Offline — can’t check'), 'yellow'],
};

function controllerCard(session) {
  if (!session.connected) {
    return card({ title: t('Update your controller'), icon: 'download', tone: 'blue', subtitle: t('Connect to check for new firmware.') },
      h('p.muted', t('Updates are checked automatically every time you connect. Firmware downloads need an internet connection.')),
      h('div.row', button({ label: t('Connect controller'), icon: 'usb', variant: 'primary', onClick: connectController })));
  }
  const s = firmwareStatus();
  const [label, tone] = STATUS_TEXT[s.state] || STATUS_TEXT.unknown;
  return card({ title: session.info.name, icon: 'firmware', tone: 'blue', subtitle: t('Firmware on this controller'), actions: badge(t(label), tone) },
    kv([
      [t('Installed build'), formatFwVersion(session.info.fwVersion)],
      s.latest && [t('Latest build'), formatFwVersion(s.latest)],
      session.info.manualUrl && [t('Manual'), h('a', { href: session.info.manualUrl, target: '_blank', rel: 'noopener' }, t('Open manual'), ' ', icon('external'))],
    ]),
    h('div.row',
      s.state === 'available'
        ? button({ label: t('Update now'), icon: 'download', variant: 'primary', onClick: () => openUpdateWizard() })
        : button({ label: t('Reinstall firmware'), icon: 'download', variant: 'tonal', onClick: () => openUpdateWizard() }),
      asyncButton({ label: t('Check again'), icon: 'refresh', variant: 'ghost', busyLabel: t('Checking…'), okLabel: t('Checked'),
        run: async () => { await checkForFirmwareUpdate(); return true; } })));
}

function installCard(params) {
  return card({ title: t('Install HOJA on a blank board'), icon: 'sparkle', tone: 'lavender', subtitle: t('For new builds, or a controller that won’t start.') },
    h('ol.tips',
      h('li', t('Unplug the controller (and remove the battery if it has one).')),
      h('li', fillNodes(t('Hold the {bootsel} button (or bridge the boot pads) and plug it in. A drive named {drive} or {drive2} appears.'),
        { bootsel: h('strong', 'BOOTSEL'), drive: h('strong', 'RPI-RP2'), drive2: h('strong', 'RP2350') })),
      h('li', fillNodes(t('Press {button} and pick the “RP2 Boot” device. The installer opens automatically.'), { button: h('strong', t('Select bootloader')) }))),
    h('div.row',
      button({ label: t('Select bootloader'), icon: 'usb', variant: 'primary', onClick: connectController }),
      button({ label: t('Open installer'), icon: 'firmware', variant: 'tonal', onClick: () => openInstallWizard(params.build) })),
    callout({ tone: 'yellow', title: t('Pick the right build.'), text: t('Installing firmware made for different hardware can stop the controller working until it’s re-flashed from BOOTSEL.') }));
}

function recoveryCard() {
  return card({ title: t('Recovery'), icon: 'warning', tone: 'red', subtitle: t('Only needed if something went wrong.') },
    h('p.muted.small', t('Stuck in the bootloader after an interrupted update? Restart it, or reinstall from the installer. If the board misbehaves even after reinstalling, choose “{nuke}” in the installer to wipe all settings, then install your build again.', { nuke: t(NUKE_BUILD.label) })),
    h('div.row', asyncButton({ label: t('Restart from bootloader'), icon: 'refresh', variant: 'tonal', busyLabel: t('Restarting…'), okLabel: t('Restarted'), run: exitBootloader })));
}

function downloadsCard() {
  const list = h('div.build-list', h('span.muted.small', t('Loading…')));
  listBuilds().then(({ builds, offline }) => {
    replace(list,
      offline && callout({ tone: 'yellow', text: t('You’re offline — downloads need an internet connection.') }),
      h('div.build-grid', builds.map((b) => h('a.build-link', { href: b.uf2Url, download: '', rel: 'noopener' }, icon('download'), h('span', b.label)))));
  });
  return card({ title: t('Manual downloads'), icon: 'download', tone: 'green', subtitle: t('UF2 files you can copy onto the RPI-RP2 drive yourself.') }, list);
}

export function mount(root, { session, params }) {
  const style = h('style', `
    .build-grid { display: grid; gap: 8px; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); }
    .build-link { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: var(--radius-md);
      background: var(--surface-2); color: var(--text); text-decoration: none; font-weight: 600; font-size: var(--text-sm);
      transition: background-color var(--dur-med); }
    .build-link:hover { background: var(--green-soft); color: var(--text); }
    .build-link .icon { color: var(--green); }`);
  const slot = h('div');
  const render = () => slot.replaceChildren(controllerCard(session));
  render();
  root.append(style, slot, installCard(params), recoveryCard(), downloadsCard());
  const offs = [session.on('firmware', render), session.on('state', render)];
  return () => offs.forEach((f) => f());
}
