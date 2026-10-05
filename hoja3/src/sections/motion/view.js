/**
 * Motion view — port of hoja2/modules/motion-md.js (+ components sensor-visualization.js and
 * imu-data-display.js).
 *
 * Cards:
 *   1. Motion controls — on/off (imu_disabled) and gyro calibration (IMU_CMD_CALIBRATE_START).
 *   2. Live view       — 3D controller model (three.js, lazy-loaded) + gyro/accel bars from the
 *                        input stream (bytes 3–14 of every report, either stream mode).
 *   3. Sensitivity     — per-axis gyro/accel multipliers (imu_gyro_sensitivity / imu_accel_sensitivity)
 *                        with hoja2's "Reset to defaults".
 *
 * Every write goes through session.commit('imu') (hoja2 wrote the block after each change).
 */
import { h, loadStyles } from '../../ui/dom.js';
import { card, field, button, callout, badge } from '../../ui/controls.js';
import { openDialog, toast } from '../../ui/overlay.js';
import { settingField, refreshSettings } from '../../settings/field.js';
import { onInputReport } from '../../device/reports.js';
import { createModelView } from './model-view.js';
import { createImuReadout } from './imu-readout.js';
import { t, fmt } from '../../i18n/index.js';
import { AXES, resetSensitivity, GYRO_SENSITIVITY_DEFAULT, ACCEL_SENSITIVITY_DEFAULT, SENSITIVITY_UNITY } from './settings.js';

loadStyles(new URL('./motion.css', import.meta.url));

const TONE = 'yellow';
/** Firmware averages 2000 gyro samples at one per 3 ms (IMU_CALIBRATE_CYCLES × IMU_READ_RATE). */
const CALIBRATION_MS = 6000;
/** hoja2 waited up to 100 s for the calibration reply. */
const CALIBRATION_TIMEOUT_MS = 100000;

/**
 * Fill a translated sentence's {placeholders} with DOM nodes (links, <strong>), so word order follows
 * the language. Pass the already-translated sentence and a map of placeholder → node or string.
 */
function withNodes(text, nodes) {
  return text.split(/(\{\w+\})/).map((part) => {
    const m = part.match(/^\{(\w+)\}$/);
    return m && m[1] in nodes ? nodes[m[1]] : part;
  }).filter((p) => p !== '');
}

/** Sensitivity multiplier as shown to the user, e.g. "1.20×" ("1,20×" in Spanish). */
const mult = (v) => `${fmt.number(v / SENSITIVITY_UNITY, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}×`;

