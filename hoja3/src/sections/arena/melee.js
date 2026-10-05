/**
 * melee.js — What a classic GameCube platform fighter (Melee) would see from your controller.
 *
 * Pipeline, every simulation frame (original code; behaviour described in the sources listed in
 * constants.js → "Input pipeline sources"):
 *
 *   1. GameCube byte. The HOJA firmware's GameCube core turns a full-scale stick (±2048, 12-bit) into
 *      ±110 around a center of 128 (core_gamecube.c: target_max = 110 / 2048), and an analog trigger
 *      into 0..255 (12-bit >> 4; a digital press sends 255). We do the same from the browser's −1..1 /
 *      0..1 values or the HOJA USB stream, so 1.0 here = what the controller would send at full scale.
 *   2. Stick units. The game subtracts the origin (128) and clamps the vector radially to 80 units
 *      (longer vectors are scaled back onto the circle, both axes together). 1.0 = 80 units, so every
 *      value the game can see is a multiple of 1/80 = 0.0125.
 *   3. Deadzone. Per axis: an axis whose magnitude is below 23 units (0.2875) reads as exactly 0.
 *      22 units → 0, 23 units → 0.2875. It is a cross, not a circle.
 *   4. Analog triggers. 0..255 is clamped to the game's analog range 0..140 and divided by 140; values
 *      below 43 (0.30714) don't register as a shield. 43..140 is the light-shield band, 140 = full.
 *      A digital press reads as 1.0 (full shield).
 */
import { MELEE } from './constants.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Unit stick value (−1..1, 1 = controller full scale) → GameCube stick byte (0..255, center 128). */
export function gcStickByte(v) {
  return clamp(Math.round(v * MELEE.GC_STICK_FULL) + MELEE.GC_CENTER, 0, 255);
}

/** Unit trigger value (0..1) → GameCube analog trigger byte (0..255). */
export function gcTriggerByte(v) {
  return clamp(Math.round(v * 255), 0, 255);
}

/**
 * Melee processing of one stick from integer offsets (−128..127 around the origin).
 * @returns {{ux: number, uy: number, x: number, y: number}} units after clamp + deadzone, and floats
 */
export function meleeStickUnits(dx, dy) {
  let ux = dx; let uy = dy;
  const m = Math.hypot(ux, uy);
  if (m > MELEE.STICK_MAX) {
    // Scale back onto the 80-unit circle; the game keeps whole units (truncate toward zero).
    ux = Math.trunc((ux * MELEE.STICK_MAX) / m);
    uy = Math.trunc((uy * MELEE.STICK_MAX) / m);
  }
  if (Math.abs(ux) < MELEE.DEADZONE_UNITS) ux = 0;
  if (Math.abs(uy) < MELEE.DEADZONE_UNITS) uy = 0;
  return { ux, uy, x: ux / MELEE.STICK_MAX, y: uy / MELEE.STICK_MAX };
}

/** Unit stick (x, y) → Melee stick, with the GameCube bytes on the way. */
export function meleeStick(x, y) {
  const bx = gcStickByte(x); const by = gcStickByte(y);
  return { ...meleeStickUnits(bx - MELEE.GC_CENTER, by - MELEE.GC_CENTER), bx, by };
}

/**
 * Melee analog trigger from a unit value (0..1) or a digital press.
 * @returns {{value: number, n: number, byte: number}} value 0..1 (0 below the light-shield minimum),
 *          n = analog units 0..140, byte = GameCube byte
 */
export function meleeTrigger(v, digital = false) {
  if (digital) return { value: 1, n: MELEE.TRIGGER_MAX, byte: 255 };
  const byte = gcTriggerByte(v);
  const n = Math.min(MELEE.TRIGGER_MAX, byte);
  return { value: n < MELEE.TRIGGER_MIN ? 0 : n / MELEE.TRIGGER_MAX, n, byte };
}
