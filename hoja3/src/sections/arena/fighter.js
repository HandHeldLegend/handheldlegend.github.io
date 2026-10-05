/**
 * fighter.js — "Dot", the arena's small round fighter, as a frame-by-frame state machine.
 *
 * One call to step(pad) = one 60 Hz frame. Each state handler reads the PadState (see controller.js)
 * and may switch state; integrate() then moves the fighter and resolves collisions with the stage.
 *
 * The techniques and the windows that decide them (all numbers live in constants.js):
 *   Dash / dash back   stick |x| must reach SMASH_X within SMASH_WINDOW frames of leaving neutral.
 *                      During the initial dash, doing that the other way is a dash back; if the stick
 *                      lingers in the tilt zone for SMASH_WINDOW frames instead, you get a slow turn.
 *   Short / full hop   jump held through the whole JUMPSQUAT → full hop; released earlier → short hop.
 *   Fast fall          a fresh down flick (SMASH_Y within the window) once vertical speed ≤ 0.
 *   Airdodge           a shield press in the air; direction from the stick. Touching ground during the
 *                      dodge converts the horizontal speed into a slide: wavedash (straight out of a
 *                      jump), waveland (from a fall) or ledgedash (just after letting go of the ledge).
 *   L-cancel           a shield/Z press within LCANCEL frames before an aerial lands halves its lag.
 *   Shield             analog trigger ≥ SHIELD_MIN. Lighter press = bigger but weaker-looking shield;
 *                      the shield shrinks as it loses health. Shield drop = crossing SHIELD_DOWN_Y at
 *                      an angle between SPOTDODGE_CONE and SHIELD_DROP_MAX away from straight down.
 *   Ledge              falling near a ledge snaps to it; then stick/jump/drop options.
 */
import { PHYS, FRAMES, STICK, SHIELD, LEDGE, fighterById, fighterPhysics } from './constants.js';
import { STAGE, SURFACES } from './stage.js';
import { MOVES, groundMove, airMove, relDir } from './moves.js';
import { t } from '../../i18n/index.js';

const R = PHYS.BODY_R;
const WALL_PAD = 0.01; // the stage's side walls are exactly at the ledges (feet-point collision)
const DEG = 180 / Math.PI;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const toward = (v, target, step) => v + clamp(target - v, -step, step);

/** Grounded states that stop at platform edges instead of sliding off. */
const EDGE_STOP = new Set(['shield', 'shieldRelease', 'spotdodge', 'roll', 'dizzy', 'attack', 'special', 'jumpsquat']);

export class Fighter {
  constructor(game, profileId) {
    this.game = game;
    this.setProfile(profileId);
    this.spawn(STAGE.spawn, false);
  }

  /** Switch movement profile (see FIGHTERS in constants.js). Frame windows follow the profile. */
  setProfile(id) {
    this.profile = fighterById(id);
    this.P = fighterPhysics(this.profile);
  }

  spawn(at, halo) {
    Object.assign(this, {
      x: at.x, y: at.y, vx: 0, vy: 0, prevX: at.x, prevY: at.y, facing: 1,
      state: halo ? 'respawn' : 'idle', sf: 0, ground: halo ? null : STAGE.main,
      jumps: this.P.JUMPS, airdodgeUsed: false, upSpecialUsed: false, fastfall: false,
      shieldHP: SHIELD.MAX, shieldPressure: 1,
      move: null, moveName: null, moveFrame: 0,
      airFrame: 0, fromJump: false, apexFrame: -1, ffNoted: false,
      ledge: null, ledgeCooldown: 0, ledgeDropFrame: -9999,
      dropThrough: 0, specialCooldown: 0,
      lastLcancel: -9999, lcMissedAt: -9999, lcLateNoted: true,
      jumpHeld: true, jumpViaTap: false, jumpHeldFrames: 0, earlyAirdodge: -1,
      adAngle: null, adAirFrame: 0, adFromJump: false, adFromLedge: false,
      landLag: 0, intangible: !!halo, dashDir: 1, rollDir: 1, skidTurn: false,
      holdDown: false, squash: 0, trail: [], getupFrom: null,
      jumpTaken: false, jumpBuf: null, floatLeft: this.P.FLOAT, floating: false,
    });
  }

  setState(s) { this.state = s; this.sf = 0; }

