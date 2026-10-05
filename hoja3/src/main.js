/**
 * main.js — Boot sequence.
 *
 *   1. apply theme prefs (index.html already did a pre-paint pass) and load the active language
 *   2. build the shell and route to the current page
 *   3. wire firmware/bootloader handling, the assistant bridge and the service worker
 *   4. fade out the splash screen
 */
import { apply as applyPrefs } from './app/prefs.js';
import { createShell } from './app/shell.js';
import { installTooltips, toast } from './ui/overlay.js';
import { registerServiceWorker, loadVersion, pwa } from './app/pwa.js';
import { initFirmware } from './firmware/updater.js';
import { initUpdateUi } from './app/update-ui.js';
import { startDemo } from './device/mock.js';
import { installBridge } from './agent/bridge.js';
import { initI18n, t } from './i18n/index.js';

const SPLASH_MIN_MS = 450; // long enough to read, short enough not to annoy

async function boot() {
  const t0 = performance.now();
  applyPrefs();
  await initI18n(); // load the active language before anything renders
  installTooltips();
  createShell(document.getElementById('app-root'));
  initFirmware();
  initUpdateUi();
  installBridge();
  loadVersion();

  if (new URLSearchParams(location.search).has('demo')) startDemo();

  pwa.on('offline-ready', () => toast(t('Ready to work offline'), { tone: 'green', icon: 'check' }));
  registerServiceWorker().catch((err) => console.warn('[pwa] service worker unavailable', err));

  const wait = Math.max(0, SPLASH_MIN_MS - (performance.now() - t0));
  setTimeout(hideSplash, wait);
}

function hideSplash() {
  const splash = document.getElementById('splash');
  if (!splash) return;
  splash.classList.add('done');
  splash.addEventListener('transitionend', () => splash.remove(), { once: true });
  setTimeout(() => splash.remove(), 800);
}

boot().catch((err) => {
  console.error('[boot] failed', err);
  const splash = document.getElementById('splash');
  if (splash) {
    splash.querySelector('.splash-status').textContent = t('Something went wrong while starting. Try reloading.');
    splash.classList.add('error');
  }
});