export function mount(root, { session, device }) {
  const imu = () => session.config.imu;

  // ---- 1. Motion controls ----------------------------------------------------------------
  const enabledRow = settingField('motion.enabled', { tone: TONE, onChange: () => syncDisabled() });

  const calibrateRow = field({
    label: t('Calibrate gyro'),
    description: t('Removes slow drift. Put the controller on a flat, solid surface first.'),
    tip: t('The controller measures the gyro while it is perfectly still and stores that as "zero". Recalibrate if the camera slowly drifts in games when you are not moving.'),
    control: button({ label: t('Calibrate'), icon: 'calibrate', variant: 'warning', onClick: () => calibrate() }),
  });

  const controls = card({
    title: t('Motion controls'), icon: 'motion', tone: TONE,
    subtitle: t('Gyro aiming and tilt for games that support motion. Changes apply instantly — press Save to keep them.'),
  }, enabledRow, calibrateRow);

  // ---- 2. Live view -----------------------------------------------------------------------
  const model = createModelView({ bodyColor: session.config.gamepad?.gamepad_color_body || null });
  const readout = createImuReadout();
  const offNote = callout({ tone: 'yellow', icon: 'info', title: t('Motion is off.'), text: t('The controller is not sending motion data, so the view stays still. Turn Motion controls on to see it move.') });
  // Attribution required by the model's license: title, author and license names stay as published.
  const credit = h('p.motion-credit', withNodes(t('"{title}" by {author}, {license}'), {
    title: h('a', { href: 'https://skfb.ly/PyDP', target: '_blank', rel: 'noopener' }, 'Nintendo Gamepad'),
    author: 'Nidal Ghonaim',
    license: h('a', { href: 'https://creativecommons.org/licenses/by/4.0/', target: '_blank', rel: 'noopener' }, 'CC BY 4.0'),
  }));

  const liveBadge = badge(t('Waiting…'));
  const live = card({
    title: t('Live view'), icon: 'play', tone: TONE,
    subtitle: t('Move the controller — the model tilts with how fast you turn it, and the bars show the raw sensors.'),
    actions: liveBadge,
  },
  offNote,
  h('div.motion-live',
    h('div.motion-stage-wrap', model.el, credit),
    readout.el));

  // ---- 3. Sensitivity ---------------------------------------------------------------------
  const sensRows = [];
  const axisRows = (sensor) => AXES.map((axis) => {
    // The group heading already names the sensor and default, so the per-row description is dropped.
    const row = settingField(`motion.${sensor}Sensitivity${axis.toUpperCase()}`, { tone: TONE, description: '' });
    sensRows.push(row);
    return row;
  });
  const resetBtn = button({
    label: t('Reset to defaults'), icon: 'refresh', variant: 'ghost', size: 'sm',
    onClick: () => {
      resetSensitivity(session);
      session.commit('imu');
      for (const r of sensRows) r.refresh();
      toast(t('Sensitivity reset (gyro {gyro}, accelerometer {accel})', { gyro: mult(GYRO_SENSITIVITY_DEFAULT), accel: mult(ACCEL_SENSITIVITY_DEFAULT) }), { tone: 'green' });
    },
  });
  const sensitivity = card({
    title: t('Sensitivity'), icon: 'sliders', tone: TONE,
    subtitle: t('Multiply the motion games receive, per axis. 1.00× is the sensor\'s natural response.'),
    actions: resetBtn,
  },
  h('div.motion-sens-group',
    h('h4.motion-sens-title', t('Gyro'), h('span.faint.xs', ' · ', t('default {value}', { value: mult(GYRO_SENSITIVITY_DEFAULT) }))),
    axisRows('gyro')),
  h('div.motion-sens-group',
    h('h4.motion-sens-title', t('Accelerometer'), h('span.faint.xs', ' · ', t('default {value}', { value: mult(ACCEL_SENSITIVITY_DEFAULT) }))),
    axisRows('accel')));

  root.append(controls, live, sensitivity);

  function syncDisabled() {
    const off = !!imu().imu_disabled;
    offNote.hidden = !off;
    live.classList.toggle('motion-off', off);
  }
  syncDisabled();

  // ---- Live input -------------------------------------------------------------------------
  // Accel/gyro are present in both report kinds (raw and joystick), so the current mode is kept.
  let gotReport = false;
  const stopInput = onInputReport(device, (r) => {
    model.setGyro(r.gyro);
    readout.set(r.gyro, r.accel);
    if (!gotReport) {
      gotReport = true;
      liveBadge.replaceChildren(h('span.dot.live.tone-green'), t('Live'));
      liveBadge.classList.add('tone-green');
    }
  });

  // ---- Calibration ------------------------------------------------------------------------
  let calibrating = false;
  let activeDialog = null;

  function calibrate() {
    if (calibrating) return;
    const steps = h('ol.motion-steps',
      h('li', t('Place the controller on a flat, solid surface (a desk, not your lap or a sofa).')),
      h('li', t('Let go and don\'t touch the controller or the table.')),
      h('li', t('Press Start. It takes about {n} seconds — the LEDs pulse yellow while it works.', { n: Math.round(CALIBRATION_MS / 1000) })));

    const dlg = openDialog({
      title: t('Calibrate gyro'), icon: 'calibrate', tone: TONE, dismissible: false,
      body: [h('p.muted', t('Calibration teaches the controller what "perfectly still" looks like, which stops slow drift in games.')), steps],
      actions: [
        { label: t('Cancel'), variant: 'ghost', value: false },
        { id: 'start', label: t('Start calibration'), icon: 'play', variant: 'warning', onClick: () => { run(); return false; } },
      ],
      onClose: () => { activeDialog = null; },
    });
    activeDialog = dlg;

    async function run() {
      calibrating = true;
      const bar = h('div.motion-cal-bar', h('span.motion-cal-fill.motion-ok', { style: { '--cal-ms': `${CALIBRATION_MS}ms` } }));
      dlg.setBody(
        h('p', withNodes(t('{calibrating} Keep the controller completely still.'), { calibrating: h('strong', t('Calibrating…')) })),
        bar,
        h('p.faint.xs', t('This finishes on its own; the window updates when the controller reports back.')));
      dlg.setActions([]);
      requestAnimationFrame(() => bar.classList.add('running'));

      let ok = false;
      try {
        await session.flush(); // don't let a pending (older) imu write land after calibration
        const { status } = await session.command('imu', 'CALIBRATE_START', { timeout: CALIBRATION_TIMEOUT_MS });
        ok = !!status;
        if (ok) {
          // Calibration rewrote the gyro offsets in controller RAM. Re-read the block so later
          // writes from this page don't overwrite them with stale values, then mark it unsaved
          // so Save stores the new calibration in flash.
          await session.refresh('imu');
          session.commit('imu');
          refreshSettings(root);
          syncDisabled();
        }
      } catch (err) {
        console.error('[motion] calibration failed', err);
      }
      calibrating = false;

      if (ok) {
        dlg.setIcon('check', 'green');
        dlg.setTitle(t('Gyro calibrated'));
        dlg.setBody(h('p', withNodes(t('All done. Press {save} to keep the new calibration after the controller is unplugged.'), { save: h('strong', t('Save')) })));
        dlg.setActions([{ label: t('Done'), variant: 'primary', value: true }]);
      } else {
        dlg.setIcon('warning', 'red');
        dlg.setTitle(t('Calibration failed'));
        dlg.setBody(h('p', t('The controller didn\'t confirm the calibration. Check the USB connection, keep the controller still and try again.')));
        dlg.setActions([
          { label: t('Close'), variant: 'ghost', value: false },
          { label: t('Try again'), icon: 'refresh', variant: 'warning', onClick: () => { run(); return false; } },
        ]);
      }
    }
  }

  return {
    destroy() {
      stopInput();
      activeDialog?.close(false); // controller went away mid-dialog
      model.destroy();
      readout.destroy();
    },
  };
}