  /** Why a jump press can't be used in the current state (null = it can). Frames left are approximate. */
  jumpBlockedReason() {
    const busy = (action, n) => (n != null && n > 0
      ? t('Jump ignored · {action} ({n}f left)', { action, n: Math.ceil(n) })
      : t('Jump ignored · {action}', { action }));
    switch (this.state) {
      case 'landing': return busy(t('landing lag'), this.landLag - this.sf + 1);
      case 'jumpsquat': return busy(t('already in jumpsquat'));
      case 'air':
        if (this.move) return busy(t('aerial attack'), this.move.total - this.moveFrame);
        return this.jumps > 0 ? null : t('No jumps left');
      case 'airdodge': return busy(t('airdodge'), FRAMES.AIRDODGE - this.sf + 1);
      case 'helpless': return busy(t('helpless fall (until you land or grab a ledge)'));
      case 'attack': return busy(t('attack'), this.move ? this.move.total - this.moveFrame : null);
      case 'special': return busy(t('special'), 18 - this.sf + 1);
      case 'shieldRelease': return busy(t('shield release'), FRAMES.SHIELD_RELEASE - this.sf + 1);
      case 'roll': return busy(t('roll'), FRAMES.ROLL - this.sf + 1);
      case 'spotdodge': return busy(t('spot dodge'), FRAMES.SPOTDODGE - this.sf + 1);
      case 'dizzy': return busy(t('shield break'), FRAMES.SHIELD_BREAK - this.sf + 1);
      case 'ledge': return this.sf < FRAMES.LEDGE_WAIT ? busy(t('ledge grab'), FRAMES.LEDGE_WAIT - this.sf) : null;
      case 'ledgeGetup': return busy(t('ledge getup'));
      case 'respawn': case 'dead': return busy(t('respawning'));
      default: return null;
    }
  }
  get grounded() { return !!this.ground; }
  get feedback() { return this.game.feedback.bind(this.game); }
  get stats() { return this.game.stats; }

  /** Shield radius right now (units): shrinks with health, grows with a lighter press. */
  shieldRadius() {
    const health = 0.35 + 0.65 * (this.shieldHP / SHIELD.MAX);
    return SHIELD.RADIUS * health * (1 + SHIELD.LIGHT_GROWTH * (1 - this.shieldPressure));
  }

  /** World-space active hitboxes this frame. */
  activeHitboxes() {
    if (!this.move) return [];
    return this.move.hitboxes
      .filter((hb) => this.moveFrame >= hb.from && this.moveFrame <= hb.to)
      .map((hb) => ({ x: this.x + hb.x * this.facing, y: this.y + hb.y, r: hb.r }));
  }

  // ===========================================================================================
  // Frame
  // ===========================================================================================

  step(p) {
    const g = this.game;
    this.prevX = this.x; this.prevY = this.y;
    this.sf++;
    if (this.ledgeCooldown > 0) this.ledgeCooldown--;
    if (this.dropThrough > 0) this.dropThrough--;
    if (this.specialCooldown > 0) this.specialCooldown--;
    if (p.lcancelPress) this.lastLcancel = g.frame;
    if (this.state !== 'shield') this.shieldHP = Math.min(SHIELD.MAX, this.shieldHP + SHIELD.REGEN);
    this.holdDown = p.holdingDown;
    this.intangible = false;
    this.squash *= 0.8;

    // A jump press the current state can't use is explained (so "the game ignored it" never looks like
    // "the controller didn't send it"). With the optional jump buffer it is retried for a few frames.
    const realPress = p.pressed.jump;
    let injected = false;
    if (realPress) this.jumpBuf = null;
    else if (this.jumpBuf) { p.pressed.jump = true; injected = true; }
    const blocked = p.pressed.jump ? this.jumpBlockedReason() : null;
    this.jumpTaken = false;

    switch (this.state) {
      case 'idle': this.stIdle(p); break;
      case 'walk': this.stWalk(p); break;
      case 'dash': this.stDash(p); break;
      case 'run': this.stRun(p); break;
      case 'skid': this.stSkid(p); break;
      case 'turn': this.stTurn(p); break;
      case 'crouch': this.stCrouch(p); break;
      case 'jumpsquat': this.stJumpsquat(p); break;
      case 'landing': this.stLanding(p); break;
      case 'attack': this.stAttack(p); break;
      case 'special': this.stTimed(p, 18); break;
      case 'shield': this.stShield(p); break;
      case 'shieldRelease': this.stTimed(p, FRAMES.SHIELD_RELEASE); break;
      case 'roll': this.stRoll(p); break;
      case 'spotdodge': this.stSpotdodge(p); break;
      case 'dizzy': this.stDizzy(p); break;
      case 'air': this.stAir(p); break;
      case 'airdodge': this.stAirdodge(p); break;
      case 'helpless': this.stHelpless(p); break;
      case 'ledge': this.stLedge(p); break;
      case 'ledgeGetup': this.stLedgeGetup(p); break;
      case 'respawn': this.stRespawn(p); break;
      case 'dead': this.stDead(p); break;
      default: this.setState('idle');
    }

    if (injected) {
      const buf = this.jumpBuf;
      if (this.jumpTaken) { this.feedback(t('Buffered jump · pressed {n}f early', { n: buf.age + 1 }), 'lavender'); this.jumpBuf = null; }
      else if (++buf.age >= FRAMES.JUMP_BUFFER) { this.feedback(buf.reason, 'yellow'); this.jumpBuf = null; }
    } else if (realPress && !this.jumpTaken && blocked) {
      if (g.jumpBuffer) this.jumpBuf = { age: 0, reason: blocked };
      else this.feedback(blocked, 'yellow');
    }

    // Afterimages while airdodging (render decides whether to draw them).
    if (this.state === 'airdodge') this.trail.push({ x: this.x, y: this.y });
    else if (this.trail.length) this.trail.shift();
    if (this.trail.length > 6) this.trail.shift();

    this.integrate(p);
  }

