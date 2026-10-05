/**
 * module-updater.js — Stepped dialog that updates the ESP32 wireless module ("baseband").
 *
 * hoja2 did this in two places: the Wireless page sent GAMEPAD_CMD_ENABLE_BLUETOOTH_UPLOAD
 * ("Enter Update Mode"), then the user opened a separate esptool page (hoja_baseband/) to
 * connect → erase → flash. Here both halves live in one dialog that looks like the controller
 * firmware updater (src/firmware/updater.js):
 *
 *   1 Prepare      download the three images first (fail early when offline)
 *   2 Restart      ENABLE_BLUETOOTH_UPLOAD → firmware stores a boot flag and reboots into "ALTFLASH":
 *                  the RP2040 pulses its LEDs orange and its USB mux hands the port to a CH340
 *                  bridge wired to the ESP32 UART. The HOJA controller therefore drops off WebUSB.
 *   3 Connect      user picks the CH340 (Web Serial, or WebUSB on Android) → esptool syncs
 *   4 Install      erase → write → done; unplug the controller to leave update mode
 *
 * Page lifecycle: the shell unmounts device pages when the controller disconnects — which is
 * exactly what step 2 causes. hoja2 special-cased this (keepWirelessModuleForExternalUpdate in
 * js/app.js). Here the dialog is a module-level singleton appended to <body>, so it simply keeps
 * running after view.js is destroyed; nothing in it depends on the page or a connected session.
 *
 * Demo (?demo): the same steps run against a simulated flasher; the demo controller "drops off"
 * after the restart command (see demo.js), so the page-unmount behavior is demonstrable too.
 */
import { h } from '../../ui/dom.js';
import { openDialog, toast } from '../../ui/overlay.js';
import { button, callout, kv, progressBar, segmented } from '../../ui/controls.js';
import { session } from '../../device/session.js';
import { isDemo, startDemo } from '../../device/mock.js';
import { EspFlasher, availableTransports, baudFromUrl, downloadBasebandImages } from './esp-flasher.js';
import { LOCAL_UPDATER_URL, STANDALONE_UPDATER_URL, UPDATE_GUIDE_URL } from './info.js';
import { t, plural, fmt } from '../../i18n/index.js';

/** How long to wait for the controller to drop off USB after the restart command. */
const RESTART_TIMEOUT_MS = 6000;
const LOG_MAX_LINES = 400;

const STEP_OF = { intro: 1, downloading: 1, restarting: 2, connect: 3, connecting: 3, installing: 4, done: 4 };
const BUSY = new Set(['downloading', 'restarting', 'connecting', 'installing']);

/** The one running update (null when the dialog is closed). */
let run = null;

/** True while the update dialog is open (the page uses this to avoid opening a second one). */
export const moduleUpdateOpen = () => !!run;

/**
 * Open the wireless module update dialog (no-op if it's already open).
 * @param {{installed?: number, latest?: number|null, params?: object}} [o]
 *   installed  bluetooth_static.external_version_number
 *   latest     newest version from the baseband manifest (null = unknown/offline)
 *   params     deep-link params (supports `baud`, like the standalone updater's ?baud=)
 */
export function openModuleUpdater({ installed, latest = null, params = {} } = {}) {
  if (run) return;
  const demo = isDemo();
  const transports = availableTransports();

  run = {
    mode: 'intro',
    demo,
    installed,
    latest,
    images: null,
    transport: transports.preferred,
    flasher: null,
    stopWaiting: null,
  };
  run.flasher = new EspFlasher({ log, simulate: demo, baud: baudFromUrl(params) });

  // ---- Static dialog parts ----------------------------------------------------------------
  const steps = h('div.steps', [1, 2, 3, 4].map(() => h('span.step')));
  const guide = h('p.muted');
  const versions = h('div.wl-versions');
  const notice = h('div');
  const transportRow = h('div.wl-transport');
  const progress = progressBar({ message: t('Ready') });
  // The app's own log lines are translated; esptool's output (and the simulated copy of it) stays English.
  const logPre = h('pre.wl-log', { 'aria-live': 'off', 'data-empty': t('Nothing yet.') });
  const logBox = h('details.wl-log-box', h('summary', t('Details')), logPre);
  const help = h('div.wl-help-links',
    linkButton(t('Update guide'), UPDATE_GUIDE_URL),
    linkButton(t('Standalone updater'), STANDALONE_UPDATER_URL),
    linkButton(t('Windows updater (.zip)'), LOCAL_UPDATER_URL, t('Command-line updater for Windows driver or connection problems')));

  if (transports.serial && transports.usb) {
    transportRow.append(h('div.field-label', t('Connect using')),
      segmented({
        options: [{ value: 'serial', label: t('Serial port') }, { value: 'usb', label: t('USB (WebUSB)') }],
        value: run.transport, tone: 'blue', ariaLabel: t('Connection method'),
        onChange: (v) => { if (run) run.transport = v; },
      }),
      h('p.small.muted', t('Serial works with the usual CH340 driver. Try USB if the serial device doesn’t show up.')));
  }

  const dlg = openDialog({
    title: t('Update wireless module'), icon: 'wireless', tone: 'blue', dismissible: false,
    body: [steps, guide, versions, notice, transportRow, progress, logBox, help],
  });
  run.ui = { dlg, steps, guide, versions, notice, transportRow, progress, logPre, logBox };
  dlg.result.then(() => cleanup());

  showIntro();
}

