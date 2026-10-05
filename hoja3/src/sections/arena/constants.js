/**
 * constants.js — Every tunable number in the Arena, in one place.
 *
 * Units: positions are "stage units" (the main platform is 136 units wide), velocities are units per
 * frame and every timing is in frames of the fixed 60 Hz simulation (1 frame = 16.67 ms).
 *
 * The thresholds below are what make the Arena a controller test: a technique only "comes out" when
 * the stick or trigger crosses the right line inside the right number of frames, exactly the kind of
 * precision a competitive platform fighter asks of a controller. All values are our own tuning for
 * this original sandbox. The input pipeline and stick/trigger thresholds follow publicly documented
 * Melee behaviour (see "Input pipeline sources" below); no game code, data tables or assets are used.
 *
 * Input pipeline sources (behaviour reference only; our code is original — see melee.js):
 *   - doldecomp/melee, src/sysdolphin/baselib/controller.c — read for HOW the pad library processes
 *     input: radial stick clamp that scales both axes together, linear trigger clamp, float scaling.
 *     https://github.com/doldecomp/melee
 *   - SmashWiki "Shield" (Melee light shield: analog factor n / 140 with n from 43 to 140; Z shield 49):
 *     https://www.ssbwiki.com/Shield
 *   - SmashWiki "Universal Controller Fix" (vanilla spot-dodge threshold y = −0.7):
 *     https://www.ssbwiki.com/Universal_Controller_Fix
 *   - Widely used community knowledge of Melee's stick values (from the game's common data, not from
 *     code): whole units of 1/80 = 0.0125 on an 80-unit circle, per-axis deadzone below 0.2875
 *     (23 units), dash/smash x at 0.8 (64 units), tap jump / fast fall y at 0.6625 (53 units).
 *     These match the thresholds controller modders target (e.g. UCF, notched-gate guides) but we could
 *     not confirm them from a fetchable primary source — NEEDS REVIEW against the game data.
 *   - HOJA firmware core_gamecube.c: full-scale stick → ±110 around 128; trigger 12-bit >> 4 → 0..255.
 * Values marked "approx." below are our tuning, not verified game constants.
 */

import { N_ } from '../../i18n/index.js';

export const STORAGE_KEY = 'hhl-config:arena';

/** Simulation rate. Everything below that says "frames" means 1/60 s ticks. */
export const FPS = 60;
export const STEP_MS = 1000 / FPS;
/** Never run more than this many catch-up steps per animation frame (avoids a "spiral of death"). */
export const MAX_STEPS_PER_RAF = 5;

// ---------------------------------------------------------------------------------------------
// Stick & trigger thresholds (stick values are normalized to a unit circle, +y = up)
// ---------------------------------------------------------------------------------------------
/** GameCube emulation + Melee processing constants (see melee.js and the sources above). */
export const MELEE = {
  GC_CENTER: 128,          // GameCube stick origin
  GC_STICK_FULL: 110,      // HOJA GameCube core: full-scale stick = ±110 around the origin
  STICK_MAX: 80,           // radial clamp: 80 units = 1.0 (steps of 0.0125)
  DEADZONE_UNITS: 23,      // per axis: |units| < 23 reads as 0 (22 → 0, 23 → 0.2875)
  TRIGGER_MAX: 140,        // analog L/R range 0..140 (value = n / 140)
  TRIGGER_MIN: 43,         // n below 43 doesn't register as a shield (43 / 140 = 0.30714)
};

export const STICK = {
  /** Per-axis deadzone edge: the first non-zero value the game can see (23 / 80). */
  NEUTRAL: 0.2875,
  /** |x| at or beyond this is a "smash" (dash, roll) if it was reached quickly enough (64 / 80). */
  SMASH_X: 0.8,
  /** |y| for tap-jump, fast fall and platform drop (53 / 80). */
  SMASH_Y: 0.6625,
  /** The smash threshold must be reached within this many frames of leaving neutral. With 2, the
   *  stick may spend at most ONE sampled frame in the "tilt zone" (between NEUTRAL and SMASH). */
  SMASH_WINDOW: 2,
  /** Holding the stick at or below this y crouches (approx.). */
  CROUCH_Y: -0.6,
  /** Shield-drop / spot-dodge vertical threshold (−56 / 80; approx.). */
  SHIELD_DOWN_Y: -0.7,
  /** Angle (degrees away from straight down) that still counts as "straight down" → spot dodge (approx.). */
  SPOTDODGE_CONE: 20,
  /** Shield drop happens when the stick crosses SHIELD_DOWN_Y between SPOTDODGE_CONE and this angle.
   *  This is the window a dedicated "shield-drop notch" on a notched gate is aimed at (approx.). */
  SHIELD_DROP_MAX: 55,
  /** Minimum stick magnitude for a directional airdodge; below it the airdodge is neutral (approx.).
   *  Airdodge / wavedash angles come from the quantized stick, so they snap to Melee's 1/80 grid. */
  AIRDODGE_MIN: 0.3,
  /** C-stick / attack direction threshold. */
  DIRECTION: 0.6,
};