  friction() {
    const f = Math.abs(this.vx) > this.P.WALK_MAX ? this.P.FRICTION * 2 : this.P.FRICTION;
    this.vx = toward(this.vx, 0, f);
  }

  // ===========================================================================================
  // Grounded states
  // ===========================================================================================

  /** Options shared by most actionable grounded states. Returns true if the state changed. */
  groundOptions(p, { allowDrop = true } = {}) {
    const g = this.game;
    if (p.pressed.jump || (g.tapJump && p.yUpSmash)) { this.startJumpsquat(!p.pressed.jump); return true; }
    if (p.shieldHeld) { this.setState('shield'); this.shieldPressure = p.shieldPressure; return true; }
    if (p.pressed.special) { this.groundSpecial(p); return true; }
    if (p.cDir) {
      const side = p.cDir === 'left' ? -1 : p.cDir === 'right' ? 1 : 0;
      if (side) this.facing = side;
      this.startAttack(groundMove(side ? 'forward' : p.cDir));
      return true;
    }
    if (p.pressed.attack) {
      const dir = relDir(p.x, p.y, this.facing, STICK.DIRECTION);
      if (dir === 'back') this.facing = -this.facing;
      this.startAttack(groundMove(dir));
      return true;
    }
    if (p.pressed.z) { this.startAttack('grab'); return true; }
    if (allowDrop && this.ground && !this.ground.solid && p.yDownSmash) {
      this.dropThroughPlatform();
      this.feedback(t('Platform drop'), 'blue');
      return true;
    }
    return false;
  }

  stIdle(p) {
    if (this.groundOptions(p)) return;
    if (p.xSmash) return this.startDash(p.xSmash);
    if (p.y <= STICK.CROUCH_Y) { this.setState('crouch'); return; }
    if (Math.abs(p.x) >= STICK.NEUTRAL) { this.facing = Math.sign(p.x); this.setState('walk'); this.walkPhysics(p); return; }
    this.friction();
  }

  stWalk(p) {
    if (this.groundOptions(p)) return;
    if (p.xSmash) return this.startDash(p.xSmash);
    if (p.y <= STICK.CROUCH_Y) { this.setState('crouch'); return; }
    if (Math.abs(p.x) < STICK.NEUTRAL) { this.setState('idle'); this.friction(); return; }
    this.facing = Math.sign(p.x);
    this.walkPhysics(p);
  }

  walkPhysics(p) {
    // Walk speed is proportional to how far the stick is pushed — a good way to feel stick resolution.
    this.vx = toward(this.vx, p.x * this.P.WALK_MAX, this.P.WALK_ACCEL);
  }

  startDash(dir) {
    this.facing = dir;
    this.dashDir = dir;
    this.vx = dir * Math.max(this.P.DASH_INITIAL, Math.abs(this.vx) * 0.5);
    this.setState('dash');
  }

  stDash(p) {
    // Dash back: smash the other way during the initial dash.
    const reach = p.xReach;
    if (reach && reach.dir === -this.dashDir && reach.latency < STICK.SMASH_WINDOW) {
      const st = this.stats.dashback; st.n++; st.ok++;
      if (reach.latency === 0) { st.perfect++; this.feedback(t('Dash back · frame-perfect'), 'green'); }
      else this.feedback(t('Dash back ✓ · {n}f in the tilt zone', { n: reach.latency }), 'green');
      this.startDash(-this.dashDir);
      return;
    }
    // Too slow: the stick sat in the tilt zone for a whole smash window → a turn, not a dash back.
    if (p.xSide === -this.dashDir && p.xSideFrames >= STICK.SMASH_WINDOW) {
      this.stats.dashback.n++;
      this.feedback(t('Dash back missed · stick sat {n}f in the tilt zone', { n: p.xSideFrames }), 'yellow');
      this.facing = -this.dashDir;
      this.setState('turn');
      return;
    }
    if (this.groundOptions(p)) return;
    if (this.sf < FRAMES.DASH) {
      this.vx = toward(this.vx, this.dashDir * this.P.RUN_SPEED, this.P.RUN_ACCEL);
      return;
    }
    if (p.xSide === this.dashDir) { this.setState('run'); return; }
    this.setState('idle');
  }

