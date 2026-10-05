/**
 * angle-map.js — Angle map editor for one stick (port of hoja2/components/angle-modifier.js plus the
 * angle handlers in hoja2/modules/analog-md.js).
 *
 * Each enabled joyConfigSlot_s is one row: input angle → output angle (where the notch physically is →
 * what the console sees there), input distance → output distance, and the angular "sticky" deadzone.
 * Every edit follows hoja2's sequence: mutate slots → write the analog block → re-read it (the firmware
 * validates and sorts slots on write) → re-render. writeSlots also sets analog_calibration_set (hoja2).
 *
 * Layout: one shared column header (with tips) and one compact grid row per slot. Wide editors (container
 * ≥ 600px) show a slot on one line; narrower ones wrap each slot into two lines (angles, then distances)
 * that line up with a two-line header. Unused slots are listed collapsed below the table.
 * A small radial diagram shows the gate (input points) and the output spokes; hovering or focusing a row
 * highlights that slot's input → output angle.
 *
 * Actions (all hoja2 unless noted):
 *   Capture (row)   ANALOG_CMD_CAPTURE_JOYSTICK_* → that row's in_angle/in_distance
 *   Add angle       capture → first disabled slot (out_angle = captured angle, out_distance 2048, deadzone 2°)
 *   Snap nearest    capture → nearest enabled slot's in_angle/in_distance ("Angle Set" in hoja2)
 *   Use (row)       new: enable/disable a slot keeping its values (disabling needs more than 8 enabled);
 *                   re-enabling a cleared slot places it in the widest gap between the enabled ones
 *   Delete (row)    reset slot to defaults and disable it (only while more than 8 are enabled)
 *   Reset angles    8 slots every 45°, the rest disabled
 */
import { h } from '../../ui/dom.js';
import { button, asyncButton, toggle, infoTip } from '../../ui/controls.js';
import { toast, confirmDialog } from '../../ui/overlay.js';
import { icon } from '../../ui/icons.js';
import { canvasSurface, withAlpha } from '../../ui/canvas-surface.js';
import { t, N_, plural } from '../../i18n/index.js';
import {
  readSlots, writeSlots, captureStick, angleDistance, clearSlot, resetSlots, SLOT_COUNT, MIN_ENABLED,
} from './analog.js';

/** Editable numeric columns. `head` is the (translated) column header, `name` the per-input accessible name. */
const COLUMNS = [
  { key: 'in_angle', area: 'ia', head: N_('Input angle'), name: N_('Input angle, slot {n}'), unit: '°', step: 0.01, min: 0, max: 360,
    tip: N_('Where the notch physically is, in degrees (0° = right, counter-clockwise). Capture fills this in.') },
  { key: 'out_angle', area: 'oa', head: N_('Output angle'), name: N_('Output angle, slot {n}'), unit: '°', step: 0.01, min: 0, max: 360,
    tip: N_('The exact angle the console receives at this notch, e.g. 45° for a perfect diagonal.') },
  { key: 'in_distance', area: 'id', head: N_('Input distance'), name: N_('Input distance, slot {n}'), unit: '', step: 0.01, min: 0, max: 4096,
    tip: N_('How far the stick physically travels at this angle (raw units). Calibration fills this in.') },
  { key: 'out_distance', area: 'od', head: N_('Output distance'), name: N_('Output distance, slot {n}'), unit: '', step: 0.01, min: 0, max: 2048,
    tip: N_('Output length at this angle (2048 = full).') },
  { key: 'deadzone', area: 'dz', head: N_('Snap zone'), name: N_('Snap zone in degrees, slot {n}'), unit: '°', step: 0.1, min: 0, max: 45,
    tip: N_('Angular deadzone: stick angles within this many degrees of the output angle snap exactly onto it.') },
];

/**
 * Input value text: angles keep up to 2 decimals (trailing zeros dropped), distances are shown as whole
 * raw units. Display only — edits write just the changed field, so the stored precision is kept.
 */
const fixed = (v, c) => String(Number(Number(v).toFixed(c.unit === '°' ? 2 : 0)));

