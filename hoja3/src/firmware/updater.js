/**
 * updater.js — Controller firmware updates, HOJA installs on bare boards, and recovery.
 *
 * This is hoja2's firmware state machine (js/app.js) moved into its own module with a stepped
 * dialog UI. Modes:
 *
 *   hidden               nothing in progress
 *   update-available     connected controller has newer firmware → [Enter update mode]
 *   awaiting-bootloader  we asked it to reboot into BOOTSEL; waiting for the RP2 bootloader
 *   bootloader-flash     bootloader present and we know which firmware to write → flashing
 *   bootloader-install   bare bootloader, nothing known → user picks a build to install
 *   uf2-drive-select     PICOBOOT unavailable → user picks the RPI-RP2/RP2350 drive (or downloads)
 *   update-complete      done; reconnect when the controller reboots
 *
 * The dialog stays open across USB disconnects/reconnects (the controller vanishes and comes
 * back as a different device during an update), exactly like hoja2's header panel did.
 *
 * Public API:
 *   initFirmware()                 wire session/USB events (called once from main.js)
 *   firmwareStatus()               { state: 'unknown'|'checking'|'current'|'available'|'offline', latest, url }
 *   openUpdateWizard()             show the update flow for the connected controller
 *   openInstallWizard(buildId?)    show the install flow (bare bootloader)
 *   formatFwVersion(n)             human-readable build stamp
 */
import { h, replace, fillNodes } from '../ui/dom.js';
import { openDialog, toast } from '../ui/overlay.js';
import { callout, progressBar, select } from '../ui/controls.js';
import { session } from '../device/session.js';
import { device, isPicoBootloader } from '../device/hoja-device.js';
import { isDemo } from '../device/mock.js';
import { prefs } from '../app/prefs.js';
import { listBuilds, getBuildManifest, NUKE_BUILD } from './builds.js';
import {
  pico_update_attempt_flash, pico_exit_bootloader_attempt, pico_complete_uf2_picker_flash,
  pico_has_cached_uf2, setUpdateStatus, onFlashProgress,
} from './picoboot.js';
import { t, fmt } from '../i18n/index.js';

// ---- Debug switches (same URL params as hoja2): ?debug=force-update forces the update prompt.
const params = new URLSearchParams(location.search);
export const DEBUG = params.has('debug') && !['0', 'false', 'off'].includes((params.get('debug') || '1').toLowerCase());
let debugForce = DEBUG && (params.get('debug') === 'force-update' || params.get('forceUpdate') === '1' || params.get('force-update') === '1');
export const debugForceUpdate = { get: () => debugForce, set: (v) => { debugForce = !!v; } };

const STEPS = { 'update-available': 1, 'awaiting-bootloader': 2, 'bootloader-install': 1, 'bootloader-flash': 3, 'uf2-drive-select': 3, 'update-complete': 4 };

const st = {
  mode: 'hidden',
  pendingUrl: undefined,
  pendingChecksum: undefined,
  pendingLegacy: false,
  status: { state: 'unknown', latest: null, url: null },
};

let ui = null; // dialog + elements while visible

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

/** Build stamps are Unix timestamps; show them as a date when they look like one. */
export function formatFwVersion(n) {
  if (n == null) return t('Unknown');
  const v = Number(n) >>> 0;
  if (v > 1.4e9 && v < 4e9) {
    const d = new Date(v * 1000);
    return `${fmt.date(d)} · ${v}`;
  }
  return String(v);
}

export const firmwareStatus = () => st.status;

function setStatus(next) {
  st.status = { ...st.status, ...next };
  session.dispatchEvent(new CustomEvent('firmware', { detail: st.status }));
}

async function fetchManifest(url) {
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    return data.fw_version ? { version: data.fw_version, checksum: data.checksum } : null;
  } catch {
    return null; // offline
  }
}

// ---------------------------------------------------------------------------------------------
// Dialog UI
// ---------------------------------------------------------------------------------------------

