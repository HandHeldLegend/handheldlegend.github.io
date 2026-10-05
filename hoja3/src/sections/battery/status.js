/**
 * status.js — Pure decoding of the battery static block and live charge state into what the
 * Battery page shows. Port of the logic in hoja2/modules/battery-md.js (no DOM here).
 *
 * batteryInfoStatic_s (firmware include/utilities/static_config.h):
 *   pmic_status       0 = no PMIC driver, 1 = PMIC not responding, 2 = PMIC ok + pack present,
 *                     3 = PMIC ok + no pack detected, 4 = PMIC ok + pack detection inconclusive.
 *                     Older firmware reported 2 for every "PMIC ok" case. Pack presence is sampled
 *                     once at boot and never re-read.
 *   fuelgauge_status  0 = no fuel gauge driver, 1 = driver present but gauge not connected, 2 = connected.
 *
 * Live input report: byte 1 bit0 = charging, bit1 = charge done; byte 2 = fuel gauge percent.
 *
 * Badge and explanation texts are returned already translated (t() is a plain lookup, no DOM).
 */
import { t } from '../../i18n/index.js';

export const PMIC_STATUS = Object.freeze({
  NO_DRIVER: 0,
  NOT_RESPONDING: 1,
  OK_PACK: 2,
  OK_NO_PACK: 3,
  OK_PACK_UNKNOWN: 4,
});

/** Battery pack presence derived from pmic_status. */
export const PACK = Object.freeze({ PRESENT: 'present', ABSENT: 'absent', UNKNOWN: 'unknown', NA: 'na' });

/** rgb_idle_glow value meaning "Off" (RGB page's "On, Off" selector). */
export const IDLE_GLOW_OFF = 1;

/**
 * @typedef {{text: string, tone: string|null, dashed?: boolean}} Badge
 * tone null = neutral gray; dashed = "the device declined to report a state".
 */

/**
 * hoja2 decodePmicStatus() plus customer-facing explanations.
 * @param {number} value
 * @returns {{badge: Badge, pack: string, explain: string}}
 */
export function decodePmicStatus(value) {
  switch (value) {
    case PMIC_STATUS.NO_DRIVER:
      return {
        badge: { text: t('Not present'), tone: null }, pack: PACK.NA,
        explain: t('This controller has no charger chip, so it doesn\'t charge a battery. That\'s normal for wired-only builds.'),
      };
    case PMIC_STATUS.NOT_RESPONDING:
      // Soft fault: also covers boot modes that skip battery setup, so not necessarily broken hardware.
      return {
        badge: { text: t('Not responding'), tone: 'yellow' }, pack: PACK.NA,
        explain: t('The charger chip didn\'t answer when the controller started. Some connection modes skip battery setup, so this isn\'t always a fault — unplug the controller and reconnect it. If it keeps happening, contact support.'),
      };
    case PMIC_STATUS.OK_PACK:
      return {
        badge: { text: t('Active'), tone: 'green' }, pack: PACK.PRESENT,
        explain: t('The charger chip is working and manages charging for the battery.'),
      };
    case PMIC_STATUS.OK_NO_PACK:
      return {
        badge: { text: t('Active'), tone: 'green' }, pack: PACK.ABSENT,
        explain: t('The charger chip is working, but there is no battery to charge.'),
      };
    case PMIC_STATUS.OK_PACK_UNKNOWN:
      return {
        badge: { text: t('Active'), tone: 'green' }, pack: PACK.UNKNOWN,
        explain: t('The charger chip is working.'),
      };
    default: {
      // Later firmware may extend this ladder; report the raw value instead of guessing.
      const text = Number.isFinite(value) ? t('Unknown ({value})', { value }) : t('Unknown');
      return {
        badge: { text, tone: null, dashed: true }, pack: PACK.UNKNOWN,
        explain: t('This firmware reports a charger state this app doesn\'t know yet. Updating the app may help.'),
      };
    }
  }
}

/** Pack row (derived from pmic_status). */
export function describePack(pack) {
  switch (pack) {
    case PACK.PRESENT:
      return { badge: { text: t('Detected'), tone: 'green' }, explain: t('A battery pack is fitted.') };
    case PACK.ABSENT:
      return { badge: { text: t('Not detected'), tone: null }, explain: t('No battery pack was found. That\'s fine — the controller runs from USB power. If you did fit a battery, check its connector.') };
    case PACK.UNKNOWN:
      return { badge: { text: t('Unconfirmed'), tone: 'yellow' }, explain: t('The controller couldn\'t tell whether a battery is fitted, and doesn\'t guess. The charging state shown above may still be correct.') };
    default:
      return { badge: { text: t('Not checked'), tone: null, dashed: true }, explain: t('Without a working charger chip nothing checks for a battery pack.') };
  }
}

/**
 * hoja2 fuelGaugeBadge(): fuelgauge_status is still 3-state (the pack values don't apply to it).
 * @param {number} status
 */
export function decodeFuelGauge(status) {
  const present = status !== 0;
  const active = status === 2;
  if (!present) {
    return { present, active, badge: { text: t('Not present'), tone: null }, explain: t('No fuel gauge is fitted, so the battery level can\'t be measured — only whether it\'s charging.') };
  }
  if (!active) {
    return { present, active, badge: { text: t('Inactive'), tone: 'yellow' }, explain: t('A fuel gauge is fitted but isn\'t responding, so the battery percentage may be wrong.') };
  }
  return { present, active, badge: { text: t('Active'), tone: 'green' }, explain: t('Measures how much charge is left in the battery.') };
}

/**
 * Combine static info and the latest report into the battery gauge state (hoja2 updateBatteryDisplay()).
 * @param {{pack: string, fuelGaugePresent: boolean, idleGlowOff: boolean}} hw
 * @param {{charging: boolean, chargeDone: boolean, batteryPercent: number}|null} live  null = no report yet
 */
export function chargeState(hw, live) {
  if (hw.pack === PACK.ABSENT) return { layout: 'absent' };
  if (!live) return { layout: 'waiting' };

  const { charging, chargeDone } = live;
  // Percentage only means something with a fuel gauge, and values above 100 are treated as "no reading".
  const percentage = hw.fuelGaugePresent ? live.batteryPercent : null;
  const hasLevel = percentage != null && percentage <= 100;
  const percent = hasLevel ? Math.max(0, Math.min(100, percentage)) : null;

  let level = 'unknown';
  if (hasLevel) level = percent <= 20 ? 'low' : percent <= 50 ? 'medium' : 'high';

  // "Done" wins over "charging", matching the firmware's own priority.
  const state = chargeDone ? 'full' : charging ? 'charging' : 'idle';

  return {
    layout: 'normal',
    state,
    level,
    percent,
    // hoja2: full → 100 %, no fuel gauge → a neutral half-full bar.
    fill: chargeDone ? 100 : hasLevel ? percent : 50,
    // The on-screen status light mirrors the controller LED, which goes dark with idle glow off.
    led: hw.idleGlowOff ? 'off' : state,
    unconfirmed: hw.pack === PACK.UNKNOWN,
  };
}