// ---------------------------------------------------------------------------------------------
// Rendering helpers
// ---------------------------------------------------------------------------------------------

function linkButton(label, href, tip) {
  return h('a.btn.btn-ghost.btn-sm', { href, target: '_blank', rel: 'noopener noreferrer', 'data-tip': tip || null },
    h('span.btn-label', label));
}

function log(line) {
  if (!run) return;
  const pre = run.ui?.logPre;
  if (!pre) return;
  const text = String(line ?? '').replace(/\s+$/, '');
  if (!text) return;
  pre.append(`${text}\n`);
  while (pre.childNodes.length > LOG_MAX_LINES) pre.firstChild.remove();
  pre.scrollTop = pre.scrollHeight;
}

/** Title, guide text, icon and step pips for the current mode. */
function paint(title, text, { tone = 'blue', icon = 'wireless' } = {}) {
  const u = run.ui;
  u.dlg.setTitle(title);
  u.dlg.setIcon(icon, tone);
  u.guide.textContent = text;
  const n = STEP_OF[run.mode] || 0;
  [...u.steps.children].forEach((s, i) => {
    s.dataset.state = run.mode === 'done' || i + 1 < n ? 'done' : i + 1 === n ? 'active' : '';
  });
  u.transportRow.hidden = !(run.mode === 'connect' || run.mode === 'connecting');
  u.transportRow.querySelectorAll('button').forEach((b) => { b.disabled = run.mode === 'connecting'; });
}

/**
 * Footer buttons. `primary` = { label, icon, variant?, run }; `secondary` likewise (tonal).
 * Dismiss is hidden while something is in progress so a flash can't be abandoned by accident.
 */
function actions({ primary, secondary } = {}) {
  const list = [];
  if (!BUSY.has(run.mode)) {
    list.push({ label: run.mode === 'done' ? t('Close') : t('Dismiss'), variant: 'ghost', keepOpen: true, onClick: () => { dismiss(); return false; } });
  }
  for (const [id, a, variant] of [['secondary', secondary, 'tonal'], ['primary', primary, 'primary']]) {
    if (!a) continue;
    list.push({
      id, label: a.label, icon: a.icon, variant: a.variant || variant, keepOpen: true, disabled: a.disabled,
      onClick: () => { a.run(); return false; },
    });
  }
  run.ui.dlg.setActions(list);
}

function setVersions() {
  const { installed, latest } = run;
  run.ui.versions.replaceChildren(kv([
    [t('Installed'), installed != null ? String(installed) : t('Unknown')],
    [t('Latest'), latest ? String(latest) : t('Couldn’t check (offline?)')],
  ]));
}

function setNotice(node) {
  run.ui.notice.replaceChildren(node || '');
  run.ui.notice.hidden = !node; // an empty block would still take a flex gap
}

function errorText(err) {
  if (err?.name === 'NotFoundError') return t('No device was selected.');
  if (err?.name === 'SecurityError') return t('The browser blocked access to the device.');
  if (err?.name === 'NetworkError' || /failed to open/i.test(err?.message || '')) {
    return t('Couldn’t open the port — close other apps or tabs using it (e.g. the standalone updater) and try again.');
  }
  return err?.message || String(err); // our own errors are already translated; esptool's stay English
}

// ---------------------------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------------------------