function ensureUi() {
  if (ui) return ui;
  const steps = h('div.steps', [1, 2, 3, 4].map(() => h('span.step')));
  const guide = h('p.muted');
  const progress = progressBar({ message: t('Ready') });

  const installConfirm = h('input', { type: 'checkbox' });
  const buildSelect = h('div');
  const picker = h('div.stack', { style: { '--gap': '12px' } },
    h('label.field-label', t('Choose your controller')), buildSelect,
    h('label.row.small', { style: { flexWrap: 'nowrap', alignItems: 'flex-start', '--gap': '10px' } }, installConfirm,
      h('span', t('I understand that installing the wrong firmware can brick this controller, and recovery may require opening it up to reach BOOTSEL again.'))));
  picker.hidden = true;

  const tips = callout({ tone: 'blue', title: t('In the folder dialog:') },
    h('ol', { style: { margin: '6px 0 0', paddingLeft: '1.2em' } },
      h('li', fillNodes(t('Open the drive named {drive} or {drive2}'), { drive: h('strong', 'RPI-RP2'), drive2: h('strong', 'RP2350') })),
      h('li', fillNodes(t('Select that drive (you’ll see {file} inside)'), { file: h('strong', 'INFO_UF2.TXT') })),
      h('li', t('Click Select / Open — not Downloads or Documents'))));
  tips.hidden = true;

  const dlg = openDialog({
    title: t('Firmware'), icon: 'firmware', tone: 'blue', dismissible: false,
    body: [steps, guide, picker, tips, progress],
  });

  ui = { dlg, steps, guide, progress, picker, buildSelect, installConfirm, tips, select: null };
  installConfirm.addEventListener('change', refreshInstallState);
  onFlashProgress(({ percent, message, flashing }) => {
    if (!ui) return;
    if (percent != null) ui.progress.set(percent, message);
    else ui.progress.set(null, message);
    ui.progress.busy(flashing && percent < 100);
  });
  dlg.result.then(() => { ui = null; onFlashProgress(null); });
  return ui;
}

function paint(title, text, { tone = 'blue', icon = 'firmware' } = {}) {
  const u = ensureUi();
  u.dlg.setTitle(title);
  u.dlg.setIcon(icon, tone);
  u.guide.textContent = text;
  const n = STEPS[st.mode] || 0;
  [...u.steps.children].forEach((s, i) => { s.dataset.state = i + 1 < n ? 'done' : i + 1 === n ? 'active' : ''; });
  if (st.mode === 'update-complete') [...u.steps.children].forEach((s) => { s.dataset.state = 'done'; });
}

/**
 * Set the dialog buttons. primary: { label, icon, enabled, run } ; restart / dismiss booleans.
 */
function actions({ primary, restart = false, dismiss = true }) {
  const u = ensureUi();
  const list = [];
  if (dismiss) list.push({ label: st.mode === 'update-complete' ? t('Close') : t('Dismiss'), variant: 'ghost', keepOpen: true, onClick: () => { hide(); return false; } });
  if (restart) list.push({ label: t('Restart controller'), icon: 'refresh', variant: 'tonal', keepOpen: true, onClick: async () => { await pico_exit_bootloader_attempt(); return false; } });
  if (primary) {
    list.push({
      id: 'primary', label: primary.label, icon: primary.icon, variant: primary.variant || 'primary', disabled: primary.enabled === false, keepOpen: true,
      onClick: async () => {
        const btn = u.dlg.action('primary');
        if (btn) btn.disabled = true;
        try { await primary.run(); } catch (err) { console.error(err); setUpdateStatus(err?.message ? t(err.message) : t('Something went wrong'), 0, false); }
        if (ui && ui.dlg.action('primary') === btn && btn) btn.disabled = primary.enabled === false;
        return false;
      },
    });
  }
  u.dlg.setActions(list);
}

function hide() {
  st.mode = 'hidden';
  st.pendingUrl = undefined;
  st.pendingChecksum = undefined;
  st.pendingLegacy = false;
  ui?.dlg.close();
  ui = null;
}

// ---------------------------------------------------------------------------------------------
// States (ported 1:1 from hoja2)
// ---------------------------------------------------------------------------------------------

function showUpdateAvailable(url, checksum, { legacy = false, debugForced = false } = {}) {
  st.pendingUrl = url;
  st.pendingChecksum = checksum;
  st.pendingLegacy = legacy;
  st.mode = 'update-available';
  const u = ensureUi();
  u.picker.hidden = true;
  u.tips.hidden = true;
  paint(debugForced ? t('Update available (debug)') : legacy ? t('This controller needs new firmware') : t('Firmware update available'),
    legacy
      ? t('This controller is running older firmware that this app can’t configure. Update it to unlock every setting.')
      : debugForced
        ? t('Debug mode: forcing the update flow even though firmware is current.')
        : t('A newer firmware is available. First the controller restarts into update mode, then the new firmware is written. Keep it plugged in the whole time.'),
    { icon: 'download' });
  u.progress.set(0, t('Ready'));
  u.progress.busy(false);
  actions({ primary: { label: t('Enter update mode'), icon: 'firmware', run: enterBootloader } });
}

