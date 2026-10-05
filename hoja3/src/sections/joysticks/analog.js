/**
 * analog.js — Small helpers around the analog config block for the Joysticks page.
 *
 * Angle maps ("joy_config_l" / "joy_config_r"): 16 × joyConfigSlot_s per stick.
 *   in_angle      degrees (0–360, 0 = right, counter-clockwise) where the physical notch/gate corner sits
 *   in_distance   how far the stick physically travels at that angle (raw stick units, ~1000–1700 typical)
 *   out_angle     degrees the firmware outputs for that notch (e.g. snap a slightly-off notch to exactly 45°)
 *   out_distance  output length at that angle (2048 = full)
 *   deadzone      angular "sticky" window in degrees around out_angle (snaps nearby angles onto it)
 *   enabled       slot in use. The firmware needs at least 8 enabled slots and sorts them on every write
 *                 (stick_scaling_init → _joy_validation_sort_and_count), so we re-read after writing.
 *
 * Capture commands (ANALOG_CMD_CAPTURE_JOYSTICK_LEFT/RIGHT) reply with two little-endian float32s:
 *   [0..3] angle in degrees, [4..7] distance — the stick's current *raw* (center-corrected) position.
 */

/** @typedef {{in_angle:number,out_angle:number,deadzone:number,in_distance:number,out_distance:number,enabled:number}} Slot */

export const SLOT_COUNT = 16;
export const MIN_ENABLED = 8;

export const slotField = (stick) => (stick === 'right' ? 'joy_config_r' : 'joy_config_l');
export const prefix = (stick) => (stick === 'right' ? 'r' : 'l');

/** Copy of a stick's 16 slots (struct copies — mutate then pass to writeSlots). */
export function readSlots(session, stick) {
  return session.config.analog[slotField(stick)];
}

/** Enabled slots with their real index into the 16-slot array. */
export function enabledSlots(session, stick) {
  return readSlots(session, stick).map((slot, index) => ({ slot, index })).filter((x) => x.slot.enabled);
}

/**
 * Write a stick's slots, push the analog block immediately and re-read it (the firmware re-sorts slots).
 * Like hoja2's writeAngleMemBlock(), editing the angle map also marks the sticks as calibrated.
 */
export async function writeSlots(session, stick, slots) {
  const cfg = session.config.analog;
  cfg[slotField(stick)] = slots;
  cfg.analog_calibration_set = 1;
  await pushAndReload(session);
}

/** Flush pending debounced writes, push the analog block now, then re-read it from the controller. */
export async function pushAndReload(session) {
  await session.commit('analog', { immediate: true });
  await session.refresh('analog');
}

/**
 * Ask the controller where a stick is pointing right now.
 * @returns {Promise<{angle:number, distance:number}|null>}
 */
export async function captureStick(session, stick) {
  const { status, data } = await session.command('analog', stick === 'right' ? 'CAPTURE_JOYSTICK_RIGHT' : 'CAPTURE_JOYSTICK_LEFT');
  if (!status || !data || data.byteLength < 8) return null;
  const v = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return { angle: v.getFloat32(0, true), distance: v.getFloat32(4, true) };
}

/** Smallest absolute difference between two angles in degrees (0–180). */
export function angleDistance(a, b) {
  const x = ((a % 360) + 360) % 360;
  const y = ((b % 360) + 360) % 360;
  const d = Math.abs(x - y);
  return Math.min(d, 360 - d);
}

/** Reset one slot to hoja2's "unused" defaults. */
export function clearSlot(slot) {
  slot.in_angle = 0;
  slot.in_distance = 2048;
  slot.out_angle = 0;
  slot.out_distance = 2048;
  slot.deadzone = 2;
  slot.enabled = 0;
  return slot;
}

/** hoja2's "Reset Angles": 8 slots every 45° (in_distance 1028), the rest disabled. */
export function resetSlots(slots) {
  slots.forEach((slot, i) => {
    if (i < 8) {
      slot.deadzone = 2;
      slot.in_angle = i * 45;
      slot.in_distance = 1028;
      slot.out_angle = i * 45;
      slot.out_distance = 2048;
      slot.enabled = 1;
    } else {
      clearSlot(slot);
    }
  });
  return slots;
}
