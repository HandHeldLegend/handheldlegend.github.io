/**
 * stage.js — The arena's geometry: one solid main platform, three pass-through platforms, two
 * ledges, blast zones and the target layout. An original layout (units: main platform = 136 wide).
 */

export const STAGE = {
  /** Solid main platform: top surface at y = 0, solid down to y = -main.depth. */
  main: { id: 'main', x1: -68, x2: 68, y: 0, depth: 30, solid: true },
  /** Pass-through platforms (land from above, drop through with a down flick). */
  platforms: [
    { id: 'left', x1: -56, x2: -22, y: 28, solid: false },
    { id: 'right', x1: 22, x2: 56, y: 28, solid: false },
    { id: 'top', x1: -18, x2: 18, y: 56, solid: false },
  ],
  /** Ledges hang off the main platform's corners; `dir` points toward the stage. */
  ledges: [
    { x: -68, y: 0, dir: 1 },
    { x: 68, y: 0, dir: -1 },
  ],
  /** Leaving this box is a KO; the fighter respawns above the stage. */
  blast: { left: -200, right: 200, top: 175, bottom: -110 },
  spawn: { x: 0, y: 0 },
  respawn: { x: 0, y: 76 },
  /** The camera always keeps this box in view (plus the fighter). */
  view: { left: -124, right: 124, top: 108, bottom: -42 },
};

export const SURFACES = [STAGE.main, ...STAGE.platforms];

/**
 * Target positions. Each one rewards a different skill: grounded jab, platform play, a high target
 * that needs a full hop + double jump, two below the ledges (drop from the ledge and attack), and two
 * far off-stage that need a recovery.
 */
export const TARGETS = [
  { x: 0, y: 7 },
  { x: 58, y: 7 },
  { x: -39, y: 40 },
  { x: 39, y: 40 },
  { x: 0, y: 70 },
  { x: 0, y: 100 },
  { x: -82, y: -16 },
  { x: 82, y: -16 },
  { x: -112, y: 32 },
  { x: 112, y: 32 },
];
export const TARGET_R = 5;