  stRun(p) {
    if (this.groundOptions(p)) return;
    if (p.y <= STICK.CROUCH_Y) { this.setState('crouch'); return; }
    if (p.xSide === -this.facing) { this.skidTurn = true; this.setState('skid'); return; }
    if (p.xSide !== this.facing) { this.skidTurn = false; this.setState('skid'); return; }
    this.vx = toward(this.vx, this.facing * this.P.RUN_SPEED, this.P.RUN_ACCEL);
  }

  stSkid(p) {
    if (p.pressed.jump || (this.game.tapJump && p.yUpSmash)) { this.startJumpsquat(!p.pressed.jump); return; }
    this.friction();
    if (this.sf < (this.skidTurn ? FRAMES.RUN_TURN : FRAMES.RUN_BRAKE)) return;
    if (this.skidTurn) this.facing = -this.facing;
    if (p.xSide === this.facing && Math.abs(p.x) >= STICK.SMASH_X) { this.setState('run'); return; }
    this.setState('idle');
  }

  stTurn(p) {
    if (this.groundOptions(p)) return;
    if (p.xSmash) return this.startDash(p.xSmash);
    this.friction();
    if (this.sf >= FRAMES.TURN) this.setState(Math.abs(p.x) >= STICK.NEUTRAL ? 'walk' : 'idle');
  }

  stCrouch(p) {
    if (this.groundOptions(p)) return;
    this.friction();
    if (p.y > STICK.CROUCH_Y + 0.05) this.setState('idle');
  }

  dropThroughPlatform() {
    this.ground = null;
    this.dropThrough = FRAMES.DROP_THROUGH;
    this.y -= 0.01;
    this.enterAir(false);
  }

  enterAir(fromJump) {
    this.move = null;
    this.setState('air');
    this.airFrame = 0;
    this.fromJump = fromJump;
    this.apexFrame = this.vy <= 0 ? this.game.frame : -1;
    this.ffNoted = false;
    this.fastfall = false;
    this.floating = false;
  }

  // ---- Jumping --------------------------------------------------------------------------------

  startJumpsquat(viaTap) {
    this.jumpTaken = true;
    this.setState('jumpsquat');
    this.jumpViaTap = viaTap;
    this.jumpHeld = true;
    this.jumpHeldFrames = 1; // the press frame counts
    this.earlyAirdodge = -1;
    this.squash = 1;
  }

  stJumpsquat(p) {
    // Short hop = jump released before the jumpsquat ends. Tap-jump: stick dropped back below neutral.
    const holding = this.jumpViaTap ? p.y >= STICK.NEUTRAL : p.held.jump;
    if (holding && this.jumpHeld) this.jumpHeldFrames++;
    else this.jumpHeld = false;
    if (p.shieldPressed) this.earlyAirdodge = this.P.JUMPSQUAT - this.sf + 1;
    this.friction();
    if (this.sf >= this.P.JUMPSQUAT) this.liftoff(p);
  }

  liftoff(p) {
    const short = !this.jumpHeld;
    this.vy = short ? this.P.SHORT_HOP : this.P.FULL_HOP;
    this.vx = clamp(this.vx * this.P.GROUND_TO_AIR + p.x * this.P.JUMP_H_INIT, -this.P.JUMP_H_MAX, this.P.JUMP_H_MAX);
    this.ground = null;
    this.enterAir(true);
    const st = this.stats.hops; st.n++;
    if (short) {
      st.short++;
      this.feedback(this.jumpViaTap ? t('Short hop ✓ · tap jump') : t('Short hop ✓ · jump held {n}f', { n: this.jumpHeldFrames }), 'green');
    } else {
      this.feedback(t('Full hop · held {n}f+ (short hop: release within {window}f)', { n: this.jumpHeldFrames, window: this.P.JUMPSQUAT }), 'lavender');
    }
    if (this.earlyAirdodge > 0) this.feedback(t('Airdodge {n}f too early — press it after lift-off', { n: this.earlyAirdodge }), 'yellow');
  }

  // ---- Landing ---------------------------------------------------------------------------------

  land(surface) {
    const g = this.game;
    const st = this.state;
    this.ground = surface;
    this.y = surface.y;
    this.vy = 0;
    this.jumps = this.P.JUMPS;
    this.floatLeft = this.P.FLOAT;
    this.floating = false;
    this.airdodgeUsed = false;
    this.upSpecialUsed = false;
    this.fastfall = false;
    let lag = FRAMES.LAND;
    if (st === 'airdodge') { lag = FRAMES.WAVELAND; this.reportWaveland(); }
    else if (st === 'helpless') lag = FRAMES.SPECIAL_LAND;
    else if (this.move?.landLag) lag = this.reportLcancel();
    this.move = null;
    this.landLag = lag;
    this.setState('landing');
    this.squash = 1;
    this.landFrame = g.frame;
  }

