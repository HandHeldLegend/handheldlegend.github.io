/**
 * controller.js — Per-simulation-frame view of the input, with the frame-counting that techniques need.
 *
 * The fighter never looks at raw values directly; it asks questions like "was this a smash?" which
 * are answered here, once per 60 Hz frame, exactly like a game reads a controller once per frame.
 *
 * Smash detection: each axis side has an "entry frame" — the frame the stick left neutral on that
 * side (|v| ≥ STICK.NEUTRAL). When the stick first reaches the smash threshold we record the latency
 * (frames since entry). Latency 0 = reached the threshold on the very frame it left neutral
 * ("frame-perfect"), 1 = it was seen once in the tilt zone, ≥ 2 = too slow, reads as a tilt.
 */
import { STICK, TRIGGER } from './constants.js';

/** Tracks one axis (x or y) for side changes and threshold reach latency. */
class AxisTrack {
  constructor(thresholds) {
    this.thresholds = thresholds;
    this.side = 0;          // −1, 0, +1
    this.enter = 0;         // frame the current side was entered
    this.reached = new Set();
    this.events = new Map(); // threshold → latency, only on the frame it was first reached
  }

  update(v, frame) {
    const side = Math.abs(v) >= STICK.NEUTRAL ? Math.sign(v) : 0;
    if (side !== this.side) {
      this.side = side;
      this.enter = frame;
      this.reached.clear();
    }
    this.events.clear();
    if (!side) return;
    for (const th of this.thresholds) {
      if (Math.abs(v) >= th && !this.reached.has(th)) {
        this.reached.add(th);
        this.events.set(th, frame - this.enter);
      }
    }
  }

  /** Latency (frames) if `th` was first reached on this frame, else -1. */
  reach(th) { return this.events.has(th) ? this.events.get(th) : -1; }
  /** Frames spent on the current side (0 on the entry frame). */
  framesOnSide(frame) { return this.side ? frame - this.enter : -1; }
}

const BUTTONS = ['attack', 'special', 'jump', 'z', 'shield'];

export class PadState {
  constructor() {
    this.frame = 0;
    this.x = 0; this.y = 0; this.cx = 0; this.cy = 0;
    this.rawMag = 0;
    this.trigger = 0;
    this.held = {}; this.pressed = {}; this.heldFrames = {};
    for (const b of BUTTONS) { this.held[b] = false; this.pressed[b] = false; this.heldFrames[b] = 0; }
    this.ax = new AxisTrack([STICK.SMASH_X]);
    this.ay = new AxisTrack([STICK.SMASH_Y, Math.abs(STICK.SHIELD_DOWN_Y)]);
    this.prevShieldHeld = false;
    this.prevC = 0;
    this.cDir = null;
    this.any = false;
  }

  /**
   * Feed one input snapshot (from InputManager) for the next simulation frame.
   * s.presses (optional): press edges latched since the previous frame ({jump: 1, trig: 1, …}); a press
   * counts even if the button was already released again by the time this frame samples it.
   */
  update(s) {
    const latched = s.presses || {};
    const f = ++this.frame;
    // Game-side clamp: anything beyond the unit circle is pulled back onto it (like a real game).
    const m = Math.hypot(s.lx, s.ly);
    this.rawMag = m;
    const k = m > 1 ? 1 / m : 1;
    const px = this.x; const py = this.y;
    this.x = s.lx * k; this.y = s.ly * k;
    const cm = Math.hypot(s.cx, s.cy); const ck = cm > 1 ? 1 / cm : 1;
    this.cx = s.cx * ck; this.cy = s.cy * ck;

    this.ax.update(this.x, f);
    this.ay.update(this.y, f);

    // Triggers: combined analog value (digital shield = full press).
    const btnShield = !!s.btn.shield;
    this.trigger = Math.max(s.l || 0, s.r || 0, btnShield ? 1 : 0);
    const shieldHeld = this.trigger >= TRIGGER.SHIELD_MIN;
    this.shieldHeld = shieldHeld;
    this.shieldPressed = (shieldHeld && !this.prevShieldHeld) || latched.trig > 0;
    this.prevShieldHeld = shieldHeld;
    // Light-shield pressure 0..1 (0 = barely past the threshold, 1 = hard press).
    this.shieldPressure = this.trigger >= TRIGGER.HARD ? 1 : Math.max(0, (this.trigger - TRIGGER.SHIELD_MIN) / (TRIGGER.HARD - TRIGGER.SHIELD_MIN));

    const map = { attack: s.btn.attack, special: s.btn.special, jump: s.btn.jump, z: s.btn.z, shield: btnShield };
    let anyPress = false;
    for (const b of BUTTONS) {
      const now = !!map[b];
      this.pressed[b] = (now && !this.held[b]) || latched[b] > 0;
      this.held[b] = now;
      this.heldFrames[b] = now ? this.heldFrames[b] + 1 : 0;
      if (this.pressed[b]) anyPress = true;
    }

    // C-stick "flick" edge: direction on the frame it crosses STICK.DIRECTION.
    const cNow = Math.hypot(this.cx, this.cy) >= STICK.DIRECTION;
    this.cDir = cNow && !this.prevC ? dirOf(this.cx, this.cy) : null;
    this.prevC = cNow;

    this.moved = Math.hypot(this.x - px, this.y - py) > 0.25;
    this.any = anyPress || this.shieldPressed || this.cDir != null || (Math.hypot(this.x, this.y) > 0.5 && this.moved);
  }

  /** Smash on X this frame: returns ±1 when |x| reached SMASH_X within the smash window, else 0. */
  get xSmash() {
    const lat = this.ax.reach(STICK.SMASH_X);
    return lat >= 0 && lat < STICK.SMASH_WINDOW ? this.ax.side : 0;
  }
  /** {dir, latency} on the frame |x| first reaches SMASH_X on a side (any speed), else null. */
  get xReach() {
    const lat = this.ax.reach(STICK.SMASH_X);
    return lat >= 0 ? { dir: this.ax.side, latency: lat } : null;
  }
  get xSide() { return this.ax.side; }
  get xSideFrames() { return this.ax.framesOnSide(this.frame); }

  get yUpSmash() { const l = this.ay.reach(STICK.SMASH_Y); return this.ay.side > 0 && l >= 0 && l < STICK.SMASH_WINDOW; }
  get yDownSmash() { const l = this.ay.reach(STICK.SMASH_Y); return this.ay.side < 0 && l >= 0 && l < STICK.SMASH_WINDOW; }
  /** Latency if y crossed SHIELD_DOWN_Y (downwards) this frame, else -1. */
  get yShieldDown() { return this.ay.side < 0 ? this.ay.reach(Math.abs(STICK.SHIELD_DOWN_Y)) : -1; }
  get holdingDown() { return this.y <= -STICK.SMASH_Y; }

  /** Pressed shield or Z this frame (counts for L-cancel). */
  get lcancelPress() { return this.shieldPressed || this.pressed.z; }
}

/** 4-way direction of a vector: 'up' | 'down' | 'left' | 'right'. */
export function dirOf(x, y) {
  if (Math.abs(y) > Math.abs(x)) return y > 0 ? 'up' : 'down';
  return x > 0 ? 'right' : 'left';
}

/** Stick angle in degrees, 0 = right, 90 = up (0..360). */
export function angleDeg(x, y) {
  let a = (Math.atan2(y, x) * 180) / Math.PI;
  if (a < 0) a += 360;
  return a;
}
