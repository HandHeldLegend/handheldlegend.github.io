/**
 * render.js — Draws the arena on a 2D canvas. Original vector art in the Super Famicom palette.
 *
 * World units, y up. The camera gently follows the fighter while always keeping the stage in view
 * (no shake, no sudden cuts). Positions are interpolated between simulation frames for smoothness
 * on high-refresh displays.
 */
import { PHYS, SHIELD } from './constants.js';
import { STAGE, TARGET_R } from './stage.js';
import { readTheme, reducedMotion, alpha, fitCanvas } from './theme.js';

const R = PHYS.BODY_R;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cam = null;
    this.setTheme(readTheme());
    this.lastT = 0;
  }

  setTheme(theme) {
    this.t = theme;
    this.reduced = reducedMotion();
    this.ink = theme.light ? theme.text : theme.bg; // a dark color in both themes (pupils, outlines)
  }

  /** Target camera box: the stage view box, stretched to include the fighter with some margin. */
  #cameraTarget(fx, fy, w, h) {
    const v = STAGE.view;
    const left = Math.min(v.left, fx - 34);
    const right = Math.max(v.right, fx + 34);
    const bottom = Math.min(v.bottom, fy - 26);
    const top = Math.max(v.top, fy + 40);
    const scale = Math.min(w / (right - left), h / (top - bottom));
    return { x: (left + right) / 2, y: (top + bottom) / 2, scale };
  }

  /**
   * @param {import('./game.js').Game} game
   * @param {number} a interpolation 0..1 between the previous and current sim frame
   * @param {{showHitboxes?: boolean, stick?: {x:number,y:number}}} opts
   */
  draw(game, a, opts = {}) {
    const { w, h, dpr } = fitCanvas(this.canvas);
    const ctx = this.ctx;
    const t = this.t;
    const f = game.fighter;
    const fx = lerp(f.prevX, f.x, a);
    const fy = lerp(f.prevY, f.y, a);

    // Camera: exponential smoothing, frame-rate independent and deliberately slow.
    const now = performance.now();
    const dt = this.lastT ? Math.min(0.1, (now - this.lastT) / 1000) : 0;
    this.lastT = now;
    const target = this.#cameraTarget(f.state === 'dead' ? 0 : fx, f.state === 'dead' ? 20 : fy, w, h);
    if (!this.cam || this.cam.w !== w || this.cam.h !== h) this.cam = { ...target, w, h };
    else {
      const k = 1 - Math.exp(-dt * (this.reduced ? 2 : 3));
      this.cam.x += (target.x - this.cam.x) * k;
      this.cam.y += (target.y - this.cam.y) * k;
      this.cam.scale += (target.scale - this.cam.scale) * k;
    }
    const cam = this.cam;

    // ---- Screen-space background --------------------------------------------------------------
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, t.sunken);
    bg.addColorStop(1, t.bg);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    this.#backdrop(ctx, w, h, cam);

    // ---- World space (y up) -------------------------------------------------------------------
    const s = cam.scale;
    ctx.setTransform(dpr * s, 0, 0, -dpr * s, dpr * (w / 2 - cam.x * s), dpr * (h / 2 + cam.y * s));
    this.px = 1 / s; // one CSS pixel in world units

    this.#blastHint(ctx, fx, fy);
    this.#stage(ctx);
    for (const tg of game.targets) if (tg.alive) this.#target(ctx, tg, game.frame);
    for (const e of game.effects) this.#effect(ctx, e, game.frame + a);
    for (const sp of game.sparks) this.#spark(ctx, sp, a);
    if (f.state !== 'dead') this.#fighter(ctx, f, fx, fy, game, opts);
    if (opts.showHitboxes) this.#debug(ctx, f);
  }

  // ---- Background -------------------------------------------------------------------------------

  #backdrop(ctx, w, h, cam) {
    const t = this.t;
    const a = t.light ? 0.075 : 0.06;
    // A big, faint four-color "button cluster" far behind the stage (slow parallax).
    const cx = w / 2 - cam.x * cam.scale * 0.15;
    const cy = h * 0.42 + cam.y * cam.scale * 0.1;
    const r = Math.min(w, h) * 0.16;
    const d = r * 1.25;
    const dots = [[0, -d, t.blue], [d, 0, t.red], [0, d, t.yellow], [-d, 0, t.green]];
    for (const [dx, dy, c] of dots) {
      ctx.fillStyle = alpha(c, a);
      ctx.beginPath(); ctx.arc(cx + dx, cy + dy, r, 0, Math.PI * 2); ctx.fill();
    }
    // Soft dotted grid with mid parallax.
    ctx.fillStyle = alpha(t.muted, t.light ? 0.16 : 0.12);
    const step = 22 * cam.scale;
    if (step > 6) {
      const ox = (w / 2 - cam.x * cam.scale * 0.5) % step;
      const oy = (h / 2 + cam.y * cam.scale * 0.5) % step;
      for (let x = ox; x < w; x += step) for (let y = oy; y < h; y += step) ctx.fillRect(x - 0.75, y - 0.75, 1.5, 1.5);
    }
  }

  #blastHint(ctx, fx, fy) {
    const b = STAGE.blast;
    const near = 60;
    const lines = [
      [b.left, fx - b.left, 'v'], [b.right, b.right - fx, 'v'],
      [b.top, b.top - fy, 'h'], [b.bottom, fy - b.bottom, 'h'],
    ];
    ctx.save();
    ctx.lineWidth = 2 * this.px;
    ctx.setLineDash([6 * this.px, 6 * this.px]);
    for (const [pos, dist, dir] of lines) {
      if (dist > near) continue;
      ctx.strokeStyle = alpha(this.t.red, 0.7 * (1 - Math.max(0, dist) / near));
      ctx.beginPath();
      if (dir === 'v') { ctx.moveTo(pos, b.bottom); ctx.lineTo(pos, b.top); } else { ctx.moveTo(b.left, pos); ctx.lineTo(b.right, pos); }
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---- Stage ---------------------------------------------------------------------------------------

  #stage(ctx) {
    const t = this.t;
    const M = STAGE.main;
    // Main body: a tapered slab.
    const g = ctx.createLinearGradient(0, 0, 0, -M.depth - 12);
    g.addColorStop(0, t.surface3);
    g.addColorStop(1, t.surface);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(M.x1, 0);
    ctx.lineTo(M.x2, 0);
    ctx.lineTo(M.x2 - 4, -10);
    ctx.quadraticCurveTo(M.x2 - 14, -M.depth, 34, -M.depth - 8);
    ctx.lineTo(-34, -M.depth - 8);
    ctx.quadraticCurveTo(M.x1 + 14, -M.depth, M.x1 + 4, -10);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 1.5 * this.px;
    ctx.strokeStyle = t.border;
    ctx.stroke();
    // Top lip in the lavender accent with the four-color stripe under it.
    ctx.fillStyle = t.accent;
    roundRect(ctx, M.x1, -3, M.x2 - M.x1, 3, 1.4);
    ctx.fill();
    const stripe = [t.red, t.yellow, t.green, t.blue];
    const sw = (M.x2 - M.x1 - 16) / 4;
    stripe.forEach((c, i) => { ctx.fillStyle = alpha(c, 0.85); ctx.fillRect(M.x1 + 8 + i * sw, -5.2, sw - 1, 1.4); });
    // Face-button cluster on the front.
    const cx = 0; const cy = -18; const d = 5;
    [[0, d, t.blue], [d, 0, t.red], [0, -d, t.yellow], [-d, 0, t.green]].forEach(([dx, dy, c]) => {
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.arc(cx + dx, cy + dy, 2.6, 0, Math.PI * 2); ctx.fill();
    });
    // Pass-through platforms.
    for (const p of STAGE.platforms) {
      ctx.fillStyle = alpha(this.ink, 0.12);
      roundRect(ctx, p.x1 + 2, p.y - 5, p.x2 - p.x1 - 4, 3, 1.5); ctx.fill();
      ctx.fillStyle = t.surface3;
      roundRect(ctx, p.x1, p.y - 3, p.x2 - p.x1, 3, 1.5); ctx.fill();
      ctx.fillStyle = t.accent;
      roundRect(ctx, p.x1, p.y - 1.1, p.x2 - p.x1, 1.1, 0.55); ctx.fill();
    }
  }

  #target(ctx, tg, frame) {
    const t = this.t;
    const bob = this.reduced ? 0 : Math.sin(frame * 0.05 + tg.id * 1.7) * 0.8;
    const x = tg.x; const y = tg.y + bob;
    ctx.fillStyle = alpha(t.red, 0.18);
    ctx.beginPath(); ctx.arc(x, y, TARGET_R + 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = t.red;
    ctx.beginPath(); ctx.arc(x, y, TARGET_R, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = t.onAccent;
    ctx.beginPath(); ctx.arc(x, y, TARGET_R * 0.66, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = t.red;
    ctx.beginPath(); ctx.arc(x, y, TARGET_R * 0.36, 0, Math.PI * 2); ctx.fill();
  }

  #effect(ctx, e, frame) {
    const t = this.t;
    const k = clamp((frame - e.frame) / e.life, 0, 1);
    if (this.reduced) {
      // Calm version: a fading ring, no flying pieces.
      ctx.strokeStyle = alpha(t.yellow, 1 - k);
      ctx.lineWidth = 2 * this.px;
      ctx.beginPath(); ctx.arc(e.x, e.y, TARGET_R + 2, 0, Math.PI * 2); ctx.stroke();
      return;
    }
    const ease = 1 - (1 - k) * (1 - k);
    ctx.strokeStyle = alpha(t.yellow, 1 - k);
    ctx.lineWidth = 2 * this.px;
    ctx.beginPath(); ctx.arc(e.x, e.y, TARGET_R + 10 * ease, 0, Math.PI * 2); ctx.stroke();
    const colors = [t.red, t.yellow, t.blue, t.green];
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2 + 0.3;
      const dist = 4 + 16 * ease;
      ctx.fillStyle = alpha(colors[i % 4], 1 - k);
      ctx.beginPath();
      ctx.arc(e.x + Math.cos(ang) * dist, e.y + Math.sin(ang) * dist - 6 * k * k, 1.6 * (1 - k * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  #spark(ctx, sp, a) {
    const t = this.t;
    const x = lerp(sp.prevX, sp.x, a);
    const fade = Math.min(1, sp.life / 12);
    ctx.strokeStyle = alpha(t.yellow, 0.35 * fade);
    ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(x - Math.sign(sp.vx) * 9, sp.y); ctx.lineTo(x, sp.y); ctx.stroke();
    ctx.fillStyle = alpha(t.yellow, fade);
    ctx.beginPath();
    ctx.moveTo(x + 3, sp.y); ctx.lineTo(x, sp.y + 3); ctx.lineTo(x - 3, sp.y); ctx.lineTo(x, sp.y - 3);
    ctx.closePath(); ctx.fill();
  }

  // ---- Fighter -------------------------------------------------------------------------------------

  /**
   * Simple geometric accessory per fighter, drawn in body space (y up, radius R). `behind` = the part
   * drawn before the body. Shapes only — no character likenesses.
   */
  #accessory(ctx, look, facing, col, behind) {
    const c = col(look.band);
    ctx.fillStyle = c; ctx.strokeStyle = c; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
    switch (look.acc) {
      case 'ears': // two pointed ears
        if (!behind) return;
        for (const sx of [-1, 1]) {
          ctx.beginPath(); ctx.moveTo(sx * 2, R - 1.5); ctx.lineTo(sx * 5.5, R + 4.5); ctx.lineTo(sx * 6, R - 3); ctx.closePath(); ctx.fill();
        }
        break;
      case 'crest': // swept-back crest
        if (!behind) return;
        ctx.beginPath(); ctx.moveTo(0, R - 1); ctx.lineTo(-facing * 6, R + 4); ctx.lineTo(-facing * 2.5, R - 3.5); ctx.closePath(); ctx.fill();
        break;
      case 'headband': // band across the top with tails
        if (behind) return;
        ctx.beginPath(); ctx.arc(0, 0, R - 0.4, Math.PI * 0.62, Math.PI * 0.38, true); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-facing * R * 0.7, R * 0.72); ctx.lineTo(-facing * (R + 3), R * 0.45); ctx.stroke();
        break;
      case 'crown': // small three-point crown
        if (behind) return;
        ctx.fillStyle = col('yellow');
        ctx.beginPath(); ctx.moveTo(-3, R - 0.6); ctx.lineTo(-3, R + 2.4); ctx.lineTo(-1.5, R + 1); ctx.lineTo(0, R + 3);
        ctx.lineTo(1.5, R + 1); ctx.lineTo(3, R + 2.4); ctx.lineTo(3, R - 0.6); ctx.closePath(); ctx.fill();
        break;
      case 'hood': // fluffy hood rim
        if (!behind) return;
        ctx.beginPath(); ctx.arc(0, 0.6, R + 1.6, 0, Math.PI * 2); ctx.fill();
        break;
      case 'visor': // visor stripe across the eyes
        if (behind) return;
        ctx.globalAlpha *= 0.85;
        ctx.fillStyle = col(look.band);
        ctx.beginPath(); ctx.ellipse(facing * 2.3, 2.2, 4.6, 1.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha /= 0.85;
        break;
      case 'tuft': // curl on top
        if (behind) return;
        ctx.beginPath(); ctx.arc(facing * 1.5, R + 0.6, 1.8, Math.PI * 1.1, Math.PI * 2.4); ctx.stroke();
        break;
      case 'cap': // small cap brim
        if (behind) return;
        ctx.beginPath(); ctx.ellipse(facing * 2.4, R - 1.6, 4.4, 1.4, 0, 0, Math.PI * 2); ctx.fill();
        break;
      default:
    }
  }

  #fighter(ctx, f, fx, fy, game, opts) {
    const t = this.t;
    const st = f.state;

    // Respawn halo.
    if (st === 'respawn') {
      ctx.fillStyle = alpha(t.accent, 0.35);
      ctx.beginPath(); ctx.ellipse(fx, fy - 1, 12, 2.4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = t.accent; ctx.lineWidth = 1.2 * this.px;
      ctx.stroke();
    }

    // Airdodge afterimages.
    if (!this.reduced && f.trail.length > 1) {
      f.trail.forEach((p, i) => {
        ctx.fillStyle = alpha(t.accent, 0.08 + (i / f.trail.length) * 0.12);
        ctx.beginPath(); ctx.arc(p.x, p.y + R, R, 0, Math.PI * 2); ctx.fill();
      });
    }

    // Squash & stretch (pure presentation).
    let sx = 1; let sy = 1; let lean = 0;
    if (st === 'jumpsquat') { sx = 1.16; sy = 0.8; }
    else if (st === 'crouch') { sx = 1.18; sy = 0.72; }
    else if (st === 'landing') { const k = 0.22 * f.squash; sx = 1 + k; sy = 1 - k; }
    else if (!f.ground && st !== 'ledge' && st !== 'ledgeGetup') { const k = clamp(Math.abs(f.vy) * 0.045, 0, 0.12); sx = 1 - k; sy = 1 + k; }
    if (st === 'dash' || st === 'run') lean = -f.facing * 0.14;
    if (st === 'skid') lean = f.facing * 0.12;
    if (f.move) {
      const hb = f.move.hitboxes[0];
      lean = clamp(-hb.x * f.facing * 0.012, -0.18, 0.18);
    }

    const cy = fy + R * sy;
    ctx.save();
    if (f.intangible) ctx.globalAlpha = 0.55;

    // Colours and accessory of the selected fighter (all original: the same round body).
    const lk = f.profile?.look || { body: 'red', band: 'blue', feet: 'yellow', acc: 'cap' };
    const col = (k) => t[k] || t.red;

    // Hanging from the ledge: a little arm to the corner.
    if (st === 'ledge' && f.ledge) {
      ctx.strokeStyle = col(lk.feet); ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(fx + f.facing * 4, cy + 3); ctx.lineTo(f.ledge.x, f.ledge.y - 0.5); ctx.stroke();
    }

    // Feet (yellow), stepping while moving on the ground.
    const moving = f.ground && Math.abs(f.vx) > 0.05 && st !== 'landing';
    const phase = moving ? fx * 0.55 : 0;
    ctx.fillStyle = col(lk.feet);
    for (const side of [-1, 1]) {
      const lift = moving ? Math.max(0, Math.sin(phase + (side > 0 ? 0 : Math.PI))) * 1.6 : 0;
      ctx.beginPath();
      ctx.ellipse(fx + side * 3.6 + f.facing * 0.8, fy + 1.1 + lift, 2.9, 1.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Body.
    ctx.translate(fx, cy);
    ctx.rotate(lean);
    ctx.scale(sx, sy);
    this.#accessory(ctx, lk, f.facing, col, true);
    ctx.fillStyle = col(lk.body);
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
    // Highlight + band.
    ctx.fillStyle = alpha(t.onAccent, 0.28);
    ctx.beginPath(); ctx.ellipse(-2.6, 3.4, 2.2, 1.3, -0.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = col(lk.band); ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.arc(0, 0, R - 0.65, Math.PI * 0.18, Math.PI * 0.82); ctx.stroke();
    this.#accessory(ctx, lk, f.facing, col, false);

    // Eyes look where the stick points (a tiny live input display on the fighter itself).
    const look = opts.stick || { x: 0, y: 0 };
    const lx = clamp(look.x, -1, 1) * 0.9; const ly = clamp(look.y, -1, 1) * 0.9;
    const dizzy = st === 'dizzy';
    for (const side of [-1, 1]) {
      const ex = f.facing * 2.3 + side * 2.2;
      const ey = 1.2;
      ctx.fillStyle = t.onAccent;
      ctx.beginPath(); ctx.ellipse(ex, ey, 1.55, 2.1, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = this.ink;
      if (dizzy) {
        ctx.strokeStyle = this.ink; ctx.lineWidth = 0.6;
        ctx.beginPath(); ctx.moveTo(ex - 0.9, ey - 0.9); ctx.lineTo(ex + 0.9, ey + 0.9); ctx.moveTo(ex - 0.9, ey + 0.9); ctx.lineTo(ex + 0.9, ey - 0.9); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.arc(ex + lx * 0.6 + f.facing * 0.25, ey + ly * 0.8, 0.85, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();

    // Attack swoosh on active hitboxes.
    const boxes = f.activeHitboxes();
    for (const b of boxes) {
      ctx.strokeStyle = alpha(t.yellow, 0.75);
      ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.85, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = alpha(t.yellow, 0.16);
      ctx.fill();
    }

    // Shield bubble: shrinks with health, larger + paler with a light press.
    if (st === 'shield') {
      const r = f.shieldRadius();
      const strength = 0.18 + 0.22 * f.shieldPressure;
      const hp = f.shieldHP / SHIELD.MAX;
      ctx.fillStyle = alpha(hp < 0.3 ? t.red : t.accent, strength);
      ctx.beginPath(); ctx.arc(fx, fy + R, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = alpha(hp < 0.3 ? t.red : t.accent, 0.85);
      ctx.lineWidth = 1.6 * this.px * 1.2;
      ctx.stroke();
    }

    // Dizzy stars after a shield break.
    if (st === 'dizzy') {
      const spin = this.reduced ? 0 : game.frame * 0.08;
      for (let i = 0; i < 3; i++) {
        const ang = spin + (i * Math.PI * 2) / 3;
        star(ctx, fx + Math.cos(ang) * 7, fy + 2 * R + 3 + Math.sin(ang) * 1.6, 1.6, t.yellow);
      }
    }
  }

  #debug(ctx, f) {
    const t = this.t;
    if (f.move) {
      for (const hb of f.move.hitboxes) {
        const on = f.moveFrame >= hb.from && f.moveFrame <= hb.to;
        ctx.fillStyle = alpha(t.red, on ? 0.45 : 0.08);
        ctx.beginPath(); ctx.arc(f.x + hb.x * f.facing, f.y + hb.y, hb.r, 0, Math.PI * 2); ctx.fill();
      }
    }
    // Feet point (collision) and ledge-grab boxes.
    ctx.fillStyle = t.green;
    ctx.beginPath(); ctx.arc(f.x, f.y, 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = alpha(t.green, 0.5); ctx.lineWidth = this.px;
    for (const L of STAGE.ledges) {
      const x0 = L.dir > 0 ? L.x - 14 : L.x - 1;
      ctx.strokeRect(x0, L.y - 24, 15, 23);
    }
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function star(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}