  reportWaveland() {
    const g = this.game;
    const below = this.adAngle == null ? null
      : Math.atan2(-Math.sin(this.adAngle), Math.abs(Math.cos(this.adAngle))) * DEG; // degrees below horizontal
    const ang = below == null ? t('neutral, no slide') : `${below.toFixed(1)}°`;
    if (this.adFromLedge) {
      const n = g.frame - this.ledgeDropFrame;
      this.feedback(t('Ledgedash · {angle} · landed {n}f after letting go', { angle: ang, n }), n <= 30 ? 'green' : 'blue');
      return;
    }
    if (this.adFromJump) {
      const st = this.stats.wavedash; st.n++;
      if (below != null) st.angleSum += below;
      const late = this.adAirFrame - 1;
      if (late === 0) st.perfect++;
      const rating = late === 0 ? t('frame-perfect') : t('{n}f late', { n: late });
      const steep = below != null && below > 45;
      this.feedback(steep ? t('Wavedash · {angle} · {rating} · steep (shallower slides further)', { angle: ang, rating })
        : t('Wavedash · {angle} · {rating}', { angle: ang, rating }), late === 0 && below != null && below <= 45 ? 'green' : 'blue');
      return;
    }
    this.feedback(t('Waveland · {angle}', { angle: ang }), 'blue');
  }

  reportLcancel() {
    const g = this.game;
    const st = this.stats.lcancel; st.n++;
    const since = g.frame - this.lastLcancel; // 0 = pressed on the landing frame
    const lag = this.move.landLag;
    this.lcLateNoted = false;
    if (since <= FRAMES.LCANCEL) {
      st.ok++;
      this.lcMissedAt = -9999;
      this.feedback(t('L-cancel ✓ · pressed {n}f before landing', { n: since }), 'green');
      return Math.ceil(lag / 2);
    }
    this.lcMissedAt = g.frame;
    if (since <= 40) this.feedback(t('L-cancel missed · {n}f early (window {window}f)', { n: since, window: FRAMES.LCANCEL }), 'yellow');
    else this.feedback(t('L-cancel missed · {move} landed with full lag', { move: t(this.move.name) }), 'yellow');
    return lag;
  }

  stLanding(p) {
    const g = this.game;
    // Pressed just after landing? Tell the player how late it was.
    if (!this.lcLateNoted && p.lcancelPress && g.frame - this.lcMissedAt <= 12) {
      this.lcLateNoted = true;
      this.feedback(t('L-cancel {n}f late', { n: g.frame - this.lcMissedAt }), 'yellow');
    }
    this.friction();
    if (this.sf >= this.landLag) this.setState(p.y <= STICK.CROUCH_Y ? 'crouch' : 'idle');
  }

  // ---- Attacks / specials ----------------------------------------------------------------------

  startAttack(name) {
    this.move = MOVES[name];
    this.moveName = name;
    this.moveFrame = 0;
    this.setState('attack');
  }

  stAttack() {
    this.moveFrame++;
    this.friction();
    if (this.moveFrame >= this.move.total) { this.move = null; this.setState('idle'); }
  }

  stTimed(p, frames) {
    this.friction();
    if (this.sf >= frames) this.setState('idle');
  }

  groundSpecial(p) {
    if (p.y >= 0.5) { this.ground = null; this.springUp(p); return; }
    this.fireSpark();
    this.setState('special');
  }

  springUp(p) {
    // Up-special: a single springy boost, then helpless until landing (or grabbing a ledge).
    this.upSpecialUsed = true;
    this.vy = 3.4;
    this.vx = p.x * 1.2;
    this.move = null;
    this.fastfall = false;
    this.apexFrame = -1;
    this.ffNoted = true;
    this.setState('helpless');
    this.squash = 1;
  }

  fireSpark() {
    if (this.specialCooldown > 0) return;
    this.specialCooldown = FRAMES.SPECIAL_COOLDOWN;
    this.game.spawnSpark(this.x + this.facing * 8, this.y + R, this.facing * this.P.SPECIAL_SPEED);
  }

  // ---- Shield ----------------------------------------------------------------------------------

