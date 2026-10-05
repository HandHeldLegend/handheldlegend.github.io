/**
 * info.js — Pure helpers that interpret the wireless static/config fields (no DOM).
 *
 * Sources of truth (HOJA-LIB-RP2040):
 *   bluetoothInfoStatic_s   include/utilities/static_config.h
 *   wireless_part_status    TRANSPORT_WIRELESS_PART_* in include/transport/transport_bt.h, combined for
 *                           Bluetooth + WLAN by _wireless_part_status_combine() in static_config.c
 *   host_mac_* validity     _bluetooth_hal_is_stored_identity_valid() in src/hal/rp2040/bluetooth_hal.c
 *   wlan_dongle_key         gamepadConfig_s, clamped with `% 10000` by the firmware on every write
 */
import { decodeText } from '../../device/struct.js';
import { t, N_ } from '../../i18n/index.js';

/** Where the ESP32 baseband update guide lives (same link hoja2 used). */
export const UPDATE_GUIDE_URL = 'https://docs.handheldlegend.com/s/portal/doc/esp32-baseband-update-page-vhX2Im50kN';
/** The standalone web updater hoja2 linked to (kept as a fallback). */
export const STANDALONE_UPDATER_URL = 'https://handheldlegend.github.io/hoja_baseband/';
/** Windows command-line updater offered by the standalone page for driver/connection trouble. */
export const LOCAL_UPDATER_URL = 'https://github.com/HandHeldLegend/handheldlegend.github.io/raw/refs/heads/master/hoja_esptool/hoja-local-updater-win.zip';

/**
 * FCC Part 15 statement shown next to the FCC ID (verbatim from hoja2). This English text is the
 * official wording (47 CFR 15.19) and is always shown as is; the Wireless page adds a clearly
 * labelled reference translation below it in other languages (N_ marks it for the dictionaries).
 */
export const FCC_STATEMENT = N_('This device complies with Part 15 of the FCC Rules. Operation is subject to the following two conditions: (1) this device may not cause harmful interference, and (2) this device must accept any interference received, including interference that may cause undesired operation.');

/** wireless_part_status values. */
export const PART_STATUS = Object.freeze({ NA: 0, ERROR: 1, OK: 2 });

/**
 * Decode a firmware identity string. The firmware writes "N/A" when a board has no value
 * (see _bluetooth_static_refresh_identity) and very old builds wrote "~"; both count as empty.
 */
export function identityText(bytes) {
  const s = decodeText(bytes);
  return s === 'N/A' ? '' : s;
}

/**
 * Interpret the combined wireless part status (hoja2: wirelessChipFromStatic).
 *   NA (0)     nothing was probed (no wireless hardware fitted, or not probed this boot)
 *   ERROR (1)  a wireless part is expected but did not answer (e.g. ESP32 reported version 0)
 *   OK (2)     every fitted wireless part answered
 * @returns {{model: string, present: boolean, state: 'active'|'error'|'inactive'|'absent', label: string, tone: string}}
 *   label (and model when unknown) is already translated.
 */
export function chipStatus(bt) {
  const model = identityText(bt.part_number);
  const status = bt.wireless_part_status;
  if (!model && status === PART_STATUS.NA) {
    return { model: t('Unknown'), present: false, state: 'absent', label: t('Not present'), tone: null };
  }
  const shown = model || t('Unknown');
  if (status === PART_STATUS.OK) return { model: shown, present: true, state: 'active', label: t('Active'), tone: 'green' };
  if (status === PART_STATUS.ERROR) return { model: shown, present: true, state: 'error', label: t('Not responding'), tone: 'red' };
  return { model: shown, present: true, state: 'inactive', label: t('Inactive'), tone: 'yellow' };
}

/** True when a stored host address is a real pairing (not blank 00:00… or erased FF:FF…). */
export function isPairedMac(bytes) {
  if (!bytes || bytes.length < 2) return false;
  if (bytes[0] === 0xff && bytes[1] === 0xff) return false;
  if (!bytes[0] && !bytes[1]) return false;
  return true;
}

/** Bytes → "AA:BB:CC:DD:EE:FF". */
export function formatMac(bytes) {
  return Array.from(bytes || [], (b) => b.toString(16).padStart(2, '0')).join(':').toUpperCase();
}

/** 0..9999 → "0420". */
export function formatPin(value) {
  const n = Math.min(9999, Math.max(0, Math.round(Number(value) || 0)));
  return String(n).padStart(4, '0');
}

/** Keep only digits, at most four (hoja2: sanitizeWlanPinInput). */
export function sanitizePin(raw) {
  return String(raw ?? '').replace(/[^0-9]/g, '').slice(0, 4);
}

/** "0420" → 420 ('' → 0) (hoja2: wlanPinToValue). */
export function pinToValue(digits) {
  if (digits === '') return 0;
  return Math.min(9999, parseInt(digits, 10) || 0);
}
