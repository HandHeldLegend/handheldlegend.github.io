/**
 * Battery view — port of hoja2/modules/battery-md.js.
 *
 * Cards:
 *   1. Battery   — animated gauge (fill + charging bolt), percentage, charge state with a status
 *                  light that mirrors the controller's LED, plain-language explanation, model and
 *                  capacity. Live from bytes 1–2 of every input report (either stream mode).
 *   2. Hardware  — charger chip (PMIC), fuel gauge and battery pack detection, each with its part
 *                  number, a status badge and what that status means.
 *
 * Read-only: nothing here writes to the controller. Static info is read once at connect
 * (session.static.battery); pack detection is a boot-time snapshot in firmware.
 *
 * Like hoja2, the live panel is built once per layout and values are patched in place, so CSS
 * animations (charging shimmer, LED blink) keep running instead of restarting on every report.
 */
import { h, loadStyles } from '../../ui/dom.js';
import { card, kv, button } from '../../ui/controls.js';
import { icon } from '../../ui/icons.js';
import { decodeText } from '../../device/struct.js';
import { onInputReport } from '../../device/reports.js';
import { t, fmt, i18n, N_ } from '../../i18n/index.js';
import { decodePmicStatus, decodeFuelGauge, describePack, chargeState, IDLE_GLOW_OFF } from './status.js';

loadStyles(new URL('./battery.css', import.meta.url));

const TONE = 'green';

// English source texts; translated with t() where shown.
const STATE_TEXT = { charging: N_('Charging'), full: N_('Fully charged'), idle: N_('Not charging') };
const LED_TEXT = {
  charging: N_('The status light glows orange while charging.'),
  full: N_('The status light turns green when the battery is full.'),
  idle: N_('The status light glows cyan when the controller isn\'t charging.'),
  off: N_('Idle glow is turned off in RGB settings, so the status light stays dark.'),
};

/** Join whole translated sentences into one paragraph (Japanese doesn't put spaces between sentences). */
const joinSentences = (parts) => parts.join(i18n.lang === 'ja' ? '' : ' ');

