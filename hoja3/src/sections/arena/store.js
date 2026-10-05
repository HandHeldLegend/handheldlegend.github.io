/**
 * store.js — Arena preferences, kept per browser in localStorage under 'hhl-config:arena'.
 * (Arena prefs are deliberately not part of the controller settings schema.)
 *
 *   store.get('tapJump')          read
 *   store.set('tapJump', false)   write + persist
 */
import { STORAGE_KEY } from './constants.js';

const DEFAULTS = {
  mode: 'free',          // 'free' | 'targets'
  fighter: 'dot',        // roster id (constants.js FIGHTERS)
  tab: 'play',
  tapJump: true,         // stick up jumps
  showHitboxes: false,
  jumpBuffer: false,
  hideSteamHint: false,  // the "Steam mode is faster" tip was dismissed     // retry a jump press the current state ignored for a few frames
  labView: 'melee',      // Input lab: 'melee' (what the game sees) | 'raw'
  speed: 1,
  hiResSticks: false,    // Gamepad API source: take stick values from the 12-bit HOJA USB stream
  bindings: {},
  bindingsVersion: 0,    // see BINDINGS_VERSION in input.js          // { [Gamepad.id | 'usb']: binding table } — see input.js
  bestTime: null,        // target test record, ms
  labStick: 'main',
};

let values = { ...DEFAULTS };
try { Object.assign(values, JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')); } catch { /* private mode */ }

export const store = {
  get: (k) => values[k],
  set(k, v) {
    values[k] = v;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(values)); } catch { /* quota / private mode */ }
  },
};
