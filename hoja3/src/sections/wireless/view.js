/**
 * Wireless view — port of hoja2/modules/wireless-md.js.
 *
 * Cards (each hidden exactly when hoja2 hid the matching panel):
 *   Wireless chip       part number + status badge (wireless_part_status), BR/EDR, LE, WLAN support
 *   Module firmware     external_update_supported only: installed vs latest baseband version and the
 *                       in-app ESP32 update (module-updater.js — replaces hoja2's "Enter Update Mode"
 *                       button + the separate hoja_baseband/ esptool page)
 *   WLAN dongle         wlan_supported only: the 4-digit pairing PIN (authoritative editor;
 *                       setting `wireless.dongleKey` in settings.js)
 *   Paired hosts        host_mac_switch / host_mac_sinput (read-only)
 *   Regulatory          FCC ID + Part 15 statement when the controller reports an FCC ID
 *
 * Deep links: #/wireless?update=1 opens the module update dialog (when supported);
 * ?baud=<n> overrides the esptool baud rate like the standalone updater did.
 *
 * The update dialog is independent of this page: when the controller drops off USB to enter
 * update mode the shell destroys this view, and the dialog carries on (see module-updater.js).
 */
import { h, loadStyles } from '../../ui/dom.js';
import { card, badge, kv, field, infoTip, button } from '../../ui/controls.js';
import { latestBasebandVersion } from '../../device/session.js';
import { getSetting } from '../../settings/schema.js';
import {
  chipStatus, identityText, isPairedMac, formatMac, formatPin, sanitizePin, pinToValue,
  FCC_STATEMENT, UPDATE_GUIDE_URL, STANDALONE_UPDATER_URL,
} from './info.js';
import { openModuleUpdater } from './module-updater.js';
import { t, i18n } from '../../i18n/index.js';

loadStyles(new URL('./wireless.css', import.meta.url));

const TONE = 'blue';
const yesNo = (v) => (v ? t('Supported') : t('Not supported'));