async function enterBootloader() {
  st.mode = 'awaiting-bootloader';
  paint(t('Entering update mode'), t('Restarting into update mode. When the bootloader appears, flashing starts automatically — or press Update if your browser asks for permission.'));
  setUpdateStatus(t('Sending reboot to bootloader…'), 10, true);
  actions({ primary: { label: t('Update'), icon: 'download', run: () => startBootloaderFlash({ allowRequestDevice: true }) } });
  try {
    if (st.pendingLegacy) device.rebootToBootloaderLegacy().catch(() => {});
    else await device.rebootToBootloader();
  } catch (err) {
    // The device often drops off USB mid-transfer — that's success for us.
    console.warn('[fw] reboot command:', err?.message || err);
  }
  setUpdateStatus(t('Waiting for the bootloader…'), 30, true);
}

function showBootloaderFlash() {
  st.mode = 'bootloader-flash';
  const u = ensureUi();
  u.picker.hidden = true;
  u.tips.hidden = true;
  paint(t('Writing firmware'), t('Don’t unplug the controller. If direct USB flashing is blocked, you’ll get simple steps to pick the RPI-RP2 drive.'));
  setUpdateStatus(t('Bootloader detected'), 40, true);
  actions({ primary: { label: t('Update'), icon: 'download', run: () => startBootloaderFlash({ allowRequestDevice: true }) }, restart: true });
}

function showUf2DriveStep() {
  st.mode = 'uf2-drive-select';
  const u = ensureUi();
  u.picker.hidden = true;
  u.tips.hidden = false;
  paint(t('Select the RPI-RP2 drive'), t('Direct USB flashing isn’t available on this system. Read the steps, then press the button — a folder dialog will open on top of this window.'), { icon: 'download' });
  setUpdateStatus(t('Ready — pick RPI-RP2 in the next dialog'), 100, false);
  actions({ primary: { label: t('Select RPI-RP2'), icon: 'upload', run: completeUf2Step }, restart: true });
}

function showManualUf2Step(uf2Url) {
  st.mode = 'uf2-drive-select';
  st.pendingUrl = uf2Url;
  const u = ensureUi();
  u.picker.hidden = true;
  u.tips.hidden = false;
  paint(t('Copy the UF2 to RPI-RP2'), t('Download the UF2 file, then copy it onto the drive named RPI-RP2 (or RP2350). The controller restarts when the copy finishes.'), { icon: 'download' });
  setUpdateStatus(t('Download the UF2, then copy it to RPI-RP2'), 100, false);
  actions({ primary: { label: t('Download UF2'), icon: 'download', run: completeUf2Step } });
}

function showUpdateComplete() {
  st.mode = 'update-complete';
  st.pendingUrl = undefined;
  st.pendingChecksum = undefined;
  st.pendingLegacy = false;
  const u = ensureUi();
  u.picker.hidden = true;
  u.tips.hidden = true;
  paint(t('Update complete'), t('Firmware was written successfully. Give the controller a moment to restart, then press Connect.'), { tone: 'green', icon: 'check' });
  setUpdateStatus(t('Done — connect when ready'), 100, true);
  u.progress.busy(false);
  actions({ primary: { label: t('Connect'), icon: 'usb', run: async () => { hide(); const { connectController } = await import('../app/shell.js'); connectController(); } } });
  setStatus({ state: 'unknown' });
}

