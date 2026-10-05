/**
 * moves.js — The fighter's (deliberately simple) attacks. Only used to break targets, so there is no
 * damage or knockback — just hitboxes and frame data.
 *
 * Hitbox coordinates are relative to the fighter's feet, with x pointing the way the fighter faces.
 * `from`/`to` are the active frames (inclusive), `total` the whole move, `landLag` (aerials only) the
 * landing lag if you touch down mid-move — halved by an L-cancel.
 */
import { N_ } from '../../i18n/index.js';

/** Move names are translated where shown (t(move.name)). */
export const MOVES = {
  // Grounded
  jab:   { name: N_('Jab'),        total: 18, hitboxes: [{ from: 3, to: 5, x: 11, y: 7, r: 6 }] },
  ftilt: { name: N_('Side tilt'),  total: 26, hitboxes: [{ from: 6, to: 9, x: 14, y: 7, r: 7 }] },
  utilt: { name: N_('Up tilt'),    total: 26, hitboxes: [{ from: 5, to: 10, x: 3, y: 19, r: 8 }] },
  dtilt: { name: N_('Down tilt'),  total: 22, hitboxes: [{ from: 5, to: 8, x: 13, y: 2, r: 6 }] },
  grab:  { name: N_('Grab'),       total: 30, hitboxes: [{ from: 7, to: 8, x: 12, y: 7, r: 5 }] },
  // Aerials
  nair:  { name: N_('Neutral air'), total: 36, landLag: 14, hitboxes: [{ from: 3, to: 24, x: 0, y: 7, r: 11 }] },
  fair:  { name: N_('Forward air'), total: 40, landLag: 18, hitboxes: [{ from: 8, to: 12, x: 13, y: 8, r: 8 }] },
  bair:  { name: N_('Back air'),    total: 34, landLag: 14, hitboxes: [{ from: 5, to: 12, x: -13, y: 7, r: 7.5 }] },
  uair:  { name: N_('Up air'),      total: 34, landLag: 14, hitboxes: [{ from: 5, to: 10, x: 2, y: 19, r: 8 }] },
  dair:  { name: N_('Down air'),    total: 42, landLag: 20, hitboxes: [{ from: 10, to: 16, x: 0, y: -4, r: 8 }] },
};

/** Pick a grounded move from a stick direction relative to facing ('neutral' | 'forward' | 'back' | 'up' | 'down'). */
export function groundMove(dir) {
  return { up: 'utilt', down: 'dtilt', forward: 'ftilt', back: 'ftilt', neutral: 'jab' }[dir];
}

/** Pick an aerial from a stick direction relative to facing. */
export function airMove(dir) {
  return { up: 'uair', down: 'dair', forward: 'fair', back: 'bair', neutral: 'nair' }[dir];
}

/** Direction of a stick vector relative to facing, using `threshold` for "neutral". */
export function relDir(x, y, facing, threshold) {
  if (Math.hypot(x, y) < threshold) return 'neutral';
  if (Math.abs(y) > Math.abs(x)) return y > 0 ? 'up' : 'down';
  return Math.sign(x) === facing ? 'forward' : 'back';
}