/** Mini radial diagram: gate shape from the input points, output spokes, and the highlighted slot. */
function angleDiagram(stickName) {
  let slots = [];
  let focus = null; // highlighted slot (object) or null

  const surface = canvasSurface({ aspect: 1, className: 'am-diagram', label: t('{stick}: angle map diagram', { stick: stickName }), draw });

  function draw(ctx, w, hgt, c) {
    const cx = w / 2;
    const cy = hgt / 2;
    const rad = Math.min(w, hgt) / 2 - 6;
    if (rad < 8) return;
    const scale = Math.max(1200, ...slots.map((s) => s.in_distance)) * 1.08;
    const P = (angle, r) => { const a = (-angle * Math.PI) / 180; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; };

    ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fillStyle = c.surface2; ctx.fill();
    ctx.strokeStyle = c.border; ctx.lineWidth = 1; ctx.stroke();

    // Output spokes (+ sticky wedges)
    for (const s of slots) {
      const a = (-s.out_angle * Math.PI) / 180;
      const dz = (Math.max(0, s.deadzone) * Math.PI) / 180;
      if (dz > 0) {
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, rad, a - dz, a + dz); ctx.closePath();
        ctx.fillStyle = withAlpha(c.blue, s === focus ? 0.3 : 0.1); ctx.fill();
      }
      const [x, y] = P(s.out_angle, rad);
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y);
      ctx.strokeStyle = s === focus ? c.blue : withAlpha(c.textFaint, 0.5);
      ctx.lineWidth = s === focus ? 2.5 : 1;
      ctx.stroke();
    }

    // Gate shape through the input points
    const pts = [...slots].sort((a, b) => a.in_angle - b.in_angle).map((s) => P(s.in_angle, (Math.min(s.in_distance, scale) / scale) * rad));
    if (pts.length > 2) {
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.strokeStyle = withAlpha(c.red, 0.55); ctx.lineWidth = 1.5; ctx.stroke();
    }

    // Highlighted slot: arc from input angle to output angle
    if (focus) {
      const r = rad * 0.45;
      const a0 = (-focus.in_angle * Math.PI) / 180;
      const a1 = (-focus.out_angle * Math.PI) / 180;
      let d = a1 - a0;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      ctx.beginPath(); ctx.arc(cx, cy, r, a0, a0 + d, d < 0);
      ctx.strokeStyle = c.text; ctx.lineWidth = 1.5; ctx.stroke();
    }

    // Input points: hollow rings (matches the live view's input marker)
    for (const s of slots) {
      const [x, y] = P(s.in_angle, (Math.min(s.in_distance, scale) / scale) * rad);
      ctx.beginPath(); ctx.arc(x, y, s === focus ? 5 : 3.5, 0, Math.PI * 2);
      ctx.strokeStyle = c.red; ctx.lineWidth = s === focus ? 2.5 : 1.5; ctx.stroke();
    }
  }

  return {
    el: surface.el,
    set(next) { slots = next; if (focus && !slots.includes(focus)) focus = null; surface.invalidate(); },
    highlight(slot) { if (focus !== slot) { focus = slot; surface.invalidate(); } },
    destroy: () => surface.destroy(),
  };
}

/**
 * @param {{session: object, stick: 'left'|'right', tone?: string, onChanged?: () => void}} o
 */