/** Step 1: explain, warn about unsaved changes, offer Start / "already in update mode". */
function showIntro(errorMsg) {
  run.mode = 'intro';
  const upToDate = run.latest && run.installed >= run.latest;
  paint(upToDate ? t('Reinstall wireless firmware') : t('Update wireless module'),
    t('The wireless module (ESP32) has its own firmware. The controller restarts into a special update mode (its lights pulse orange), then the new firmware is written over USB. It takes about a minute — keep it plugged in.'));
  setVersions();
  run.ui.versions.hidden = false;

  const dirty = session.connected && session.dirty.size > 0;
  setNotice(errorMsg
    ? callout({ tone: 'red', title: t('Update didn’t start.'), text: errorMsg })
    : dirty
      ? callout({ tone: 'yellow', title: t('Unsaved changes.'), text: t('The controller restarts during the update and anything not saved is lost.') },
        button({ label: t('Save now'), icon: 'save', size: 'sm', variant: 'tonal', onClick: async (e) => {
          e.currentTarget.disabled = true;
          const ok = await session.save().catch(() => false);
          toast(ok ? t('Saved to controller') : t('Save failed'), { tone: ok ? 'green' : 'red' });
          if (run?.mode === 'intro') showIntro();
        } }))
      : upToDate ? callout({ tone: 'green', text: t('This module already has the latest firmware. You can reinstall it if wireless isn’t working right.') }) : null);

  run.ui.progress.set(0, t('Ready'));
  run.ui.progress.busy(false);
  actions({
    secondary: { label: t('Already in update mode'), run: () => showConnect() },
    primary: { label: upToDate ? t('Reinstall') : t('Start update'), icon: 'download', run: startUpdate },
  });
}

/** Steps 1→2: download images, then send ENABLE_BLUETOOTH_UPLOAD and wait for the USB drop. */
async function startUpdate() {
  run.mode = 'downloading';
  paint(t('Downloading firmware'), t('Getting the latest wireless firmware before the controller restarts.'));
  setNotice(null);
  actions({});
  run.ui.progress.busy(true);
  try {
    run.images = await downloadBasebandImages({
      simulate: run.demo,
      onProgress: (done, total, label) => {
        run?.ui.progress.set((done / total) * 100, label ? t('Downloading {file}…', { file: t(label) }) : t('Downloaded'));
        if (label) log(t('Downloading {file}…', { file: t(label) }));
      },
    });
    const bytes = fmt.number(run.images.reduce((n, i) => n + i.size, 0));
    log(plural(run.images.length, 'Downloaded {n} file ({bytes} bytes).', 'Downloaded {n} files ({bytes} bytes).', { bytes }));
  } catch (err) {
    console.error('[wireless] download failed', err);
    if (!run) return;
    log(t('Error: {message}', { message: err?.message || err }));
    showIntro(navigator.onLine === false ? t('You’re offline. Connect to the internet and try again.') : errorText(err));
    return;
  }
  if (!run) return;
  await enterUpdateMode();
}

async function enterUpdateMode() {
  if (!session.connected) { showConnect(); return; } // e.g. unplugged meanwhile: maybe already in update mode
  run.mode = 'restarting';
  paint(t('Restarting into update mode'), t('The controller is restarting. Its lights will pulse orange.'));
  run.ui.progress.indeterminate(true, t('Waiting for the controller to restart…'));
  actions({});

  const dropped = new Promise((resolve) => {
    const off = session.on('state', ({ state }) => { if (state !== 'connected') { off(); resolve(true); } });
    const timer = setTimeout(() => { off(); resolve(false); }, RESTART_TIMEOUT_MS);
    run.stopWaiting = () => { clearTimeout(timer); off(); resolve(false); };
  });

  try {
    await session.flush(); // pending writes first, like hoja2's sendBlock-then-command ordering
  } catch { /* the command below still matters more */ }
  log(t('Sending {command}…', { command: 'ENABLE_BLUETOOTH_UPLOAD' }));
  // The firmware reboots without acknowledging (settings.c), so don't wait for a reply.
  session.command('gamepad', 'ENABLE_BLUETOOTH_UPLOAD', { timeout: 2000 }).catch(() => {});

  const ok = await dropped;
  if (!run) return;
  run.stopWaiting = null;
  log(ok ? t('Controller left USB (now in update mode).') : t('Controller is still connected; continuing anyway.'));
  showConnect(ok ? null : t('The controller didn’t restart as expected. If its lights aren’t pulsing orange, unplug it, plug it back in and try again.'));
}

