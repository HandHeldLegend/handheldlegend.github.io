/**
 * Demo-controller hooks for the "input" section (used only with ?demo; see src/device/mock.js).
 *   seed(device)            adjust device.config / device.static after the base demo data is set
 *   command(block, cmd, device)  return { status, data } to customize a config command's reply,
 *                           or undefined for the default success. May dispatch events on device.
 *
 * The demo is an SFC-style pad with hall-effect triggers: face buttons B/A/Y/X, a d-pad, L/R, digital
 * ZL/ZR clicks plus analog LT/RT, two grip paddles, Start/Select/Home/Capture and two sticks.
 * Profiles are filled the way the firmware's _mapper_set_defaults() would, with one "customer
 * tweak" on top (Switch triggers in threshold mode) so the editor has something interesting to show.
 */
import { encodeText, fwDefine } from '../../device/struct.js';
import { MODES, INPUT_CODES, INPUT_TYPE, OUTPUT_MODE, fillDefaultProfile } from './mapping.js';

/** Demo labels per input code key (the mock seeds raw enum names; real builds use names like these). */
const NAMES = {
  SOUTH: 'B', EAST: 'A', WEST: 'Y', NORTH: 'X', UP: 'D Up', DOWN: 'D Down', LEFT: 'D Left', RIGHT: 'D Right',
  LB: 'L', RB: 'R', LT: 'ZL', LT_ANALOG: 'LT', RT: 'ZR', RT_ANALOG: 'RT', LP1: 'GL', RP1: 'GR',
  START: 'Start', SELECT: 'Select', HOME: 'Home', SHARE: 'Capture', LS: 'LS', RS: 'RS',
  LX_RIGHT: 'LX+', LX_LEFT: 'LX-', LY_UP: 'LY+', LY_DOWN: 'LY-', RX_RIGHT: 'RX+', RX_LEFT: 'RX-', RY_UP: 'RY+', RY_DOWN: 'RY-',
};
/** Inputs this demo build doesn't have (the mock enables them all). */
const ABSENT = ['LP2', 'RP2'];

const STICKS = {
  LX_RIGHT: 'LX_RIGHT', LX_LEFT: 'LX_LEFT', LY_UP: 'LY_UP', LY_DOWN: 'LY_DOWN',
  RX_RIGHT: 'RX_RIGHT', RX_LEFT: 'RX_LEFT', RY_UP: 'RY_UP', RY_DOWN: 'RY_DOWN',
};
const DPAD = { UP: 'UP', DOWN: 'DOWN', LEFT: 'LEFT', RIGHT: 'RIGHT' };

/** Default mapping per mode: { INPUT_KEY: OUTPUT_SUFFIX } — like a board's defaults_<mode> table. */
const DEFAULTS = {
  switch: {
    SOUTH: 'B', EAST: 'A', WEST: 'Y', NORTH: 'X', ...DPAD, LB: 'L', RB: 'R', LT: 'ZL', LT_ANALOG: 'ZL', RT: 'ZR', RT_ANALOG: 'ZR',
    START: 'PLUS', SELECT: 'MINUS', HOME: 'HOME', SHARE: 'CAPTURE', LS: 'LS', RS: 'RS', ...STICKS,
  },
  xinput: {
    SOUTH: 'A', EAST: 'B', WEST: 'X', NORTH: 'Y', ...DPAD, LB: 'LB', RB: 'RB', LT_ANALOG: 'LT_ANALOG', RT_ANALOG: 'RT_ANALOG',
    START: 'START', SELECT: 'BACK', HOME: 'GUIDE', LS: 'LS', RS: 'RS', ...STICKS,
  },
  snes: { SOUTH: 'B', EAST: 'A', WEST: 'Y', NORTH: 'X', ...DPAD, LB: 'L', RB: 'R', LT_ANALOG: 'L', RT_ANALOG: 'R', START: 'START', SELECT: 'SELECT' },
  n64: {
    EAST: 'A', SOUTH: 'B', NORTH: 'CUP', WEST: 'CDOWN', ...DPAD, LB: 'CLEFT', RB: 'CRIGHT', LT: 'Z', LT_ANALOG: 'Z',
    RT: 'R', RT_ANALOG: 'R', START: 'START', SELECT: 'L', LX_RIGHT: 'LX_RIGHT', LX_LEFT: 'LX_LEFT', LY_UP: 'LY_UP', LY_DOWN: 'LY_DOWN',
  },
  gamecube: {
    EAST: 'A', SOUTH: 'B', NORTH: 'X', WEST: 'Y', ...DPAD, RB: 'Z', LT: 'L', LT_ANALOG: 'L_ANALOG', RT: 'R', RT_ANALOG: 'R_ANALOG',
    START: 'START', ...STICKS,
  },
  sinput: {
    SOUTH: 'SOUTH', EAST: 'EAST', WEST: 'WEST', NORTH: 'NORTH', ...DPAD, LB: 'LB', RB: 'RB', LT: 'LT', LT_ANALOG: 'LT_ANALOG',
    RT: 'RT', RT_ANALOG: 'RT_ANALOG', LP1: 'LP_1', RP1: 'RP_1', START: 'START', SELECT: 'SELECT', HOME: 'GUIDE', SHARE: 'SHARE',
    LS: 'LS', RS: 'RS', ...STICKS,
  },
};

/** Reset one mode's profile on the demo device, as MAPPER_CMD_DEFAULT_<MODE> does on hardware. */
function resetProfile(device, mode) {
  const cfg = device.config.input;
  const infos = device.static.input.input_info;
  cfg[mode.profile] = fillDefaultProfile(mode.id, cfg[mode.profile], infos, DEFAULTS[mode.id]);
}

export function seed(device) {
  // Friendlier names, and a couple of absent inputs so the page shows only what this build has.
  const infos = device.static.input.input_info;
  for (const { code, key } of INPUT_CODES) {
    const slot = infos[code];
    if (!slot || !slot.input_type) continue;
    if (ABSENT.includes(key)) { slot.input_type = INPUT_TYPE.UNUSED; continue; }
    if (NAMES[key]) slot.input_name = encodeText(NAMES[key], 8);
  }
  device.static.input.input_info = infos;

  device.config.input.input_config_version = fwDefine('CFG_BLOCK_INPUT_VERSION', 0);
  for (const mode of MODES) resetProfile(device, mode);

  // A typical customer tweak: hall-effect triggers press ZL/ZR at 40% travel instead of rapid trigger.
  const sw = device.config.input.input_profile_switch;
  for (const { code, key } of INPUT_CODES) {
    if (key !== 'LT_ANALOG' && key !== 'RT_ANALOG') continue;
    sw[code].output_mode = OUTPUT_MODE.THRESHOLD;
    sw[code].threshold_delta = Math.round(0.4 * 4096);
  }
  device.config.input.input_profile_switch = sw;

  // Plausible calibrated ranges for the hall-effect (hover) inputs.
  const hover = device.config.hover.config;
  infos.forEach((info, code) => {
    if (info.input_type !== INPUT_TYPE.HOVER) return;
    hover[code].min = 180 + code * 3;
    hover[code].max = 3870 - code * 5;
  });
  device.config.hover.config = hover;
}

export function command(block, cmd, device) {
  if (block !== 'input' || !cmd?.startsWith('DEFAULT_')) return undefined;
  const targets = cmd === 'DEFAULT_ALL' ? MODES : MODES.filter((m) => m.reset === cmd);
  for (const mode of targets) resetProfile(device, mode);
  return { status: true, data: null };
}