  stShield(p) {
    const g = this.game;
    if (!p.shieldHeld) { this.setState('shieldRelease'); return; }
    this.shieldPressure = p.shieldPressure;
    this.shieldHP -= SHIELD.DECAY;
    if (this.shieldHP <= 0) {
      this.shieldHP = 0;
      this.setState('dizzy');
      this.feedback(t('Shield broke! Let go of the trigger a little sooner'), 'red');
      return;
    }
    if (p.pressed.jump || (g.tapJump && p.yUpSmash)) { this.startJumpsquat(!p.pressed.jump); return; }

    // Down while shielding: shield drop (platforms, diagonal) or spot dodge (straight down flick).
    const lat = p.yShieldDown;
    if (lat >= 0) {
      const off = Math.abs(Math.atan2(p.x, -p.y)) * DEG; // 0 = straight down
      const onPlatform = !this.ground.solid;
      const st = this.stats.shieldDrop;
      if (onPlatform && off > STICK.SPOTDODGE_CONE && off <= STICK.SHIELD_DROP_MAX) {
        st.n++; st.ok++;
        this.dropThroughPlatform();
        this.feedback(t('Shield drop ✓ · stick {angle}° from straight down', { angle: off.toFixed(1) }), 'green');
        return;
      }
      if (onPlatform) {
        st.n++;
        this.feedback(t('No shield drop · {angle}° from straight down (window {min}–{max}°)', { angle: off.toFixed(1), min: STICK.SPOTDODGE_CONE, max: STICK.SHIELD_DROP_MAX }), 'yellow');
      }
      if (lat < STICK.SMASH_WINDOW && off <= STICK.SHIELD_DROP_MAX) { this.setState('spotdodge'); return; }
    }
    if (p.xSmash) { this.rollDir = p.xSmash; this.setState('roll'); return; }
    if (p.pressed.attack || p.pressed.z) { this.startAttack('grab'); return; }
    this.friction();
  }

  stRoll() {
    const [a, b] = FRAMES.ROLL_MOVE;
    this.intangible = this.sf >= FRAMES.ROLL_INTANGIBLE[0] && this.sf <= FRAMES.ROLL_INTANGIBLE[1];
    this.vx = this.sf >= a && this.sf <= b ? this.rollDir * (this.P.ROLL_DISTANCE / (b - a + 1)) : 0;
    if (this.sf >= FRAMES.ROLL) { this.facing = -this.rollDir; this.setState('idle'); }
  }

  stSpotdodge() {
    this.intangible = this.sf >= FRAMES.SPOTDODGE_INTANGIBLE[0] && this.sf <= FRAMES.SPOTDODGE_INTANGIBLE[1];
    this.friction();
    if (this.sf >= FRAMES.SPOTDODGE) this.setState('idle');
  }

  stDizzy() {
    this.friction();
    if (this.sf >= FRAMES.SHIELD_BREAK) { this.shieldHP = SHIELD.MAX * 0.5; this.setState('idle'); }
  }

  // ===========================================================================================
  // Airborne states
  // ===========================================================================================

  stAir(p) {
    const g = this.game;
    this.airFrame++;
    if (this.move) {
      this.moveFrame++;
      if (this.moveFrame >= this.move.total) this.move = null;
    } else if ((p.pressed.jump || (g.tapJump && p.yUpSmash)) && this.jumps > 0) {
      this.doubleJump(p);
    } else if (p.shieldPressed && !this.airdodgeUsed) {
      this.startAirdodge(p);
      return;
    } else if (p.cDir || p.pressed.attack) {
      const dir = p.cDir
        ? (p.cDir === 'up' || p.cDir === 'down' ? p.cDir : ((p.cDir === 'right' ? 1 : -1) === this.facing ? 'forward' : 'back'))
        : relDir(p.x, p.y, this.facing, STICK.DIRECTION);
      this.moveName = airMove(dir);
      this.move = MOVES[this.moveName];
      this.moveFrame = 0;
    } else if (p.pressed.special) {
      if (p.y >= 0.5 && !this.upSpecialUsed) { this.springUp(p); return; }
      this.fireSpark();
      this.vy = Math.max(this.vy, -0.4); // tiny float when firing in the air
    }
    // Float (profiles with FLOAT): keep jump held, then press down → hover until jump is released
    // or the float time runs out (once per airtime; landing or a ledge grab refreshes it).
    if (this.P.FLOAT) {
      if (this.floating) {
        if (!p.held.jump || --this.floatLeft <= 0) this.floating = false;
      } else if (this.floatLeft > 0 && p.held.jump && p.y <= STICK.CROUCH_Y && this.state === 'air') {
        this.floating = true;
        this.fastfall = false;
      }
    }
    if (this.floating) {
      this.airDrift(p, 1);
      this.vy = 0;
      return;
    }
    this.fastFallCheck(p);
    this.airDrift(p, 1);
    this.gravity();
  }

  doubleJump(p) {
    this.jumpTaken = true;
    this.jumps--;
    this.vy = this.P.DOUBLE_JUMP;
    this.vx = p.x * this.P.DJ_H;
    this.fastfall = false;
    this.apexFrame = -1;
    this.ffNoted = false;
    this.squash = 0.6;
  }

