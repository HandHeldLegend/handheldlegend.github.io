/**
 * calibration.js — Guided stick calibration dialog (replaces hoja2's Calibrate/Stop tristate button).
 *
 * Firmware sequence (HOJA-LIB-RP2040 src/input/analog.c, stick_scaling.c) — same commands as hoja2:
 *   1. ANALOG_CMD_CALIBRATE_START  captures both sticks' resting centers (lx/ly/rx/ry_center) on the next
 *      poll, sets every slot's in_distance to 256, resets the response curves to linear and pulses the LEDs red.
 *      While calibrating, stick output is held at center, so the live stream can't show the stick moving.
 *   2. The user rolls both sticks around the rim. For every enabled angle slot within 4° of the stick's
 *      angle the firmware keeps the furthest distance seen (in_distance). Once every enabled slot on both
 *      sticks is past 400 the LEDs pulse cyan ("enough data").
 *   3. ANALOG_CMD_CALIBRATE_STOP  ends calibration, sets analog_calibration_set = 1 and activates the map.
 *   hoja2 then re-read the analog block; we do the same and also push it back once so the app's Save button
 *   lights up (identical data, the firmware just re-initializes with it).
 *
 * Progress: because in_distance is written live into the analog block, we re-read the block a couple of
 * times a second and draw the captured shape per stick. Progress = slots past the firmware's 400 threshold.
 *
 * Cancel (new in hoja3): STOP, then write back the analog block snapshot taken before START.
 */
import { h } from '../../ui/dom.js';
import { progressBar, callout, button } from '../../ui/controls.js';
import { openDialog, toast } from '../../ui/overlay.js';
import { icon } from '../../ui/icons.js';
import { canvasSurface, withAlpha } from '../../ui/canvas-surface.js';
import { slotField } from './analog.js';
import { t } from '../../i18n/index.js';

/** in_distance every enabled slot must exceed before the firmware considers a stick done. */
const DONE_DISTANCE = 400;
const POLL_MS = 450;