export const TRIGGER = {
  /** Lightest analog shield (43 / 140); also counts as a press for airdodge / L-cancel. */
  SHIELD_MIN: MELEE.TRIGGER_MIN / MELEE.TRIGGER_MAX,
  /** Full analog range (140 / 140) or a digital press: "hard" shield. */
  HARD: 1,
};

/** Raw HOJA WebUSB stick values are centered ±2048 (12-bit). This maps them onto the unit circle. */
export const HOJA_FULL_SCALE = 2048;

// ---------------------------------------------------------------------------------------------
// Fighter physics (units / frame)
// ---------------------------------------------------------------------------------------------
export const PHYS = {
  BODY_R: 7,               // fighter body radius; feet are at (x, y), center at (x, y + BODY_R)
  GRAVITY: 0.11,
  MAX_FALL: 1.9,
  FAST_FALL: 2.6,

  WALK_MAX: 1.1,           // walk speed scales with stick |x| up to this
  WALK_ACCEL: 0.15,
  DASH_INITIAL: 1.7,       // speed on the first dash frame
  RUN_SPEED: 1.55,
  RUN_ACCEL: 0.1,
  FRICTION: 0.08,          // doubled while sliding faster than WALK_MAX (gives wavedashes a crisp stop)

  FULL_HOP: 3.0,           // initial jump speed (≈ 41 units high, ~54 frames in the air)
  SHORT_HOP: 1.9,          // (≈ 16 units high, ~35 frames in the air)
  DOUBLE_JUMP: 2.8,
  JUMP_H_INIT: 0.75,       // horizontal speed added from stick x on take-off
  JUMP_H_MAX: 1.45,
  GROUND_TO_AIR: 0.8,      // share of ground speed kept on take-off
  DJ_H: 0.9,

  AIR_SPEED: 1.0,
  AIR_ACCEL: 0.06,
  AIR_FRICTION: 0.02,

  AIRDODGE_SPEED: 3.1,
  AIRDODGE_DECAY: 0.9,     // velocity multiplier per frame during the dodge
  ROLL_DISTANCE: 32,
  LEDGE_JUMP: 2.9,
  SPECIAL_SPEED: 3.0,      // spark projectile
};

// ---------------------------------------------------------------------------------------------
// Fighter roster — movement profiles modelled on well-known classic platform-fighter movement
// ---------------------------------------------------------------------------------------------
/*
 * Original fighters (the round "Dot" body with different colours and accessories) whose MOVEMENT is
 * modelled on publicly documented character attributes from Super Smash Bros. Melee, so players can
 * test their controller with a familiar feel. Not affiliated with or endorsed by Nintendo or HAL
 * Laboratory; no game code, data files or assets are used — only the published attribute numbers.
 *
 * Attribute sources (SmashWiki attribute tables, NTSC Melee rows), fetched 2026-10:
 *   gravity          https://www.ssbwiki.com/Gravity
 *   fall / fast fall https://www.ssbwiki.com/Falling_speed , https://www.ssbwiki.com/Fast_fall
 *   traction         https://www.ssbwiki.com/Traction
 *   jumpsquat        https://www.ssbwiki.com/Jumpsquat
 *   dash / run       https://www.ssbwiki.com/Dash
 *   walk             https://www.ssbwiki.com/Walk
 *   air speed        https://www.ssbwiki.com/Air_speed
 *   air acceleration https://www.ssbwiki.com/Air_acceleration (max = base + additional)
 *   jump heights     https://www.ssbwiki.com/Jump (full hop / short hop heights, mid-air jumps)
 *   float            https://www.ssbwiki.com/Float (hold jump, then press down; up to 2.5 s)
 * Behaviour reference only (how jumpsquat → airborne, fast fall, airdodge and traction interact):
 *   doldecomp/melee https://github.com/doldecomp/melee — no code or data copied.
 * Notes: Rosette's fast fall is listed inconsistently on the wiki table (1.85 vs a +33% column); we
 * use 2.0. Vix's short-hop height isn't in the table; ~10.6 is derived from the commonly quoted
 * short-hop velocity of 2.1 and gravity 0.23. Both NEED REVIEW.
 *
 * Values are in the game's units; FIGHTER_SCALE converts them to arena units (our stage is smaller),
 * chosen so the all-rounder matches the arena's original tuning. Frames are the same 60 Hz frames.
 */