export function angleMapEditor(o) {
  const { session, stick } = o;
  const stickName = stick === 'right' ? t('Right stick') : t('Left stick');
  let busy = false;

  const diagram = angleDiagram(stickName);
  const list = h('div.am-list', { role: 'rowgroup' });
  const unusedList = h('div.am-list', { role: 'rowgroup' });
  const unusedSummary = h('summary');
  const unused = h('details.am-unused', unusedSummary,
    h('p.am-help', t('Unused slots are ignored by the controller. Turn one on to add a notch — it starts in the widest gap.')),
    unusedList);
  const count = h('span.am-count');

  const head = h('div.am-row.am-head', { role: 'row' },
    h('span.am-c-num', { role: 'columnheader' }, '#'),
    h('span.am-c-on', { role: 'columnheader', 'data-tip': t('Turn a slot off to ignore it without losing its values.') }, t('Use')),
    ...COLUMNS.map((c) => h(`span.am-c-${c.area}`, { role: 'columnheader' }, h('span', t(c.head)), infoTip(t(c.tip)))),
    h('span.am-c-ar1', { 'aria-hidden': 'true' }, '→'),
    h('span.am-c-ar2', { 'aria-hidden': 'true' }, '→'),
    h('span.am-c-act', { role: 'columnheader' }, h('span.sr-only', t('Actions'))));

  const el = h('div.am',
    h('div.am-intro',
      h('p', t('Each row turns a direction you physically push (input angle) into an exact output angle. Use it to line notches up with perfect 45° steps or to shape custom gates.')),
      infoTip(t('Distances: input distance is how far the stick reaches at that angle (calibration measures it); output distance is how long the output is there (2048 = full). Snap zone: angles within that many degrees snap exactly onto the output angle, which makes notches feel precise.'))),
    h('div.am-tools',
      h('div.am-figure',
        diagram.el,
        h('div.am-legend', { 'aria-hidden': 'true' },
          h('span', h('i.js-swatch.in'), t('Input')),
          h('span', h('i.am-spoke'), t('Output')))),
      h('div.am-actions',
        h('div.am-action',
          asyncButton({ label: t('Add angle'), icon: 'plus', variant: 'tonal', size: 'sm', busyLabel: t('Capturing…'), okLabel: t('Added'), run: addAngle }),
          h('span.am-help', t('Hold the stick at a notch, then press to add a slot there.'))),
        h('div.am-action',
          asyncButton({ label: t('Snap nearest'), icon: 'calibrate', variant: 'ghost', size: 'sm', busyLabel: t('Capturing…'), okLabel: t('Snapped'), run: snapNearest }),
          h('span.am-help', t('Moves the closest slot’s input to where the stick is now.'))),
        count)),
    h('div.am-table', { role: 'table', 'aria-label': t('{stick} angle map', { stick: stickName }) }, head, list),
    unused,
    h('div.am-foot',
      button({ label: t('Reset to 8-way (45°)'), icon: 'refresh', variant: 'ghost', size: 'sm', onClick: resetAll }),
      h('span.am-help', t('Recalibrate afterwards.'))));

  /** Run an edit exclusively and refresh afterwards. Returns false on failure. */
  async function run(fn) {
    if (busy) return false;
    busy = true;
    el.setAttribute('aria-busy', 'true');
    try {
      const r = await fn();
      return r !== false;
    } catch (err) {
      console.error('[angles]', err);
      toast(t('Couldn’t update the angle map. Check the connection and try again.'), { tone: 'red' });
      return false;
    } finally {
      busy = false;
      el.removeAttribute('aria-busy');
      render();
      o.onChanged?.();
    }
  }

  async function capture() {
    const c = await captureStick(session, stick);
    if (!c) toast(t('The controller didn’t report a stick position.'), { tone: 'red' });
    return c;
  }

  function addAngle() {
    return run(async () => {
      const slots = readSlots(session, stick);
      const free = slots.find((s) => !s.enabled);
      if (!free) { toast(t('All {n} angle slots are in use. Delete one first.', { n: SLOT_COUNT }), { tone: 'yellow' }); return false; }
      const c = await capture();
      if (!c) return false;
      free.in_angle = c.angle;
      free.in_distance = c.distance;
      free.out_angle = c.angle;
      free.out_distance = 2048;
      free.deadzone = 2;
      free.enabled = 1;
      await writeSlots(session, stick, slots);
    });
  }

  function snapNearest() {
    return run(async () => {
      const c = await capture();
      if (!c) return false;
      const slots = readSlots(session, stick);
      let best = -1;
      let bestD = Infinity;
      slots.forEach((s, i) => {
        if (!s.enabled) return;
        const d = angleDistance(c.angle, s.in_angle);
        if (d < bestD) { bestD = d; best = i; }
      });
      if (best < 0) return false;
      slots[best].in_angle = c.angle;
      slots[best].in_distance = c.distance;
      await writeSlots(session, stick, slots);
    });
  }

  function captureRow(index) {
    return run(async () => {
      const c = await capture();
      if (!c) return false;
      const slots = readSlots(session, stick);
      slots[index].in_angle = c.angle;
      slots[index].in_distance = c.distance;
      await writeSlots(session, stick, slots);
    });
  }

  function deleteRow(index) {
    return run(async () => {
      const slots = readSlots(session, stick);
      if (slots.filter((s) => s.enabled).length <= MIN_ENABLED) return false;
      clearSlot(slots[index]);
      await writeSlots(session, stick, slots);
    });
  }

  /** Turn a slot on/off, keeping its values. A slot that would duplicate an enabled angle goes into the widest gap. */
  function setEnabled(index, on) {
    return run(async () => {
      const slots = readSlots(session, stick);
      const others = slots.filter((s, i) => s.enabled && i !== index);
      if (!on && others.length < MIN_ENABLED) return false;
      const slot = slots[index];
      if (on && others.length && others.some((s) => angleDistance(s.in_angle, slot.in_angle) < 1)) {
        const sorted = [...others].sort((a, b) => a.in_angle - b.in_angle);
        let gap = -1; let from = sorted[0]; let to = sorted[0];
        sorted.forEach((s, i) => {
          const next = sorted[(i + 1) % sorted.length];
          const g = (((next.in_angle - s.in_angle) % 360) + 360) % 360 || 360;
          if (g > gap) { gap = g; from = s; to = next; }
        });
        const mid = (from.in_angle + gap / 2) % 360;
        slot.in_angle = mid;
        slot.out_angle = mid;
        slot.in_distance = (from.in_distance + to.in_distance) / 2;
        slot.out_distance = 2048;
        slot.deadzone = 2;
      }
      slot.enabled = on ? 1 : 0;
      await writeSlots(session, stick, slots);
    });
  }

  function editCell(index, key, raw, col) {
    let v = parseFloat(raw);
    if (!Number.isFinite(v)) v = 0;
    v = Math.max(col.min, Math.min(col.max, v));
    if (key.endsWith('angle')) v = ((v % 360) + 360) % 360;
    return run(async () => {
      const slots = readSlots(session, stick);
      slots[index][key] = v;
      await writeSlots(session, stick, slots);
    });
  }

  async function resetAll() {
    const ok = await confirmDialog({
      title: stick === 'right' ? t('Reset the right stick’s angle map?') : t('Reset the left stick’s angle map?'),
      message: t('This replaces the angle map with 8 evenly spaced angles (every 45°) and default distances. You’ll want to calibrate again afterwards.'),
      confirmLabel: t('Reset to 8-way'), danger: true,
    });
    if (!ok) return;
    const done = await run(async () => {
      await writeSlots(session, stick, resetSlots(readSlots(session, stick)));
    });
    if (done) toast(t('Angles reset'), { tone: 'green' });
  }

  /** One grid row (enabled or unused slot). */
  function slotRow(slot, index, n, enabledCount) {
    const on = !!slot.enabled;
    const label = on ? String(n) : '–';
    const canDisable = enabledCount > MIN_ENABLED;
    const minMsg = t('At least {n} angles are required', { n: MIN_ENABLED });
    const use = toggle({
      checked: on, tone: o.tone,
      label: on ? t('Use slot {n}', { n: label }) : t('Use unused slot'),
      disabled: on && !canDisable,
      onChange: (v) => setEnabled(index, v),
    });
    if (on && !canDisable) use.dataset.tip = minMsg;
    const row = h('div.am-row', { role: 'row', class: on ? null : 'off', dataset: { index } },
      h('span.am-c-num', { role: 'cell' }, h('span.am-num', label)),
      h('span.am-c-on', { role: 'cell' }, use),
      ...COLUMNS.map((c) => {
        const input = h('input.input.num', {
          type: 'number', step: c.step, min: c.min, max: c.max, inputmode: 'decimal', disabled: !on,
          value: fixed(slot[c.key], c), 'aria-label': t(c.name, { n: label }),
        });
        input.addEventListener('change', () => editCell(index, c.key, input.value, c));
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
        return h(`span.am-c-${c.area}`, { role: 'cell' }, h('span.am-field', input, c.unit && h('span.am-unit', { 'aria-hidden': 'true' }, c.unit)));
      }),
      h('span.am-c-ar1', { 'aria-hidden': 'true' }, '→'),
      h('span.am-c-ar2', { 'aria-hidden': 'true' }, '→'),
      h('span.am-c-act', { role: 'cell' },
        on && asyncButton({ icon: 'download', variant: 'ghost', size: 'sm', title: t('Capture slot {n} from the stick (hold the stick at this notch first)', { n: label }), run: () => captureRow(index) }),
        on && button({
          icon: 'trash', variant: 'ghost', size: 'sm', disabled: !canDisable,
          title: canDisable ? t('Delete slot {n}', { n: label }) : minMsg,
          onClick: () => deleteRow(index),
        })));
    if (on) {
      const hi = () => diagram.highlight(slot);
      row.addEventListener('pointerenter', hi);
      row.addEventListener('focusin', hi);
      row.addEventListener('pointerleave', () => { if (!row.contains(document.activeElement)) diagram.highlight(null); });
      row.addEventListener('focusout', (e) => { if (!row.contains(e.relatedTarget)) diagram.highlight(null); });
    }
    return row;
  }

  function render() {
    const slots = readSlots(session, stick);
    const all = slots.map((slot, index) => ({ slot, index }));
    const enabled = all.filter((x) => x.slot.enabled);
    const off = all.filter((x) => !x.slot.enabled);
    count.textContent = t('{used} of {total} slots used', { used: enabled.length, total: SLOT_COUNT });
    diagram.set(enabled.map((x) => x.slot));
    list.replaceChildren(...enabled.map(({ slot, index }, n) => slotRow(slot, index, n + 1, enabled.length)));
    if (!enabled.length) list.append(h('p.muted.small', icon('info'), ' ', t('No angles enabled — press Reset to 8-way.')));
    unused.hidden = !off.length;
    unusedSummary.textContent = plural(off.length, '{n} unused slot', '{n} unused slots');
    unusedList.replaceChildren(...off.map(({ slot, index }) => slotRow(slot, index, 0, enabled.length)));
  }

  render();
  return { el, refresh: render, destroy: () => diagram.destroy() };
}
