/**
 * game.js — The simulation: fighter + targets + projectiles + timer, advanced one 60 Hz frame at a time.
 *
 * The Game knows nothing about the DOM or the canvas. view/play.js feeds it input snapshots from a
 * fixed-timestep accumulator and render.js draws whatever state it is in.
 */
import { FRAMES, STEP_MS } from './constants.js';
import { STAGE, TARGETS, TARGET_R } from './stage.js';
import { Fighter } from './fighter.js';
import { PadState } from './controller.js';
import { SnapbackWatch, describeSnap } from './analysis.js';
import { t } from '../../i18n/index.js';

export function newStats() {
  return {
    wavedash: { n: 0, perfect: 0, angleSum: 0 },
    lcancel: { n: 0, ok: 0 },
    hops: { n: 0, short: 0 },
    dashback: { n: 0, ok: 0, perfect: 0 },
    fastfall: { n: 0, perfect: 0 },
    shieldDrop: { n: 0, ok: 0 },
    ledge: 0,
    ko: 0,
    targets: 0,
    snapback: 0,
  };
}

export class Game {
  /**
   * @param {{mode?: 'free'|'targets', tapJump?: boolean, onFeedback?: Function, onRecord?: Function,
   *          bestTime?: number|null, fighter?: string, jumpBuffer?: boolean}} o  fighter: roster id
   */
  constructor(o = {}) {
    this.mode = o.mode || 'free';
    this.tapJump = o.tapJump ?? true;
    this.jumpBuffer = !!o.jumpBuffer; // retry ignored jump presses for FRAMES.JUMP_BUFFER frames
    this.onFeedback = o.onFeedback || (() => {});
    this.onRecord = o.onRecord || (() => {});
    this.bestTime = o.bestTime ?? null;
    this.stats = newStats();
    this.frame = 0;
    this.pad = new PadState();
    // Warn about stick snapback as the game sees it (once per 60 Hz frame).
    this.snapWatch = new SnapbackWatch((e) => { this.stats.snapback++; this.feedback(describeSnap(e), 'red'); });
    this.fighter = new Fighter(this, o.fighter);
    this.sparks = [];
    this.effects = [];
    this.resetRun();
  }

  feedback(text, tone = 'lavender') {
    this.onFeedback({ text, tone, frame: this.frame });
  }

  /** Reset fighter + targets (+ timer in target mode). */
  resetRun() {
    this.fighter.spawn(STAGE.spawn, false);
    this.targets = TARGETS.map((t, i) => ({ ...t, id: i, alive: true, brokenAt: -1 }));
    this.sparks = [];
    this.timer = { state: this.mode === 'targets' ? 'ready' : 'off', start: 0, end: 0 };
  }

  /** Switch the fighter's movement profile (restarts the run). */
  setFighter(id) {
    this.fighter.setProfile(id);
    this.resetRun();
  }

  setMode(mode) {
    this.mode = mode;
    this.resetRun();
  }

  resetStats() { this.stats = newStats(); }

  /** Elapsed target-test time in ms (live while running). */
  elapsedMs() {
    const t = this.timer;
    if (t.state === 'running') return (this.frame - t.start) * STEP_MS;
    if (t.state === 'done') return (t.end - t.start) * STEP_MS;
    return 0;
  }

  get targetsLeft() { return this.targets.filter((t) => t.alive).length; }

  spawnSpark(x, y, vx) {
    this.sparks.push({ x, y, vx, prevX: x, life: 70 });
  }

  /** Advance one frame with an InputManager snapshot. */
  step(snapshot) {
    this.frame++;
    const p = this.pad;
    p.update(snapshot);
    this.snapWatch.update(p.x, p.y, this.frame * STEP_MS);
    const f = this.fighter;

    // Target test: the clock starts on the first real input after a reset.
    if (this.timer.state === 'ready' && p.any) { this.timer.state = 'running'; this.timer.start = this.frame - 1; }

    f.step(p);

    // Sparks fly straight and fade.
    for (const s of this.sparks) { s.prevX = s.x; s.x += s.vx; s.life--; }
    this.sparks = this.sparks.filter((s) => s.life > 0 && s.x > STAGE.blast.left && s.x < STAGE.blast.right);

    // Hits: fighter hitboxes and sparks vs targets.
    const boxes = f.activeHitboxes();
    for (const t of this.targets) {
      if (!t.alive) continue;
      let hit = boxes.some((b) => Math.hypot(b.x - t.x, b.y - t.y) <= b.r + TARGET_R);
      for (const s of this.sparks) {
        if (s.life > 0 && Math.abs(s.y - t.y) <= TARGET_R + 2 && segHit(s.prevX, s.x, t.x, TARGET_R + 2)) { hit = true; s.life = 0; }
      }
      if (hit) this.breakTarget(t);
    }

    // Free play: targets come back after a while.
    if (this.mode === 'free') {
      for (const t of this.targets) if (!t.alive && this.frame - t.brokenAt >= FRAMES.TARGET_RESPAWN) t.alive = true;
    }

    // Blast zones.
    const b = STAGE.blast;
    if (f.state !== 'dead' && f.state !== 'respawn' && (f.x < b.left || f.x > b.right || f.y < b.bottom || f.y > b.top)) f.ko();

    // Age effects.
    this.effects = this.effects.filter((e) => this.frame - e.frame < e.life);
  }

  breakTarget(target) {
    target.alive = false;
    target.brokenAt = this.frame;
    this.stats.targets++;
    this.effects.push({ kind: 'burst', x: target.x, y: target.y, frame: this.frame, life: 30 });
    if (this.timer.state === 'running' && this.targetsLeft === 0) {
      this.timer.state = 'done';
      this.timer.end = this.frame;
      const ms = this.elapsedMs();
      const record = this.bestTime == null || ms < this.bestTime;
      if (record) { this.bestTime = ms; this.onRecord(ms); }
      this.feedback(record ? t('All targets cleared in {time} — new best!', { time: formatTime(ms) }) : t('All targets cleared in {time}', { time: formatTime(ms) }), 'green');
    }
  }
}

/** Did a point moving from a to b (1-D) pass within r of c? */
function segHit(a, b, c, r) {
  const lo = Math.min(a, b) - r; const hi = Math.max(a, b) + r;
  return c >= lo && c <= hi;
}

export function formatTime(ms) {
  if (ms == null || !Number.isFinite(ms)) return '—';
  const s = ms / 1000;
  const m = Math.floor(s / 60);
  const rest = (s - m * 60).toFixed(2).padStart(5, '0');
  return m ? `${m}:${rest}` : `${s.toFixed(2)}s`;
}