  fastFallCheck(p) {
    if (this.fastfall || !p.yDownSmash) return;
    const g = this.game;
    if (this.vy <= 0) {
      this.fastfall = true;
      this.vy = -this.P.FAST_FALL;
      const late = Math.max(0, g.frame - this.apexFrame - 1);
      const st = this.stats.fastfall; st.n++;
      if (late === 0) { st.perfect++; this.feedback(t('Fast fall · frame-perfect'), 'green'); }
      else this.feedback(t('Fast fall · {n}f after the peak', { n: late }), late <= 3 ? 'green' : 'blue');
    } else if (!this.ffNoted) {
      this.ffNoted = true;
      this.feedback(t('Fast fall too early · {n}f before the peak', { n: Math.ceil(this.vy / this.P.GRAVITY) }), 'yellow');
    }
  }

  airDrift(p, scale) {
    const target = Math.abs(p.x) >= STICK.NEUTRAL ? p.x * this.P.AIR_SPEED * scale : 0;
    const coasting = target === 0 || (Math.abs(this.vx) > Math.abs(target) && Math.sign(this.vx) === Math.sign(target));
    this.vx = toward(this.vx, target, coasting ? this.P.AIR_FRICTION : this.P.AIR_ACCEL);
  }

  gravity() {
    const before = this.vy;
    this.vy = this.fastfall ? -this.P.FAST_FALL : Math.max(this.vy - this.P.GRAVITY, -this.P.MAX_FALL);
    if (before > 0 && this.vy <= 0) this.apexFrame = this.game.frame;
  }

  startAirdodge(p) {
    const g = this.game;
    this.floating = false;
    this.airdodgeUsed = true;
    if (Math.hypot(p.x, p.y) >= STICK.AIRDODGE_MIN) {
      const a = Math.atan2(p.y, p.x);
      this.adAngle = a;
      this.vx = Math.cos(a) * this.P.AIRDODGE_SPEED;
      this.vy = Math.sin(a) * this.P.AIRDODGE_SPEED;
    } else {
      this.adAngle = null;
      this.vx = 0; this.vy = 0;
    }
    this.adAirFrame = this.airFrame;
    this.adFromJump = this.fromJump && this.airFrame <= FRAMES.WAVEDASH_MAX_AIR;
    this.adFromLedge = g.frame - this.ledgeDropFrame <= FRAMES.LEDGEDASH_MAX;
    this.fastfall = false;
    this.move = null;
    this.setState('airdodge');
  }

  stAirdodge() {
    this.intangible = this.sf >= FRAMES.AIRDODGE_INTANGIBLE[0] && this.sf <= FRAMES.AIRDODGE_INTANGIBLE[1];
    this.vx *= this.P.AIRDODGE_DECAY;
    this.vy *= this.P.AIRDODGE_DECAY;
    if (this.sf >= FRAMES.AIRDODGE) { this.setState('helpless'); this.apexFrame = this.game.frame; this.ffNoted = true; }
  }

  stHelpless(p) {
    this.fastFallCheck(p);
    this.airDrift(p, 0.6);
    this.gravity();
  }

  // ---- Ledge -----------------------------------------------------------------------------------

  grabLedge(L) {
    this.ledge = L;
    this.x = L.x - L.dir * LEDGE.HANG_X;
    this.y = L.y - LEDGE.HANG_Y;
    this.vx = 0; this.vy = 0;
    this.facing = L.dir;
    this.jumps = this.P.JUMPS;
    this.floatLeft = this.P.FLOAT;
    this.floating = false;
    this.airdodgeUsed = false;
    this.upSpecialUsed = false;
    this.fastfall = false;
    this.move = null;
    this.ground = null;
    this.setState('ledge');
    this.ledgeNeutral = false; // stick options need the stick to pass through neutral first
    this.stats.ledge++;
    this.feedback(t('Ledge grab'), 'blue');
  }

  stLedge(p) {
    const g = this.game;
    const L = this.ledge;
    this.vx = 0; this.vy = 0;
    this.intangible = this.sf < 30;
    if (this.sf < FRAMES.LEDGE_WAIT) return;
    const toStage = p.x * L.dir;
    // Ignore a stick that was already held when the ledge was grabbed (so holding "away" while
    // recovering doesn't instantly drop you); it has to come back to neutral first.
    if (Math.hypot(p.x, p.y) < STICK.NEUTRAL) this.ledgeNeutral = true;
    const stickOk = this.ledgeNeutral;
    if (p.pressed.jump || (g.tapJump && p.yUpSmash)) {
      this.jumpTaken = true;
      this.vy = this.P.LEDGE_JUMP;
      this.vx = L.dir * 0.6;
      this.leaveLedge();
      this.enterAir(false);
      return;
    }
    if ((stickOk && (toStage >= 0.5 || p.y >= 0.5)) || p.pressed.attack || p.shieldPressed) {
      this.getupFrom = { x: this.x, y: this.y };
      this.setState('ledgeGetup');
      return;
    }
    if (stickOk && (toStage <= -0.5 || p.y <= -0.5)) {
      this.x -= L.dir;
      this.leaveLedge();
      this.ledgeDropFrame = g.frame;
      this.enterAir(false);
    }
  }