/** Captured-shape preview for one stick during calibration. */
function shapePreview(session, stick, label) {
  const surface = canvasSurface({ aspect: 1, label: t('{stick}: captured range', { stick: label }), draw });
  const bar = progressBar({ message: label });

  function slots() {
    return session.config.analog[slotField(stick)].filter((s) => s.enabled).sort((a, b) => a.in_angle - b.in_angle);
  }

  function draw(ctx, w, hgt, c) {
    const s = slots();
    const cx = w / 2;
    const cy = hgt / 2;
    const rad = Math.min(w, hgt) / 2 - 6;
    if (rad < 8) return; // not laid out yet
    const scale = Math.max(1800, ...s.map((x) => x.in_distance)) * 1.05;
    const P = (angle, dist) => {
      const a = (-angle * Math.PI) / 180;
      const r = (Math.min(dist, scale) / scale) * rad;
      return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    };

    ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fillStyle = c.surface2; ctx.fill();
    ctx.strokeStyle = c.border; ctx.lineWidth = 1.5; ctx.stroke();

    // The firmware's "enough data" threshold
    ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.arc(cx, cy, (DONE_DISTANCE / scale) * rad, 0, Math.PI * 2);
    ctx.strokeStyle = withAlpha(c.textMuted, 0.6); ctx.lineWidth = 1; ctx.stroke();
    ctx.setLineDash([]);

    if (s.length > 2) {
      ctx.beginPath();
      s.forEach((x, i) => { const [px, py] = P(x.in_angle, x.in_distance); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
      ctx.closePath();
      ctx.fillStyle = withAlpha(c.green, 0.18); ctx.fill();
      ctx.strokeStyle = withAlpha(c.green, 0.85); ctx.lineWidth = 2; ctx.stroke();
    }
    for (const x of s) {
      const [px, py] = P(x.in_angle, x.in_distance);
      ctx.beginPath(); ctx.arc(px, py, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = x.in_distance > DONE_DISTANCE ? c.green : c.textFaint; ctx.fill();
    }
  }

  return {
    el: h('div.cal-stick', surface.el, bar),
    /** Redraw; returns completion 0..1. */
    update() {
      const s = slots();
      const done = s.length ? s.filter((x) => x.in_distance > DONE_DISTANCE).length / s.length : 0;
      bar.set(done * 100, label);
      surface.invalidate();
      return done;
    },
    destroy: () => surface.destroy(),
  };
}

/**
 * Open the calibration dialog.
 * @param {{session: object, sticks: Array<'left'|'right'>, onFinished?: (ok: boolean) => void}} o
 */
export function openCalibration({ session, sticks, onFinished }) {
  let phase = 'intro';           // intro → calibrating → done
  let snapshot = null;           // analog block before START (for Cancel)
  let pollTimer = 0;
  let polling = false;
  let previews = [];

  const steps = h('div.steps', h('span.step'), h('span.step'), h('span.step'));
  const setStep = (n) => [...steps.children].forEach((s, i) => { s.dataset.state = i < n ? 'done' : i === n ? 'active' : ''; });

  const dlg = openDialog({
    title: sticks.length > 1 ? t('Calibrate sticks') : t('Calibrate stick'), icon: 'calibrate', tone: 'red',
    onClose: () => { if (phase === 'calibrating') cancel(true); cleanup(); },
  });

  function cleanup() {
    clearInterval(pollTimer);
    pollTimer = 0;
    previews.forEach((p) => p.destroy());
    previews = [];
  }

  // ---- Step 1: get ready ---------------------------------------------------------------
  function intro(error) {
    phase = 'intro';
    setStep(0);
    dlg.setTitle(sticks.length > 1 ? t('Calibrate sticks') : t('Calibrate stick'));
    dlg.setBody(
      steps,
      error && callout({ tone: 'red', title: t('Couldn’t start.'), text: error }),
      h('ol.cal-steps',
        h('li', h('strong', sticks.length > 1 ? t('Let go of both sticks.') : t('Let go of the stick.')),
          ' ', t('Rest the controller on a table — the stick’s center is recorded the moment you press Start calibration.')),
        h('li', h('strong', t('Roll slowly around the edge.')),
          ' ', t('Push the stick to the rim and turn it in full circles, about 3 laps, keeping gentle pressure against the gate.')),
        h('li', h('strong', t('Press Finish.')), ' ', t('Then check the result and save.'))),
      sticks.length > 1 && callout({ tone: 'blue', text: t('Both sticks are calibrated together — you can roll them one after the other.') }),
      callout({ tone: 'yellow', text: t('Calibration also resets the response curve to linear (1.00).') }),
    );
    dlg.setActions([
      { label: t('Cancel'), variant: 'ghost', value: false },
      { label: t('Start calibration'), icon: 'play', variant: 'primary', onClick: () => { start(); return false; } },
    ]);
  }

  // ---- Step 2: calibrating --------------------------------------------------------------
  async function start() {
    dlg.setActions([{ label: t('Starting…'), variant: 'primary', disabled: true }]);
    try {
      await session.flush(); // nothing pending may land on top of the calibration
      snapshot = session.config.analog.buffer.slice();
      const { status } = await session.command('analog', 'CALIBRATE_START');
      if (!status) throw new Error(t('The controller didn’t accept the calibration command.'));
    } catch (err) {
      intro(err?.message || String(err));
      return;
    }
    phase = 'calibrating';
    setStep(1);
    dlg.setTitle(sticks.length > 1 ? t('Roll the sticks around the edge') : t('Roll the stick around the edge'));

    const labels = { left: t('Left stick'), right: t('Right stick') };
    previews = sticks.map((s) => shapePreview(session, s, labels[s]));
    const rollText = sticks.length > 1 ? t('Slowly roll each stick around its outer edge…') : t('Slowly roll the stick around its outer edge…');
    const status = h('p.cal-status.muted', { role: 'status' }, rollText);
    dlg.setBody(
      steps,
      h('p', t('Keep gentle pressure against the rim and go all the way round, slowly. The green shape grows as each direction is captured.')),
      h('div.cal-grid', previews.map((p) => p.el)),
      status,
    );
    dlg.setActions([
      { label: t('Cancel'), variant: 'ghost', onClick: () => { cancel(false); return false; } },
      { label: t('Finish'), icon: 'check', variant: 'primary', id: 'finish', onClick: () => { finish(); return false; } },
    ]);

    const tick = async () => {
      if (polling || phase !== 'calibrating') return;
      polling = true;
      try { await session.refresh('analog'); } catch { /* keep trying; a slow read is fine */ }
      polling = false;
      if (phase !== 'calibrating') return;
      const progress = previews.map((p) => p.update());
      const all = progress.every((x) => x >= 1);
      status.className = `cal-status ${all ? 'ok' : 'muted'}`;
      status.replaceChildren(all
        ? h('span', icon('check'), ' ', t('Looks good! A couple more slow laps improves accuracy — then press Finish.'))
        : rollText);
    };
    previews.forEach((p) => p.update());
    pollTimer = setInterval(tick, POLL_MS);
  }

  // ---- Step 3: finish --------------------------------------------------------------------
  async function finish() {
    phase = 'finishing';
    clearInterval(pollTimer);
    dlg.setActions([{ label: t('Finishing…'), variant: 'primary', disabled: true }]);
    let ok = false;
    try {
      const { status } = await session.command('analog', 'CALIBRATE_STOP');
      ok = status;
      await session.refresh('analog');                        // hoja2: populateUIElements(true)
      if (ok) await session.commit('analog', { immediate: true }); // light up Save (same data)
    } catch (err) {
      console.error('[calibrate]', err);
      ok = false;
    }
    phase = 'done';
    cleanup();
    session.refreshAttention?.();
    onFinished?.(ok);
    setStep(3);
    if (!ok) {
      dlg.setTitle(t('Calibration didn’t finish'));
      dlg.setBody(steps, callout({ tone: 'red', text: t('The controller didn’t confirm. Unplug it, plug it back in and try again.') }));
      dlg.setActions([{ label: t('Close'), variant: 'primary', value: false }]);
      return;
    }
    dlg.setTitle(t('Calibrated!'));
    dlg.setBody(
      steps,
      h('div.cal-done', h('span.face.tone-green', { style: { '--size': '56px' } }, icon('check')),
        h('div',
          h('p', h('strong', t('Check it:')), ' ', sticks.length > 1
            ? t('Move the sticks around — they should reach the edge of the circle in every direction and rest in the center.')
            : t('Move the stick around — it should reach the edge of the circle in every direction and rest in the center.')),
          h('p.muted.small', t('Calibration is active now. Press Save to keep it after unplugging.')))),
    );
    dlg.setActions([
      { label: t('Close'), variant: 'ghost', value: true },
      {
        label: t('Save to controller'), icon: 'save', variant: 'primary',
        onClick: async () => {
          const saved = await session.save();
          toast(saved ? t('Saved to controller') : t('Save failed'), { tone: saved ? 'green' : 'red' });
          return true;
        },
      },
    ]);
  }

  /** STOP, then restore the pre-calibration block. `closing` = dialog already closing. */
  async function cancel(closing) {
    phase = 'canceling';
    clearInterval(pollTimer);
    if (!closing) dlg.setActions([{ label: t('Canceling…'), variant: 'ghost', disabled: true }]);
    try {
      await session.command('analog', 'CALIBRATE_STOP');
      if (snapshot) {
        session.config.analog.buffer.set(snapshot);
        await session.commit('analog', { immediate: true });
      }
      await session.refresh('analog');
    } catch (err) {
      console.error('[calibrate] cancel', err);
    }
    phase = 'done';
    onFinished?.(false);
    if (!closing) {
      toast(t('Calibration canceled — previous settings restored.'), { tone: 'blue' });
      dlg.close(false);
    }
  }

  intro();
  return dlg;
}

/** Button that opens the calibration dialog. */
export function calibrateButton(o) {
  return button({ label: o.label || t('Calibrate'), icon: 'calibrate', variant: o.variant || 'danger', onClick: () => openCalibration(o) });
}