/** Step 3: pick the serial device. */
function showConnect(warning) {
  run.mode = 'connect';
  paint(t('Connect to the wireless module'),
    t('When the controller’s lights pulse orange, press Connect and choose the USB serial device (usually “USB-SERIAL CH340” or “USB Single Serial”). To cancel, just unplug the controller.'));
  run.ui.versions.hidden = true;
  setNotice(warning ? callout({ tone: 'yellow', text: warning }) : null);
  run.ui.progress.indeterminate(false);
  run.ui.progress.set(0, t('Ready to connect'));
  run.ui.progress.busy(false);
  actions({ primary: { label: t('Connect'), icon: 'usb', run: connectAndInstall } });
}

/** Step 3→4. Called straight from the click so the port picker keeps the user gesture. */
async function connectAndInstall() {
  run.mode = 'connecting';
  paint(t('Connecting'), t('Talking to the wireless module’s bootloader…'));
  setNotice(null);
  actions({});
  run.ui.progress.indeterminate(true, t('Connecting…'));
  try {
    const chip = await run.flasher.connect(run.transport);
    if (!run) return;
    log(t('Connected: {chip}', { chip }));
  } catch (err) {
    console.error('[wireless] connect failed', err);
    if (!run) return;
    log(t('Error: {message}', { message: err?.message || err }));
    showConnect(errorText(err));
    return;
  }
  await install();
}

/** Step 4: (download if skipped) → erase → write → release the port. */
async function install() {
  run.mode = 'installing';
  paint(t('Installing wireless firmware'), t('Don’t unplug the controller or close this tab.'));
  setNotice(null);
  actions({});
  window.addEventListener('beforeunload', guardUnload);
  const p = run.ui.progress;
  try {
    if (!run.images) {
      p.indeterminate(true, t('Downloading firmware…'));
      run.images = await downloadBasebandImages({ simulate: run.demo, onProgress: (d, n, label) => label && log(t('Downloading {file}…', { file: t(label) })) });
    }
    p.indeterminate(true, t('Erasing (this can take 30 seconds)…'));
    log(t('Erasing…'));
    await run.flasher.erase();
    p.set(0, t('Writing…'));
    p.busy(true);
    log(t('Flashing…'));
    await run.flasher.write(run.images, (pct, label) => run?.ui.progress.set(pct, t('Writing {file}…', { file: t(label) })));
    await run.flasher.close();
  } catch (err) {
    console.error('[wireless] install failed', err);
    window.removeEventListener('beforeunload', guardUnload);
    if (!run) return;
    log(t('Error: {message}', { message: err?.message || err }));
    p.indeterminate(false);
    p.busy(false);
    run.mode = 'connect';
    paint(t('Install didn’t finish'), t('Nothing is broken yet: the module can always be rewritten while in update mode. Try again; if it keeps failing, unplug the controller, plug it back in and start over.'), { tone: 'red', icon: 'warning' });
    setNotice(callout({ tone: 'red', text: errorText(err) }));
    actions({ primary: { label: t('Try again'), icon: 'refresh', run: () => (run.flasher.connected ? install() : connectAndInstall()) } });
    return;
  }
  window.removeEventListener('beforeunload', guardUnload);
  if (!run) return;
  log(t('Flashing is complete. Please unplug your controller to finish the update.'));
  showDone();
}

function showDone() {
  run.mode = 'done';
  paint(t('Wireless module updated'), t('Unplug the controller, wait a moment, plug it back in, then press Connect.'), { tone: 'green', icon: 'check' });
  setNotice(null);
  const p = run.ui.progress;
  p.indeterminate(false);
  p.set(100, t('Done — unplug the controller to finish'));
  p.busy(false);
  actions({
    primary: {
      label: t('Connect'), icon: 'usb',
      run: async () => {
        const demo = run.demo;
        dismiss();
        if (demo) { startDemo(); return; }
        const { connectController } = await import('../../app/shell.js');
        connectController();
      },
    },
  });
}

// ---------------------------------------------------------------------------------------------
// Teardown
// ---------------------------------------------------------------------------------------------

function guardUnload(e) { e.preventDefault(); e.returnValue = ''; }

function dismiss() {
  if (!run) return;
  const midUpdate = run.mode === 'connect' && !run.demo;
  run.ui.dlg.close();
  if (midUpdate) toast(t('If the lights are pulsing orange, unplug the controller to leave update mode.'), { tone: 'blue', timeout: 7000 });
}

function cleanup() {
  if (!run) return;
  run.stopWaiting?.();
  window.removeEventListener('beforeunload', guardUnload);
  const f = run.flasher;
  run = null;
  f?.close().catch(() => {});
}