  leaveLedge() {
    this.ledge = null;
    this.ledgeCooldown = FRAMES.LEDGE_REGRAB;
  }

  stLedgeGetup() {
    const L = this.ledge;
    const t = Math.min(1, this.sf / FRAMES.LEDGE_GETUP);
    const e = t * t * (3 - 2 * t);
    const to = { x: L.x + L.dir * 9, y: L.y };
    this.intangible = true;
    this.x = this.getupFrom.x + (to.x - this.getupFrom.x) * e;
    // Arc up and over the corner.
    this.y = this.getupFrom.y + (to.y - this.getupFrom.y) * Math.min(1, t * 1.6) + Math.sin(Math.PI * t) * 4;
    if (t >= 1) {
      this.y = L.y;
      this.ground = STAGE.main;
      this.leaveLedge();
      this.setState('idle');
    }
  }

  // ---- Respawn ---------------------------------------------------------------------------------

  stRespawn(p) {
    this.intangible = true;
    this.vx = 0; this.vy = 0;
    if ((this.sf > 30 && p.any) || this.sf > FRAMES.RESPAWN_WAIT) {
      this.intangible = false;
      this.enterAir(false);
      this.apexFrame = this.game.frame;
    }
  }

  stDead() {
    if (this.sf >= FRAMES.RESPAWN_DELAY) this.spawn(STAGE.respawn, true);
  }

  ko() {
    this.stats.ko++;
    this.feedback(t('Out of bounds! Respawning…'), 'red');
    this.move = null;
    this.ground = null;
    this.trail = [];
    this.setState('dead');
  }

  // ===========================================================================================
  // Movement & collision
  // ===========================================================================================

  integrate() {
    const st = this.state;
    if (st === 'ledge' || st === 'ledgeGetup' || st === 'respawn' || st === 'dead') return;
    if (this.ground) {
      const s = this.ground;
      this.x += this.vx;
      this.y = s.y;
      this.vy = 0;
      if (this.x < s.x1 || this.x > s.x2) {
        if (EDGE_STOP.has(st)) {
          this.x = clamp(this.x, s.x1, s.x2);
          this.vx = 0;
        } else {
          // Walk/run/slide off the edge (a wavedash off the ledge is a real technique!).
          this.ground = null;
          this.enterAir(false);
        }
      }
      return;
    }

    const prevY = this.y;
    this.x += this.vx;
    this.y += this.vy;
    const M = STAGE.main;
    const bottom = M.y - M.depth;
    const inX = this.x > M.x1 - WALL_PAD && this.x < M.x2 + WALL_PAD;

    // Ceiling: rising into the underside of the main platform.
    if (inX && this.vy > 0 && this.y + 2 * R > bottom && prevY + 2 * R <= bottom) {
      this.y = bottom - 2 * R;
      this.vy = 0;
    }

    // Landing: cross a surface top from above while falling.
    if (this.vy <= 0) {
      let best = null;
      for (const s of SURFACES) {
        if (this.x < s.x1 || this.x > s.x2) continue;
        if (prevY < s.y - 0.001 || this.y > s.y) continue;
        if (!s.solid) {
          if (this.dropThrough > 0) continue;
          // Holding down falls through platforms (except while airdodging, so wavelands work).
          if (this.holdDown && st !== 'airdodge') continue;
        }
        if (!best || s.y > best.y) best = s;
      }
      if (best) { this.land(best); return; }
    }

    // Walls: never end up inside the main platform's solid body.
    if (this.y < M.y && this.y + 2 * R > bottom && inX) {
      this.x = this.prevX < 0 ? M.x1 - WALL_PAD : M.x2 + WALL_PAD;
      this.vx = 0;
    }

    // Ledge grab: falling, near a ledge, not mid-attack.
    const canGrab = (st === 'air' && !this.move) || st === 'helpless';
    if (canGrab && this.vy < 0 && this.ledgeCooldown === 0) {
      for (const L of STAGE.ledges) {
        const dx = (this.x - L.x) * L.dir; // negative = off-stage side
        if (dx <= 1 && dx >= -LEDGE.REACH_X && this.y <= L.y - 1 && this.y >= L.y - LEDGE.REACH_Y) {
          this.grabLedge(L);
          return;
        }
      }
    }
  }
}