export const FIGHTER_SCALE = 1.15;

/**
 * g gravity · fall / ff max fall / fast-fall speed · jsq jumpsquat frames · dash initial dash ·
 * run run speed · walk max walk · air air speed · airAcc max air acceleration · traction ·
 * fh / sh full / short hop height · jumps mid-air jumps · float max float frames (0 = none).
 * look: body / band / feet colour tokens and an accessory, drawn on the round body (no likenesses).
 */
export const FIGHTERS = [
  { id: 'dot', name: 'Dot', feel: N_('All-rounder · balanced in every way'),
    g: 0.095, fall: 1.7, ff: 2.3, jsq: 4, dash: 1.5, run: 1.5, walk: 1.1, air: 0.86, airAcc: 0.045, traction: 0.06, fh: 29, sh: 11.025, jumps: 1, float: 0,
    look: { body: 'red', band: 'blue', feet: 'yellow', acc: 'cap' } },
  { id: 'vix', name: 'Vix', feel: N_('Fast faller · 3-frame jumpsquat · quick dash'),
    g: 0.23, fall: 2.8, ff: 3.4, jsq: 3, dash: 1.9, run: 2.2, walk: 1.6, air: 0.83, airAcc: 0.08, traction: 0.08, fh: 31.28, sh: 10.6, jumps: 1, float: 0,
    look: { body: 'yellow', band: 'green', feet: 'blue', acc: 'ears' } },
  { id: 'quill', name: 'Quill', feel: N_('Fast faller · huge jump · 5-frame jumpsquat'),
    g: 0.17, fall: 3.1, ff: 3.5, jsq: 5, dash: 1.9, run: 1.5, walk: 1.4, air: 0.83, airAcc: 0.07, traction: 0.08, fh: 51.5, sh: 11.58, jumps: 1, float: 0,
    look: { body: 'blue', band: 'yellow', feet: 'red', acc: 'crest' } },
  { id: 'sable', name: 'Sable', feel: N_('Swordfighter · floaty · long run'),
    g: 0.085, fall: 2.2, ff: 2.5, jsq: 4, dash: 1.5, run: 1.8, walk: 1.6, air: 0.9, airAcc: 0.05, traction: 0.06, fh: 35.09, sh: 13.995, jumps: 1, float: 0,
    look: { body: 'green', band: 'blue', feet: 'yellow', acc: 'headband' } },
  { id: 'rosette', name: 'Rosette', feel: N_('Floaty · float: hold jump, then press down'),
    g: 0.08, fall: 1.5, ff: 2.0, jsq: 5, dash: 1.2, run: 1.3, walk: 0.85, air: 1.1, airAcc: 0.07, traction: 0.1, fh: 31.36, sh: 16.8, jumps: 1, float: 150,
    look: { body: 'accent', band: 'yellow', feet: 'yellow', acc: 'crown' } },
  { id: 'rime', name: 'Rime', feel: N_('Low traction · longest wavedash · 3-frame jumpsquat'),
    g: 0.1, fall: 1.6, ff: 2.0, jsq: 3, dash: 1.4, run: 1.4, walk: 0.95, air: 0.7, airAcc: 0.047, traction: 0.035, fh: 35.1, sh: 10.5, jumps: 1, float: 0,
    look: { body: 'blue', band: 'green', feet: 'accent', acc: 'hood' } },
  { id: 'rally', name: 'Rally', feel: N_('Fastest runner · falls fast'),
    g: 0.13, fall: 2.9, ff: 3.5, jsq: 4, dash: 2.0, run: 2.3, walk: 0.85, air: 1.12, airAcc: 0.06, traction: 0.08, fh: 38.52, sh: 14.85, jumps: 1, float: 0,
    look: { body: 'red', band: 'yellow', feet: 'blue', acc: 'visor' } },
  { id: 'mochi', name: 'Mochi', feel: N_('Very floaty · 5 mid-air jumps · strong air control'),
    g: 0.064, fall: 1.3, ff: 1.6, jsq: 5, dash: 1.4, run: 1.1, walk: 0.7, air: 1.35, airAcc: 0.28, traction: 0.09, fh: 20.8, sh: 9.146, jumps: 5, float: 0,
    look: { body: 'accent', band: 'green', feet: 'red', acc: 'tuft' } },
];