export function mount(root, { session, device, navigate }) {
  const st = session.static.battery;
  const pmic = decodePmicStatus(st.pmic_status);
  const fuel = decodeFuelGauge(st.fuelgauge_status);
  const pack = describePack(pmic.pack);
  const text = (bytes) => decodeText(bytes) || t('Unknown');

  const hw = {
    pack: pmic.pack,
    fuelGaugePresent: fuel.present,
    idleGlowOff: !!session.caps.rgb && session.config.rgb?.rgb_idle_glow === IDLE_GLOW_OFF,
  };

  // ---- 1. Battery card (live) -------------------------------------------------------------
  const fill = h('div.bat-fill');
  const bolt = h('span.bat-bolt', icon('bolt'));
  const gauge = h('div.bat-gauge', { role: 'meter', 'aria-label': t('Battery level'), 'aria-valuemin': 0, 'aria-valuemax': 100 },
    h('div.bat-body', fill, h('div.bat-ticks', h('i'), h('i'), h('i')), bolt),
    h('div.bat-cap'));
  const percentEl = h('div.bat-percent');
  const led = h('span.bat-led');
  const stateEl = h('span.bat-state-text');
  const stateRow = h('div.bat-state', led, stateEl);
  const explainEl = h('p.bat-explain');
  const ledNote = h('p.bat-led-note');
  const rgbLink = button({ label: t('Open RGB settings'), size: 'sm', variant: 'ghost', icon: 'rgb', onClick: () => navigate('rgb') });
  rgbLink.hidden = true;

  const details = kv([
    [t('Battery'), text(st.battery_part_number)],
    [t('Capacity'), st.battery_capacity_mah ? `${fmt.number(st.battery_capacity_mah)} mAh` : t('Unknown')],
  ]);

  const statusCard = card({ title: t('Battery'), icon: 'battery', tone: TONE, subtitle: t('Live charge level and charging state.') },
    h('div.bat-hero',
      gauge,
      h('div.bat-readout', percentEl, stateRow),
      h('div.bat-specs', details)),
    explainEl,
    h('div.bat-led-row', ledNote, rgbLink));

  // ---- 2. Hardware card (static) ----------------------------------------------------------
  const hwRow = (name, tip, part, info) => h('div.bat-hw-row',
    h('div.bat-hw-text',
      h('div.bat-hw-name', name, tip && h('span.faint.small', ' · ', tip)),
      part != null && h('div.bat-hw-part', part),
      h('p.bat-hw-explain', info.explain)),
    h('span.badge', { class: [info.badge.tone ? `tone-${info.badge.tone}` : 'bat-badge-neutral', info.badge.dashed ? 'bat-badge-dashed' : null].filter(Boolean) }, info.badge.text));

  const hardware = card({ title: t('Hardware'), icon: 'info', tone: TONE, subtitle: t('The power parts inside your controller and what they reported when it started.') },
    hwRow(t('Charger chip'), 'PMIC', text(st.pmic_part_number), pmic),
    hwRow(t('Fuel gauge'), t('battery meter'), text(st.fuelgauge_part_number), fuel),
    hwRow(t('Battery pack'), '', null, {
      ...pack,
      explain: pmic.pack === 'na' ? pack.explain
        : joinSentences([pack.explain, t('Checked once at power-on — reconnect the controller to check again.')]),
    }));

  root.append(statusCard, hardware);

  // ---- Live updates -----------------------------------------------------------------------
  let last = null;      // latest {charging, chargeDone, batteryPercent}
  let raf = 0;
  let painted = '';     // signature of the last paint, to skip identical frames

  const setAttr = (el, name, value) => { if (el.getAttribute(name) !== value) el.setAttribute(name, value); };
  const setText = (el, value) => { if (el.textContent !== value) el.textContent = value; };

  function paint() {
    raf = 0;
    const s = chargeState(hw, last);
    const sig = JSON.stringify(s);
    if (sig === painted) return;
    painted = sig;

    setAttr(gauge, 'data-layout', s.layout);
    stateRow.hidden = s.layout !== 'normal';
    rgbLink.hidden = true;

    if (s.layout === 'absent') {
      // hoja2: empty battery icon + "No Battery"; charge bits are inert without a pack.
      fill.style.setProperty('--fill', '0');
      setText(percentEl, t('No battery'));
      percentEl.classList.add('is-text');
      setText(explainEl, t('No battery pack is fitted, so there is nothing to charge. The controller runs from USB power.'));
      setText(ledNote, '');
      gauge.removeAttribute('aria-valuenow');
      setAttr(gauge, 'aria-valuetext', t('No battery'));
      return;
    }
    if (s.layout === 'waiting') {
      fill.style.setProperty('--fill', '0');
      setText(percentEl, '—');
      percentEl.classList.remove('is-text');
      setText(explainEl, t('Waiting for the controller to report its battery…'));
      setText(ledNote, '');
      return;
    }

    setAttr(gauge, 'data-state', s.state);
    setAttr(gauge, 'data-level', s.level);
    fill.style.setProperty('--fill', String(s.fill / 100));
    setText(percentEl, s.percent != null ? fmt.percent(s.percent / 100) : t('Level N/A'));
    percentEl.classList.toggle('is-text', s.percent == null);
    if (s.percent != null) { setAttr(gauge, 'aria-valuenow', String(s.percent)); gauge.removeAttribute('aria-valuetext'); }
    else { gauge.removeAttribute('aria-valuenow'); setAttr(gauge, 'aria-valuetext', t('Level not available')); }

    setAttr(led, 'data-led', s.led);
    // hoja2 appended "· Battery Unconfirmed" when pack detection was inconclusive.
    setText(stateEl, s.unconfirmed
      ? t('{state} · battery unconfirmed', { state: t(STATE_TEXT[s.state]) })
      : t(STATE_TEXT[s.state]));

    const parts = [];
    if (s.state === 'charging') parts.push(t('Plugged in and charging. Keep it connected until the light turns green.'));
    else if (s.state === 'full') parts.push(t('Fully charged — you can unplug whenever you like.'));
    else parts.push(s.level === 'low' ? t('Battery is low — plug in a charging cable soon.') : t('The battery isn\'t being charged right now.'));
    if (s.percent == null) {
      parts.push(fuel.present
        ? t('The fuel gauge didn\'t give a valid reading, so the level isn\'t shown.')
        : t('This controller can\'t measure its charge level (it has no fuel gauge), so only the charging state is shown.'));
    } else if (!fuel.active) {
      parts.push(t('The fuel gauge isn\'t responding, so the percentage may be off.'));
    }
    if (pmic.pack === 'na') parts.push(t('The charger chip isn\'t working, so the charging state may be wrong.'));
    if (s.unconfirmed) parts.push(t('The controller couldn\'t confirm a battery is fitted.'));
    setText(explainEl, joinSentences(parts));

    setText(ledNote, t(LED_TEXT[s.led]));
    rgbLink.hidden = s.led !== 'off';
  }

  const schedule = () => { if (!raf) raf = requestAnimationFrame(paint); };
  paint();

  const stop = onInputReport(device, (r) => {
    if (last && last.charging === r.charging && last.chargeDone === r.chargeDone && last.batteryPercent === r.batteryPercent) return;
    last = { charging: r.charging, chargeDone: r.chargeDone, batteryPercent: r.batteryPercent };
    schedule();
  });

  return () => {
    stop();
    if (raf) cancelAnimationFrame(raf);
  };
}