async function showBootloaderInstall(preselect) {
  st.pendingUrl = undefined;
  st.pendingChecksum = undefined;
  st.pendingLegacy = false;
  st.mode = 'bootloader-install';
  const u = ensureUi();
  u.tips.hidden = true;
  u.picker.hidden = false;
  u.installConfirm.checked = false;
  paint(t('Install HOJA firmware?'), t('A Raspberry Pi bootloader (BOOTSEL) was detected. Choose your controller below, then press Install.'), { icon: 'firmware' });
  setUpdateStatus(t('Choose a controller to continue'), 0, false);
  actions({ primary: { label: t('Install'), icon: 'download', enabled: false, run: runInstall }, restart: true });

  u.buildSelect.replaceChildren(h('span.muted.small', t('Loading builds…')));
  const { builds, offline } = await listBuilds();
  if (!ui) return;
  const options = [{ value: '', label: t('Choose a controller…') },
    ...builds.map((b) => ({ value: b.id, label: b.label })),
    { value: NUKE_BUILD.id, label: t(NUKE_BUILD.label) }];
  u.select = select({ options, value: preselect || '', ariaLabel: t('Controller build'), onChange: refreshInstallState });
  u.select.style.width = '100%';
  replace(u.buildSelect, u.select, offline && h('p.small.muted', { style: { marginTop: '6px' } }, t('Offline — showing the last known list. Installing needs an internet connection.')));
  u.builds = [...builds, NUKE_BUILD];
  refreshInstallState();
}

function refreshInstallState() {
  if (st.mode !== 'bootloader-install' || !ui) return;
  const ok = !!ui.select?.value && ui.installConfirm.checked;
  const btn = ui.dlg.action('primary');
  if (btn) btn.disabled = !ok;
}

async function resolveInstallSelection() {
  const id = ui?.select?.value;
  const build = ui?.builds?.find((b) => b.id === id);
  if (!build) return null;
  const manifest = await getBuildManifest(build.manifestUrl);
  return { url: build.uf2Url, checksum: manifest?.checksum || null };
}

async function runInstall() {
  const fw = await resolveInstallSelection();
  if (!fw) { setUpdateStatus(t('Choose a controller first.'), 0, false); return; }
  st.pendingUrl = fw.url;
  st.pendingChecksum = fw.checksum;
  await startBootloaderFlash({ allowRequestDevice: true });
}

function applyFlashResult(result) {
  if (result === true) { showUpdateComplete(); return true; }
  if (result?.needsUserAction) {
    if (result.reason === 'directory-picker') { showUf2DriveStep(); return true; }
    if (result.reason === 'manual-download') { showManualUf2Step(result.uf2Url); return true; }
    paint(t('Permission needed'), t('Press Update and allow access to the Pico bootloader in the browser popup.'));
    setUpdateStatus(t('Press Update to continue'), 0, false);
    actions({ primary: { label: t('Authorize'), icon: 'usb', run: () => startBootloaderFlash({ allowRequestDevice: true }) }, restart: true });
    return true;
  }
  return false;
}

async function startBootloaderFlash({ allowRequestDevice = true } = {}) {
  if (!st.pendingUrl) { setUpdateStatus(t('No firmware selected.'), 0, false); return false; }
  showBootloaderFlash();
  st.mode = 'bootloader-flash';
  const result = await pico_update_attempt_flash(st.pendingUrl, st.pendingChecksum, { allowRequestDevice });
  return applyFlashResult(result);
}

async function completeUf2Step() {
  if (pico_has_cached_uf2()) {
    try {
      await pico_complete_uf2_picker_flash();
      showUpdateComplete();
      return;
    } catch (err) {
      console.error(err);
      const msg = String(err?.message || err).toLowerCase();
      if (st.pendingUrl && (msg.includes('security policy') || msg.includes('folder picker blocked'))) {
        window.open(st.pendingUrl, '_blank');
        showManualUf2Step(st.pendingUrl);
        return;
      }
      setUpdateStatus(err.message ? t(err.message) : t('Folder selection failed.'), 0, false);
      return;
    }
  }
  if (st.pendingUrl) {
    window.open(st.pendingUrl, '_blank');
    showUpdateComplete();
    return;
  }
  setUpdateStatus(t('No firmware file ready.'), 0, false);
}

// ---------------------------------------------------------------------------------------------
// Event handling
// ---------------------------------------------------------------------------------------------

const ACTIVE = ['awaiting-bootloader', 'bootloader-flash', 'bootloader-install', 'uf2-drive-select', 'update-complete'];

async function onBootloaderConnect() {
  if (st.mode === 'uf2-drive-select' || st.mode === 'bootloader-flash') return;
  if (st.mode === 'update-complete' && !st.pendingUrl) { await showBootloaderInstall(); return; }
  if (st.pendingUrl) {
    try { await startBootloaderFlash({ allowRequestDevice: false }); } catch (err) {
      console.error('[fw] auto-flash failed', err);
      setUpdateStatus(t('Press Update to retry'), 0, false);
    }
    return;
  }
  if (st.mode !== 'bootloader-install') await showBootloaderInstall();
}