export function mount(root, ctx) {
  const { session } = ctx;
  const bt = session.static.bluetooth;
  const caps = session.caps;
  let alive = true;
  let latest = null; // newest baseband version from the manifest (null until known / offline)

  // ---- Wireless chip ------------------------------------------------------------------------
  const chip = chipStatus(bt);
  const chipCard = card({
    title: t('Wireless chip'), subtitle: t('The radio that handles Bluetooth and wireless dongles.'),
    icon: 'wireless', tone: TONE, actions: badge(chip.label, chip.tone),
  },
  kv([
    [t('Part'), chip.model],
    [t('Status'), h('span.wl-inline', chip.label, infoTip(
      t('Active: the wireless hardware answered when the controller started. Not responding: it’s fitted but didn’t answer (try a restart; if it persists the module may need its firmware reinstalled). Inactive / Not present: nothing was detected.')))],
    [t('Bluetooth Classic'), h('span.wl-inline', yesNo(bt.bluetooth_bdr_supported), infoTip(t('Bluetooth BR/EDR — used for Switch and most console/PC pairing.')))],
    [t('Bluetooth LE'), h('span.wl-inline', yesNo(bt.bluetooth_ble_supported), infoTip(t('Bluetooth Low Energy.')))],
    [t('WLAN dongle'), yesNo(bt.wlan_supported)],
  ]));

  // ---- Module firmware (ESP32 baseband) -------------------------------------------------------
  let firmwareCard = null;
  if (caps.externalBaseband) {
    const installed = bt.external_version_number;
    const status = h('span', badge(t('Checking…')));
    const latestCell = h('span.muted', t('Checking…'));
    const updateBtn = button({
      label: t('Update wireless module'), icon: 'download', variant: 'tonal',
      onClick: () => openModuleUpdater({ installed, latest, params: ctx.params }),
    });
    firmwareCard = card({
      title: t('Wireless module firmware'),
      subtitle: t('The ESP32 module runs its own firmware, updated separately from the controller.'),
      icon: 'firmware', tone: TONE, actions: status,
    },
    kv([[t('Installed version'), String(installed)], [t('Latest version'), latestCell]]),
    h('div.wl-actions', updateBtn,
      h('a.btn.btn-ghost.btn-sm', { href: UPDATE_GUIDE_URL, target: '_blank', rel: 'noopener noreferrer' }, h('span.btn-label', t('Update guide'))),
      h('a.btn.btn-ghost.btn-sm', { href: STANDALONE_UPDATER_URL, target: '_blank', rel: 'noopener noreferrer',
        'data-tip': t('The separate web updater from earlier versions of this app.') }, h('span.btn-label', t('Standalone updater')))));

    const checked = latestBasebandVersion().then((v) => {
      if (!alive) return;
      latest = v;
      if (!v) {
        latestCell.textContent = navigator.onLine === false ? t('Offline') : t('Couldn’t check');
        status.replaceChildren(badge(t('Unknown')));
        return;
      }
      latestCell.textContent = String(v);
      latestCell.classList.remove('muted');
      const available = installed < v; // same comparison as hoja2
      status.replaceChildren(available ? badge(t('Update available'), 'yellow') : badge(t('Up to date'), 'green'));
      if (available) {
        updateBtn.classList.replace('btn-tonal', 'btn-primary');
        updateBtn.setLabel(t('Update now'));
      }
    });

    // Deep link: open the dialog once the version check has finished (so it can show "latest").
    if (ctx.params?.update) checked.then(() => alive && updateBtn.click());
  }

  // ---- WLAN dongle PIN -----------------------------------------------------------------------
  let pinRow = null;
  if (caps.wlan) {
    const def = getSetting('wireless.dongleKey');
    const input = h('input.input.mono.wl-pin', {
      type: 'text', inputmode: 'numeric', pattern: '[0-9]*', maxLength: 4, autocomplete: 'off', spellcheck: false,
      value: formatPin(def.get(session)), 'aria-label': t(def.label),
    });
    input.addEventListener('input', () => { input.value = sanitizePin(input.value); });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
    input.addEventListener('change', () => {
      const value = pinToValue(sanitizePin(input.value));
      input.value = formatPin(value);
      if (value === def.get(session)) return;
      def.set(session, value);
      session.commit(def.block);
    });
    // Setting texts are English data (settings.js); translate where rendered.
    pinRow = field({ label: t(def.label), description: t(def.description), tip: t(def.tip), control: input, settingKey: def.key });
    pinRow.refresh = () => { input.value = formatPin(def.get(session)); };
  }
  const wlanCard = pinRow && card({
    title: t('WLAN dongle'), subtitle: t('Pair with a Raspberry Pi wireless dongle instead of Bluetooth.'),
    icon: 'link', tone: TONE,
  }, pinRow);

  // ---- Paired hosts --------------------------------------------------------------------------
  const cfg = session.config.gamepad;
  const macCell = (bytes) => (isPairedMac(bytes)
    ? h('span.wl-mac', formatMac(bytes))
    : h('span.muted', t('Not paired')));
  const hostsCard = card({
    title: t('Paired hosts'), subtitle: t('What this controller reconnects to over Bluetooth. Pairing again replaces it.'),
    icon: 'gamepad', tone: TONE,
  },
  kv([
    ['Nintendo Switch', macCell(cfg.host_mac_switch)],
    [t('Steam host'), h('span.wl-inline', macCell(cfg.host_mac_sinput), infoTip(t('The PC or device paired in Steam mode.')))],
  ]));

  // ---- Regulatory ----------------------------------------------------------------------------
  const fccId = identityText(bt.fcc_id);
  // The FCC statement stays in its official English wording (lang="en"). Other languages get a
  // reference translation below it, labelled as such (draft — the English text is what counts).
  const fccTranslated = t(FCC_STATEMENT);
  const fccCard = fccId && card({ title: t('Regulatory'), icon: 'info', tone: TONE, class: 'wl-fcc' },
    h('div.wl-fcc-id', 'FCC ID: ', h('span.mono', fccId)),
    h('p.small.muted', { lang: 'en' }, FCC_STATEMENT),
    i18n.lang !== 'en' && fccTranslated !== FCC_STATEMENT && h('div.wl-fcc-translation',
      h('p.xs.faint.wl-fcc-note', t('Translation for reference only. The English statement above is the official text.')),
      h('p.small.muted', fccTranslated)));

  root.append(...[chipCard, firmwareCard, wlanCard, hostsCard, fccCard].filter(Boolean));

  return {
    destroy() { alive = false; },
    update(params) {
      if (params?.update && caps.externalBaseband) openModuleUpdater({ installed: bt.external_version_number, latest, params });
      pinRow?.refresh();
    },
  };
}
