/**
 * imu-readout.js — Live gyro/accelerometer bars (port of hoja2's components/imu-data-display.js).
 *
 *   const readout = createImuReadout();
 *   readout.set(r.gyro, r.accel);   // raw int16 samples from the input report; drawn on the next frame
 *   readout.destroy();
 *
 * Each axis is a centered bar: it grows right for positive values and left for negative ones.
 * Bar full-scale is kept identical to hoja2, which converted raw samples with
 * GYRO = raw × 0.7 against ±2000 and ACCEL = raw × 0.00488 against ±16 — i.e. a bar is full at
 * |raw| ≈ 2857 (gyro) and ≈ 3279 (accel). (Note: with the firmware's ±8 g accelerometer range
 * 1 g ≈ 4096 LSB, so gravity alone fills the accel bar, exactly as it did in hoja2.)
 *
 * New in hoja3: a numeric readout per axis in real units, from the firmware's sensor ranges
 * (LSM6DSR at ±2000 dps → 70 mdps/LSB, ±8 g → 0.244 mg/LSB). Values include the sensitivity
 * multipliers, because the firmware applies them before reporting.
 */
import { h } from '../../ui/dom.js';
import { t, i18n } from '../../i18n/index.js';

/** hoja2 bar normalization: displayValue = raw × UNIT, bar fraction = displayValue / RANGE. */
const BAR = {
  gyro: { unit: 70.0 / 100.0, range: 2000 },
  accel: { unit: 0.488 / 100.0, range: 16 },
};

/** Physical units for the numeric labels. */
const PHYS = {
  gyro: { perLsb: 70 / 1000, suffix: '°/s', decimals: 0 },     // dps
  accel: { perLsb: 0.244 / 1000, suffix: 'g', decimals: 2 },   // g
};

const AXES = [
  { id: 'x', tone: 'red' },
  { id: 'y', tone: 'green' },
  { id: 'z', tone: 'blue' },
];

export function createImuReadout() {
  const rows = { gyro: {}, accel: {} };
  // Locale-aware numbers ("+0,98 g" in Spanish), units untranslated. Built once (fmt.number would build a
  // formatter per call, 60× a second); the view remounts on a language change.
  const num = {};
  for (const sensor of ['gyro', 'accel']) {
    const d = PHYS[sensor].decimals;
    num[sensor] = new Intl.NumberFormat(i18n.lang, { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: false });
  }
  const values = { gyro: { x: 0, y: 0, z: 0 }, accel: { x: 0, y: 0, z: 0 } };
  let raf = 0;
  let destroyed = false;

  const group = (sensor, title, hint) => h('div.imu-group',
    h('div.imu-group-head', h('h4', title), h('span.faint.xs', hint)),
    AXES.map(({ id, tone }) => {
      const fill = h('span.imu-bar-fill');
      const numEl = h('span.imu-num', '0');
      rows[sensor][id] = { fill, num: numEl };
      return h('div.imu-row', { class: `tone-${tone}` },
        h('span.imu-axis', id.toUpperCase()),
        h('span.imu-bar', h('span.imu-bar-scale'), fill, h('span.imu-bar-center')),
        numEl);
    }));

  const el = h('div.imu-readout', { 'aria-live': 'off' },
    group('gyro', t('Gyroscope'), t('rotation speed')),
    group('accel', t('Accelerometer'), t('tilt & shake')));

  function draw() {
    raf = 0;
    if (destroyed) return;
    for (const sensor of ['gyro', 'accel']) {
      const { unit, range } = BAR[sensor];
      const phys = PHYS[sensor];
      for (const { id } of AXES) {
        const raw = values[sensor][id];
        // hoja2: percentage = |value| / maxRange × 50 (% of the whole bar, i.e. 0..1 of one half).
        const frac = Math.min(1, Math.abs(raw * unit) / range);
        const row = rows[sensor][id];
        row.fill.style.transform = `scaleX(${raw < 0 ? -frac : frac})`;
        const v = raw * phys.perLsb;
        const text = `${v >= 0 ? '+' : '−'}${num[sensor].format(Math.abs(v))} ${phys.suffix}`;
        if (row.num.textContent !== text) row.num.textContent = text;
      }
    }
  }

  draw(); // show "+0 °/s" etc. until the first report arrives

  return {
    el,
    /** @param {{x,y,z}} gyro raw int16  @param {{x,y,z}} accel raw int16 */
    set(gyro, accel) {
      Object.assign(values.gyro, gyro);
      Object.assign(values.accel, accel);
      if (!raf && !document.hidden) raf = requestAnimationFrame(draw);
    },
    destroy() {
      destroyed = true;
      if (raf) cancelAnimationFrame(raf);
    },
  };
}