function onBootloaderDisconnect() {
  if (ACTIVE.includes(st.mode)) return; // keep the dialog through reboots
  hide();
}

async function onControllerConnect() {
  if (isDemo()) { setStatus({ state: 'current', latest: null }); if (st.mode !== 'hidden') hide(); return; }
  const info = session.info;
  let shown = false;
  if (prefs.get('autoUpdateCheck') !== false || debugForce) {
    setStatus({ state: 'checking' });
    const latest = await fetchManifest(info.manifestUrl);
    if (!latest) setStatus({ state: navigator.onLine === false ? 'offline' : 'unknown', latest: null });
    const available = latest && latest.version > (info.fwVersion >>> 0);
    if (latest) setStatus({ state: available ? 'available' : 'current', latest: latest.version, url: info.firmwareUrl, checksum: latest.checksum });
    if ((available || debugForce) && info.firmwareUrl) {
      showUpdateAvailable(info.firmwareUrl, latest?.checksum ?? null, { debugForced: !available && debugForce });
      shown = true;
    }
  }
  // A HOJA controller connected, so any stale install prompt is moot.
  if (!shown && st.mode !== 'hidden') hide();
}

function onControllerDisconnect() {
  if (st.mode === 'update-available') hide();
  if (!ACTIVE.includes(st.mode)) setStatus({ state: 'unknown', latest: null });
}

export function initFirmware() {
  session.on('state', ({ state }) => {
    if (state === 'connected') onControllerConnect();
    if (state === 'disconnected') onControllerDisconnect();
  });
  session.on('legacy', ({ url }) => {
    if (url) showUpdateAvailable(url, null, { legacy: true });
    else toast(t('This controller runs legacy firmware we don’t recognize. Use Firmware → Install with BOOTSEL.'), { tone: 'yellow', timeout: 8000 });
  });
  session.on('bootloader', () => onBootloaderConnect());

  if (navigator.usb) {
    navigator.usb.addEventListener('connect', (e) => { if (isPicoBootloader(e.device)) onBootloaderConnect(); });
    navigator.usb.addEventListener('disconnect', (e) => { if (isPicoBootloader(e.device)) onBootloaderDisconnect(); });
    navigator.usb.getDevices().then(async (devs) => {
      if (devs.some(isPicoBootloader) && !st.pendingUrl) await showBootloaderInstall();
    }).catch((err) => console.warn('[fw] getDevices failed', err));
  }
}

/** Open the update flow for the connected controller (from Home / Firmware page). */
export async function openUpdateWizard() {
  if (!session.connected) { toast(t('Connect your controller first.'), { tone: 'yellow' }); return; }
  const latest = await fetchManifest(session.info.manifestUrl);
  const url = session.info.firmwareUrl;
  if (!url) { toast(t('This controller doesn’t report a firmware download location.'), { tone: 'yellow' }); return; }
  showUpdateAvailable(url, latest?.checksum ?? null, { debugForced: !latest || !(latest.version > (session.info.fwVersion >>> 0)) ? debugForce : false });
}

/** Open the install flow manually (e.g. Firmware page → "Install on a blank board"). */
export async function openInstallWizard(buildId) {
  await showBootloaderInstall(buildId);
}

/** Reboot the connected controller into BOOTSEL without starting an update (Gamepad page). */
export async function rebootToBootloaderOnly() {
  // When the bootloader then appears, onBootloaderConnect() offers the installer (as in hoja2).
  await device.rebootToBootloader();
  return true;
}

/** Restart a controller that's sitting in the bootloader. */
export const exitBootloader = () => pico_exit_bootloader_attempt();

/** Re-check the update manifest for the connected controller. */
export async function checkForFirmwareUpdate() {
  if (!session.connected) return st.status;
  setStatus({ state: 'checking' });
  const latest = await fetchManifest(session.info.manifestUrl);
  if (!latest) setStatus({ state: navigator.onLine === false ? 'offline' : 'unknown' });
  else setStatus({ state: latest.version > (session.info.fwVersion >>> 0) ? 'available' : 'current', latest: latest.version });
  return st.status;
}