/** Arena physics for a roster entry: PHYS with the profile's movement (scaled to arena units). */
export function fighterPhysics(f) {
  const k = FIGHTER_SCALE;
  const g = f.g * k;
  // Initial jump speed that reaches height h under gravity g with per-frame steps (v + v-g + … ≈ h).
  const jumpV = (h) => Math.sqrt(2 * g * h * k + (g * g) / 4) - g / 2;
  const fullHop = jumpV(f.fh);
  return {
    ...PHYS,
    GRAVITY: g, MAX_FALL: f.fall * k, FAST_FALL: f.ff * k,
    WALK_MAX: f.walk * k, DASH_INITIAL: f.dash * k, RUN_SPEED: f.run * k,
    FRICTION: f.traction * k,
    FULL_HOP: fullHop, SHORT_HOP: jumpV(f.sh), DOUBLE_JUMP: fullHop * (f.jumps > 1 ? 0.8 : 0.93),
    AIR_SPEED: f.air * k, AIR_ACCEL: f.airAcc * k,
    JUMPSQUAT: f.jsq, JUMPS: f.jumps, FLOAT: f.float,
  };
}

export const fighterById = (id) => FIGHTERS.find((f) => f.id === id) || FIGHTERS[0];

// ---------------------------------------------------------------------------------------------
// Frame windows (frames)
// ---------------------------------------------------------------------------------------------
export const FRAMES = {
  JUMPSQUAT: 4,            // crouch before leaving the ground. Release jump before it ends → short hop
  DASH: 12,                // initial dash; a smash the other way inside it is a dash back (dash dance)
  TURN: 6,                 // slow "tilt turn" when a dash back was too slow
  RUN_BRAKE: 10,
  RUN_TURN: 18,
  LAND: 4,                 // normal landing lag
  WAVELAND: 10,            // landing lag after an airdodge touches down (wavedash / waveland)
  SPECIAL_LAND: 10,
  LCANCEL: 7,              // press shield/Z within this many frames before landing to halve aerial lag
  AIRDODGE: 30,            // then helpless fall
  AIRDODGE_INTANGIBLE: [4, 26],
  WAVEDASH_MAX_AIR: 3,     // airdodge on airborne frame ≤ this (straight from a jump) counts as a wavedash
  LEDGEDASH_MAX: 45,       // ledge release → wave-land within this many frames counts as a ledgedash
  ROLL: 30, ROLL_MOVE: [4, 22], ROLL_INTANGIBLE: [4, 19],
  SPOTDODGE: 24, SPOTDODGE_INTANGIBLE: [2, 16],
  SHIELD_RELEASE: 14,
  SHIELD_BREAK: 150,
  LEDGE_WAIT: 8,           // frames hanging before ledge options are accepted
  LEDGE_REGRAB: 30,
  LEDGE_GETUP: 26,
  DROP_THROUGH: 10,        // platforms are ignored for this long after a drop
  SPECIAL_COOLDOWN: 24,
  RESPAWN_DELAY: 50,
  RESPAWN_WAIT: 180,
  TARGET_RESPAWN: 180,     // free play: broken targets come back after this long
  JUMP_BUFFER: 5,          // optional jump buffer (off by default): an ignored jump press is retried this long
};

export const SHIELD = {
  MAX: 60,
  DECAY: 0.28,             // per frame while held
  REGEN: 0.07,             // per frame while not shielding
  RADIUS: 11.5,            // full-health hard shield radius (units)
  LIGHT_GROWTH: 0.35,      // light shield is up to 35% larger (but you can see it's weaker)
};

export const LEDGE = { REACH_X: 14, REACH_Y: 24, HANG_X: 5, HANG_Y: 13 };

// ---------------------------------------------------------------------------------------------
// Keyboard shortcuts (KeyboardEvent.code). The keyboard never drives the character — the Arena is
// for testing the connected controller — it only pauses, frame-advances and resets.
// ---------------------------------------------------------------------------------------------
export const KEYS = {
  start: ['KeyP'],           // pause / resume
  select: ['KeyR'],          // reset position / restart run
  step: ['Period'],          // frame advance while paused
};

/** Simulation speeds offered in the Play toolbar. */
export const SPEEDS = [1, 0.5, 0.25];
