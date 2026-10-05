/**
 * App settings — theme, motion, update behavior, install, offline status and app reset.
 * Deep link: #/settings?theme=dark|light|system applies the theme.
 */
import { h } from '../../ui/dom.js';
import { card, field, segmented, toggle, select, button, asyncButton, callout, kv, badge } from '../../ui/controls.js';
import { confirmDialog, toast } from '../../ui/overlay.js';
import { prefs } from '../../app/prefs.js';
import { pwa } from '../../app/pwa.js';
import { isDemo, startDemo, stopDemo } from '../../device/mock.js';
import { DEBUG, debugForceUpdate } from '../../firmware/updater.js';
import { t, N_, LANGUAGES, detectLanguage } from '../../i18n/index.js';

const THEMES = [
  { value: 'dark', label: N_('Dark'), icon: 'moon' },
  { value: 'light', label: N_('Light'), icon: 'sun' },
  { value: 'system', label: N_('System'), icon: 'system' },
];

function appearanceCard() {
  const theme = segmented({ options: THEMES.map((o) => ({ ...o, label: t(o.label) })), value: prefs.get('theme'), ariaLabel: t('Theme'), onChange: (v) => prefs.set('theme', v) });
  const off = prefs.on('theme', (v) => { theme.value = v; });
  const motion = toggle({ checked: prefs.get('reduceMotion') === 'on', label: t('Reduce motion'), onChange: (v) => prefs.set('reduceMotion', v ? 'on' : 'system') });
  const auto = LANGUAGES.find((l) => l.code === detectLanguage());
  const language = select({
    options: [{ value: 'auto', label: t('Automatic ({language})', { language: auto.native }) }, ...LANGUAGES.map((l) => ({ value: l.code, label: l.native }))],
    value: prefs.get('language') || 'auto', ariaLabel: t('Language'),
    onChange: (v) => prefs.set('language', v),
  });
  const el = card({ title: t('Appearance'), icon: 'palette', tone: 'lavender' },
    field({ label: t('Language'), description: t('Automatic uses your device’s language. Translations are new — tell us if something reads oddly.'), control: language }),
    field({ label: t('Theme'), description: t('Dark is the default. System follows your device’s setting.'), control: theme }),
    field({ label: t('Reduce motion'), description: t('Turns off decorative animation. Your device’s reduced-motion setting is always respected.'), control: motion }));
  el.cleanup = off;
  return el;
}

function behaviorCard() {
  const demoBtn = button({ label: isDemo() ? t('Stop demo') : t('Start demo'), icon: 'play', variant: 'tonal',
    onClick: async () => { if (isDemo()) stopDemo(); else await startDemo(); demoBtn.setLabel(isDemo() ? t('Stop demo') : t('Start demo')); } });
  return card({ title: t('Controller'), icon: 'gamepad', tone: 'blue' },
    field({ label: t('Check for firmware updates'), description: t('When a controller connects, look online for newer firmware.'),
      control: toggle({ checked: prefs.get('autoUpdateCheck') !== false, label: t('Check for firmware updates'), onChange: (v) => prefs.set('autoUpdateCheck', v) }) }),
    field({ label: t('Demo controller'), description: t('Explore every page with a simulated controller — nothing is sent to hardware.'),
      control: demoBtn }),
    DEBUG && field({ label: t('Debug: force update prompt'), description: t('Shows the firmware update flow on connect even when up to date.'),
      control: toggle({ checked: debugForceUpdate.get(), onChange: (v) => debugForceUpdate.set(v) }) }));
}

function installCard() {
  let body;
  if (pwa.standalone) {
    body = callout({ tone: 'green', text: t('You’re using the installed app. It works offline and updates itself.') });
  } else if (pwa.canInstall) {
    body = h('div.row', h('p.muted', { style: { flex: '1 1 240px' } }, t('Install for a full-screen app that opens from your home screen or Start menu and works offline.')),
      button({ label: t('Install app'), icon: 'install', variant: 'primary', onClick: () => pwa.promptInstall() }));
  } else if (pwa.isIOS) {
    body = h('p.muted', t('On iPhone or iPad: tap the Share button, then “Add to Home Screen”. (iOS browsers can’t connect to USB controllers, but the Arena works.)'));
  } else {
    body = h('p.muted', t('Use your browser’s menu → “Install app” (Chrome / Edge) to add HHL Gamepad Config to your device.'));
  }
  return card({ title: t('Install'), icon: 'install', tone: 'green' }, body);
}

function aboutAppCard() {
  const online = badge(navigator.onLine ? t('Online') : t('Offline'), navigator.onLine ? 'green' : 'yellow');
  const sw = navigator.serviceWorker?.controller;
  return card({ title: t('App data & updates'), icon: 'refresh', tone: 'yellow' },
    kv([
      [t('Version'), pwa.version || '…'],
      [t('Network'), online],
      [t('Offline ready'), sw ? t('Yes') : (location.hostname === 'localhost' ? t('Off in development') : t('Not yet'))],
    ]),
    h('div.row',
      asyncButton({ label: t('Check for app update'), icon: 'refresh', variant: 'tonal', busyLabel: t('Checking…'), okLabel: t('Done'),
        run: async () => {
          const found = await pwa.checkForUpdate();
          toast(found ? t('Downloading the update…') : t('You have the latest version.'), { tone: found ? 'blue' : 'green' });
          return true;
        } }),
      button({ label: t('Reset app'), icon: 'trash', variant: 'ghost', onClick: resetApp })));
}

async function resetApp() {
  const ok = await confirmDialog({
    title: t('Reset the app?'), danger: true, confirmLabel: t('Reset app'),
    message: t('This clears the app’s offline files and preferences on this device and reloads. Your controller’s settings are not affected.'),
  });
  if (!ok) return;
  try {
    for (const r of (await navigator.serviceWorker?.getRegistrations()) || []) await r.unregister();
    for (const k of (await caches?.keys()) || []) await caches.delete(k);
    for (const k of Object.keys(localStorage)) if (k.startsWith('hhl-config:')) localStorage.removeItem(k);
  } catch (err) { console.warn(err); }
  location.reload();
}

export function mount(root, { params }) {
  const apply = (p) => { if (['dark', 'light', 'system'].includes(p.theme)) prefs.set('theme', p.theme); };
  apply(params);
  const appearance = appearanceCard();
  root.append(appearance, behaviorCard(), installCard(), aboutAppCard());
  return { destroy: () => appearance.cleanup?.(), update: apply };
}
