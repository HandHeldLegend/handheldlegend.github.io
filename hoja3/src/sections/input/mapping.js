/**
 * mapping.js — Pure data + helpers for the Input section (no DOM; also used by demo.js).
 *
 * The remapper lives in HOJA-LIB-RP2040 src/input/mapper.c. Everything here either comes from the
 * generated firmware layout (enums, struct names, command names) or mirrors something mapper.c keeps
 * private (output modes, output types, defaults). Each such mirror says where it comes from.
 *
 * Terms
 *   input code   physical input slot, mapper_input_code_t (0..35). What a slot *is* on this build comes
 *                from the static block `input` (inputInfoStatic_s.input_info[code]: type + name).
 *   output code  per-mode code, e.g. mapper_switch_code_t. -1 (*_CODE_UNUSED) = input disabled.
 *   profile      inputConfig_s.input_profile_<mode>: 36 × inputConfigSlot_s, indexed by input code:
 *                  output_code      i8   what the input sends in this mode (-1 = nothing)
 *                  output_mode      3b   RAPID | THRESHOLD | PASSTHROUGH (only used for analog inputs)
 *                  threshold_delta  u16  activation point (threshold) or travel delta (rapid), 0..4095 scale
 *                  static_output    13b  value sent to an analog output when a digital press /
 *                                        threshold fires, 0..4096 (4096 = full scale)
 */
import { enumValues } from '../../device/struct.js';

/**
 * Marks customer-facing text for translation (tools/test-i18n.mjs extracts N_('…') literals). This
 * module stays DOM/i18n-free, so the text is translated where it is rendered: t(mode.where),
 * t(MODE_LABEL[m]), outputName(label) in parts.js, …
 */
const N_ = (text) => text;

// ---------------------------------------------------------------------------------------------
// Firmware enums (from the generated layout)
// ---------------------------------------------------------------------------------------------

/** Build { SHORT_NAME: value } from a firmware enum, stripping a name prefix. */
function enumMap(name, prefix) {
  return Object.fromEntries(enumValues(name).map((e) => [e.name.replace(prefix, ''), e.value]));
}

/** mapper_input_type_t: what kind of physical input a slot is (inputInfoSlot_s.input_type). */
export const INPUT_TYPE = enumMap('mapper_input_type_t', 'MAPPER_INPUT_TYPE_');   // UNUSED, DIGITAL, HOVER, JOYSTICK
/** mapper_output_type_t: what kind of output a code drives. */
export const OUTPUT_TYPE = enumMap('mapper_output_type_t', 'MAPPER_OUTPUT_');     // DISABLED, DIGITAL, HOVER, JOYSTICK, DPAD

/**
 * mapper_output_mode_t — private to mapper.c, so mirrored here. (The header comment on
 * inputConfigSlot_s.output_mode says "0=default, 1=rapid, 2=threshold"; mapper.c is authoritative.)
 * The firmware treats any unknown value as RAPID for digital/d-pad outputs and PASSTHROUGH for analog.
 */
export const OUTPUT_MODE = { RAPID: 0, THRESHOLD: 1, PASSTHROUGH: 2 };

/** Full scale of the 12-bit analog pipeline (static_output default is 0xFFF + 1). */
export const ANALOG_FULL = 4096;
/** Defaults written by _mapper_set_defaults() in mapper.c. */
export const DEFAULT_THRESHOLD = 2048;
export const DEFAULT_STATIC_OUTPUT = 4096;
/** GameCube/Slippi analog triggers never output less than this when driven digitally (mapper_init). */
export const GAMECUBE_MIN_ANALOG = 784;

/**
 * Hover (analog input) calibration commands for config block `hover`. The firmware has no enum for
 * these (src/input/hover.c hover_config_command): bits 7..6 = instruction, bits 5..0 = channel.
 *   instruction 0 → stop calibrating (sets hover_calibration_set = 1) and reload
 *   instruction 1 → start calibrating channel N (0x3F = every hover channel)
 */
export const HOVER_CMD = {
  stop: 0,
  startAll: (1 << 6) | 0x3f,
  start: (code) => (1 << 6) | (code & 0x3f),
};

/** All physical input codes: [{ code, key }] where key is the enum name without INPUT_CODE_ ('LT_ANALOG'). */
export const INPUT_CODES = enumValues('mapper_input_code_t')
  .filter((e) => e.value >= 0 && !e.name.endsWith('_MAX'))
  .map((e) => ({ code: e.value, key: e.name.replace('INPUT_CODE_', '') }));

// ---------------------------------------------------------------------------------------------
// Output modes (= controller protocols) and their profiles
// ---------------------------------------------------------------------------------------------

/**
 * One entry per remap profile in inputConfig_s. `reset` / `preview` are mapper_cmd_t names:
 *   DEFAULT_<MODE>  restore the build's default mapping for that mode (firmware RAM; Save persists)
 *   WEBUSB_<MODE>   make the WebUSB raw input stream run that profile, so the live view reflects the
 *                   mode being edited (ends automatically when the app disconnects)
 * `formats` are core_reportformat_t values that use this profile (for picking the initial tab from
 * gamepad_default_mode). `where` is customer-facing copy.
 */
export const MODES = [
  { id: 'switch', label: 'Switch', profile: 'input_profile_switch', enumName: 'mapper_switch_code_t', prefix: 'SWITCH_CODE_',
    reset: 'DEFAULT_SWITCH', preview: 'WEBUSB_SWITCH', formats: ['SWPRO'],
    where: N_('Nintendo Switch, and Switch Pro mode on PC.') },
  { id: 'xinput', label: 'XInput', profile: 'input_profile_xinput', enumName: 'mapper_xinput_code_t', prefix: 'XINPUT_CODE_',
    reset: 'DEFAULT_XINPUT', preview: 'WEBUSB_XINPUT', formats: ['XINPUT'],
    where: N_('Windows PCs and Xbox-style games.') },
  { id: 'snes', label: 'SNES', profile: 'input_profile_snes', enumName: 'mapper_snes_code_t', prefix: 'SNES_CODE_',
    reset: 'DEFAULT_SNES', preview: 'WEBUSB_SNES', formats: ['SNES'], requires: 'snes',
    where: N_('SNES / NES consoles through the controller port.') },
  { id: 'n64', label: 'N64', profile: 'input_profile_n64', enumName: 'mapper_n64_code_t', prefix: 'N64_CODE_',
    reset: 'DEFAULT_N64', preview: 'WEBUSB_N64', formats: ['N64'], requires: 'joybus',
    where: N_('Nintendo 64 through the controller port.') },
  { id: 'gamecube', label: 'GameCube', profile: 'input_profile_gamecube', enumName: 'mapper_gamecube_code_t', prefix: 'GAMECUBE_CODE_',
    reset: 'DEFAULT_GAMECUBE', preview: 'WEBUSB_GAMECUBE', formats: ['GAMECUBE', 'SLIPPI'],
    where: N_('GameCube / Wii through the controller port, and GameCube adapter (Slippi) mode over USB.') },
  { id: 'sinput', label: 'Steam', aliases: ['steam'], profile: 'input_profile_sinput', enumName: 'mapper_sinput_code_t', prefix: 'SINPUT_CODE_',
    reset: 'DEFAULT_SINPUT', preview: 'WEBUSB_SINPUT', formats: ['SINPUT'],
    where: N_('Steam mode for Steam and SDL games on PC (supports paddles and extra buttons).') },
];

/** Mode by id or alias (`steam` → the SInput profile, shown to customers as "Steam"). */
export const getMode = (id) => MODES.find((m) => m.id === id || m.aliases?.includes(id));

/** Mode id that a core_reportformat_t value (gamepad_default_mode) uses, or 'switch'. */
export function modeForReportFormat(value) {
  const name = enumValues('core_reportformat_t').find((e) => e.value === value)?.name.replace('CORE_REPORTFORMAT_', '');
  return MODES.find((m) => m.formats.includes(name))?.id || 'switch';
}

// ---------------------------------------------------------------------------------------------
// Output labels & types (UI-only data: the firmware has no names for its output codes)
// ---------------------------------------------------------------------------------------------

/**
 * Labels shared by most modes, keyed by the enum suffix. Labels double as glyph names, so they stay
 * English here; descriptive ones (N_) are translated for display by outputName() in parts.js, while
 * names printed on hardware (A, ZL, Start, Home, LX+…) are shown as-is.
 */
const COMMON_LABELS = {
  UP: N_('D Up'), DOWN: N_('D Down'), LEFT: N_('D Left'), RIGHT: N_('D Right'),
  PLUS: N_('Plus'), MINUS: N_('Minus'), HOME: 'Home', CAPTURE: N_('Capture'), START: 'Start', SELECT: 'Select',
  BACK: N_('Back'), GUIDE: N_('Guide'), SHARE: N_('Share'),
  SOUTH: N_('South'), EAST: N_('East'), WEST: N_('West'), NORTH: N_('North'),
  LX_RIGHT: 'LX+', LX_LEFT: 'LX-', LY_UP: 'LY+', LY_DOWN: 'LY-',
  RX_RIGHT: 'RX+', RX_LEFT: 'RX-', RY_UP: 'RY+', RY_DOWN: 'RY-',
};

/** Per-mode overrides (from hoja2's per-mode name tables). */
const MODE_LABELS = {
  xinput: { LT_ANALOG: 'LT', RT_ANALOG: 'RT' },
  n64: { CUP: N_('C Up'), CDOWN: N_('C Down'), CLEFT: N_('C Left'), CRIGHT: N_('C Right'), LX_RIGHT: 'X+', LX_LEFT: 'X-', LY_UP: 'Y+', LY_DOWN: 'Y-' },
  gamecube: {
    L_ANALOG: 'LT', R_ANALOG: 'RT', LX_RIGHT: 'X+', LX_LEFT: 'X-', LY_UP: 'Y+', LY_DOWN: 'Y-',
    RX_RIGHT: 'CX+', RX_LEFT: 'CX-', RY_UP: 'CY+', RY_DOWN: 'CY-',
  },
  sinput: {
    LB: 'L1', RB: 'R1', LT: 'L2', LT_ANALOG: 'L2A', RT: 'R2', RT_ANALOG: 'R2A',
    LP_1: 'L4', RP_1: 'R4', LP_2: 'L5', RP_2: 'R5', GUIDE: N_('S Guide'),
    MISC_3: '3', MISC_4: '4', MISC_5: '5', MISC_6: '6', TP_1: 'TPL', TP_2: 'TPR',
  },
};

/** Longer descriptions for outputs whose short label is cryptic (tooltips / editor). */
const MODE_HINTS = {
  xinput: { LT_ANALOG: N_('Left trigger (analog)'), RT_ANALOG: N_('Right trigger (analog)') },
  gamecube: { L_ANALOG: N_('L trigger (analog)'), R_ANALOG: N_('R trigger (analog)'), L: N_('L trigger click (digital)'), R: N_('R trigger click (digital)') },
  sinput: {
    LT: N_('Left trigger (digital)'), LT_ANALOG: N_('Left trigger (analog)'), RT: N_('Right trigger (digital)'), RT_ANALOG: N_('Right trigger (analog)'),
    LP_1: N_('Left paddle 1'), RP_1: N_('Right paddle 1'), LP_2: N_('Left paddle 2'), RP_2: N_('Right paddle 2'),
    MISC_3: N_('Misc 3 (power)'), MISC_4: N_('Misc 4'), MISC_5: N_('Misc 5'), MISC_6: N_('Misc 6'), TP_1: N_('Touchpad 1'), TP_2: N_('Touchpad 2'),
  },
};
/** Hints that come from the firmware enums' doc comments (e.doc), listed so they get translated. */
N_('Stick left'); N_('Stick right');

/** Descriptive output labels that are translated for display (see outputName() in parts.js). */
export const TRANSLATED_LABELS = new Set([
  ...['UP', 'DOWN', 'LEFT', 'RIGHT', 'PLUS', 'MINUS', 'CAPTURE', 'BACK', 'GUIDE', 'SHARE', 'SOUTH', 'EAST', 'WEST', 'NORTH']
    .map((k) => COMMON_LABELS[k]),
  ...Object.values(MODE_LABELS.n64).filter((l) => l.startsWith('C ')),
  MODE_LABELS.sinput.GUIDE,
]);

/**
 * Output type of a mode's output code, from its enum name. Mirrors the private
 * `_<mode>_output_types` tables in mapper.c (verified for all six modes):
 * *_ANALOG → HOVER (analog trigger), [LR][XY]_* → JOYSTICK, UP/DOWN/LEFT/RIGHT → DPAD, else DIGITAL.
 */
function outputTypeOf(suffix) {
  if (/_ANALOG$/.test(suffix)) return OUTPUT_TYPE.HOVER;
  if (/^[LR][XY]_/.test(suffix)) return OUTPUT_TYPE.JOYSTICK;
  if (/^(UP|DOWN|LEFT|RIGHT)$/.test(suffix)) return OUTPUT_TYPE.DPAD;
  return OUTPUT_TYPE.DIGITAL;
}

const prettify = (suffix) => suffix.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const outputCache = new Map();

/**
 * Every output a mode can send, from its firmware enum.
 * @returns {Array<{code:number, key:string, label:string, hint:string, type:number}>}
 */
export function outputsFor(modeId) {
  if (outputCache.has(modeId)) return outputCache.get(modeId);
  const mode = getMode(modeId);
  const list = enumValues(mode.enumName)
    .filter((e) => e.value >= 0 && !e.name.endsWith('_MAX'))
    .map((e) => {
      const key = e.name.replace(mode.prefix, '');
      const label = MODE_LABELS[modeId]?.[key] ?? COMMON_LABELS[key] ?? (key.length <= 2 ? key : prettify(key));
      return { code: e.value, key, label, hint: MODE_HINTS[modeId]?.[key] || e.doc || '', type: outputTypeOf(key) };
    });
  outputCache.set(modeId, list);
  return list;
}

/** Look up one output of a mode; null when the code is -1 / out of range (= disabled). */
export function outputOf(modeId, code) {
  return code >= 0 ? outputsFor(modeId).find((o) => o.code === code) || null : null;
}

/** Customer-facing names for input / output kinds. */
export const INPUT_TYPE_LABEL = { [INPUT_TYPE.DIGITAL]: N_('Button'), [INPUT_TYPE.HOVER]: N_('Analog'), [INPUT_TYPE.JOYSTICK]: N_('Stick direction') };
export const OUTPUT_TYPE_LABEL = {
  [OUTPUT_TYPE.DISABLED]: N_('Off'), [OUTPUT_TYPE.DIGITAL]: N_('Button'), [OUTPUT_TYPE.HOVER]: N_('Analog trigger'),
  [OUTPUT_TYPE.JOYSTICK]: N_('Stick direction'), [OUTPUT_TYPE.DPAD]: N_('D-pad'),
};

// ---------------------------------------------------------------------------------------------
// Mode rules (what the editor offers), mirroring mapper.c's per-type handling
// ---------------------------------------------------------------------------------------------

export const isAnalogInput = (inputType) => inputType === INPUT_TYPE.HOVER || inputType === INPUT_TYPE.JOYSTICK;
const isAnalogOutput = (outputType) => outputType === OUTPUT_TYPE.HOVER || outputType === OUTPUT_TYPE.JOYSTICK;

/**
 * Output modes that make sense for an input → output pair.
 *   digital in            → none (on/off; mode is ignored)
 *   analog in → button/d-pad → rapid, threshold  (_handle_analog_to_digital)
 *   analog in → analog out   → rapid, threshold, passthrough (_handle_analog_to_analog)
 * hoja2 also offered "passthrough" for d-pad outputs, but the firmware handles d-pad like a button
 * (passthrough would silently behave as rapid trigger), so it is not offered here.
 */
export function modeOptions(inputType, outputType) {
  if (!isAnalogInput(inputType) || outputType == null || outputType === OUTPUT_TYPE.DISABLED) return [];
  return isAnalogOutput(outputType)
    ? [OUTPUT_MODE.RAPID, OUTPUT_MODE.THRESHOLD, OUTPUT_MODE.PASSTHROUGH]
    : [OUTPUT_MODE.RAPID, OUTPUT_MODE.THRESHOLD];
}

/** The mode the firmware would pick for a pair (_mapper_set_defaults). */
export function defaultOutputMode(inputType, outputType) {
  if (!isAnalogInput(inputType)) return 0;
  if (outputType === OUTPUT_TYPE.DPAD) return OUTPUT_MODE.THRESHOLD;
  if (isAnalogOutput(outputType)) return OUTPUT_MODE.PASSTHROUGH;
  return OUTPUT_MODE.RAPID;
}

/** How the firmware will actually treat a stored mode for this pair (unknown values fall back). */
export function effectiveMode(inputType, outputType, stored) {
  const opts = modeOptions(inputType, outputType);
  if (!opts.length) return null;
  if (opts.includes(stored)) return stored;
  return isAnalogOutput(outputType) ? OUTPUT_MODE.PASSTHROUGH : OUTPUT_MODE.RAPID;
}

/** Whether threshold_delta matters (rapid or threshold on an analog input). */
export const usesThreshold = (inputType, outputType, mode) =>
  modeOptions(inputType, outputType).length > 0 && (mode === OUTPUT_MODE.RAPID || mode === OUTPUT_MODE.THRESHOLD);

/** Whether static_output matters: an analog output driven by a press (digital input, or rapid/threshold). */
export function usesStaticOutput(inputType, outputType, mode) {
  if (!isAnalogOutput(outputType)) return false;
  if (inputType === INPUT_TYPE.DIGITAL) return true;
  return isAnalogInput(inputType) && (mode === OUTPUT_MODE.RAPID || mode === OUTPUT_MODE.THRESHOLD);
}

export const MODE_LABEL = {
  [OUTPUT_MODE.RAPID]: N_('Rapid trigger'),
  [OUTPUT_MODE.THRESHOLD]: N_('Threshold'),
  [OUTPUT_MODE.PASSTHROUGH]: N_('Full analog'),
};

/** Names used by hoja2's copy/paste JSON (kept so clipboard data stays compatible). */
export const MODE_CLIP_NAME = { [OUTPUT_MODE.RAPID]: 'rapid', [OUTPUT_MODE.THRESHOLD]: 'threshold', [OUTPUT_MODE.PASSTHROUGH]: 'passthrough' };
export const CLIPBOARD_HEADER = 'INPUT_CONFIG_V1';

// ---------------------------------------------------------------------------------------------
// Glyphs ("Input Prompts" by Kenney, CC0) in assets/glyphs/<name>.png
// ---------------------------------------------------------------------------------------------

const GLYPHS = new Set(('1 2 3 4 5 6 a b back capture cdown cleft cright cup cx+ cx- cy+ cy- ddown disabled dleft dright dup ' +
  'east gl gr guide home l l1 l2 l2a l3 l4 l5 lb lg lp ls lt lx+ lx- ly+ ly- minus nb1 nb2 north plus power r r1 r2 r2a ' +
  'r3 r4 r5 rb rg rp rs rt rx+ rx- rx ry+ ry- ry select sguide share sl soptions south sr sselect start sview tp tpl tpr ' +
  'west x+ x- x y+ y- y z zl zr').split(' '));

const GLYPH_BASE = new URL('../../../assets/glyphs/', import.meta.url);

/**
 * URL of the glyph for a label, using hoja2's naming rule (lower-case, spaces removed:
 * 'D Up' → dup.png). Returns null when there is no glyph, so callers show the text instead.
 */
export function glyphUrl(label) {
  const key = String(label || '').toLowerCase().replace(/\s+/g, '');
  return GLYPHS.has(key) ? new URL(`${encodeURIComponent(key)}.png`, GLYPH_BASE).href : null;
}

// ---------------------------------------------------------------------------------------------
// Firmware-equivalent defaults (used by the demo controller)
// ---------------------------------------------------------------------------------------------

/**
 * Fill a profile like mapper.c `_mapper_set_defaults()` does: output code from `table`
 * ({ INPUT_KEY: 'OUTPUT_SUFFIX' }, missing = unused), full-scale static output, 50% threshold,
 * and the per-type default output mode.
 * @param {string} modeId
 * @param {Array} slots    inputConfigSlot_s[] copy to fill (returned)
 * @param {Array} infos    inputInfoSlot_s[] (static input info)
 * @param {Record<string,string>} table
 */
export function fillDefaultProfile(modeId, slots, infos, table) {
  const outputs = outputsFor(modeId);
  for (const { code, key } of INPUT_CODES) {
    const slot = slots[code];
    if (!slot) continue;
    const out = outputs.find((o) => o.key === table[key]);
    slot.output_code = out ? out.code : -1;
    slot.static_output = DEFAULT_STATIC_OUTPUT;
    slot.threshold_delta = DEFAULT_THRESHOLD;
    slot.output_mode = defaultOutputMode(infos[code]?.input_type ?? 0, out ? out.type : OUTPUT_TYPE.DISABLED);
  }
  return slots;
}

// ---------------------------------------------------------------------------------------------
// Profile access (session.config.input). Array fields return copies, so patch + assign back.
// ---------------------------------------------------------------------------------------------

/** All 36 slots of a mode's profile (copies). */
export function readProfile(session, modeId) {
  return session.config.input[getMode(modeId).profile];
}

/**
 * Patch one slot of a mode's profile and push the `input` block to the controller (debounced,
 * marks it unsaved). The firmware's mapper reads the profile live, so changes apply immediately.
 * @param {object} session
 * @param {string} modeId
 * @param {number} code input code
 * @param {{output_code?: number, output_mode?: number, threshold_delta?: number, static_output?: number}} patch
 */
export function writeSlot(session, modeId, code, patch) {
  const cfg = session.config.input;
  const field = getMode(modeId).profile;
  const slots = cfg[field];
  Object.assign(slots[code], patch); // struct setters
  cfg[field] = slots;
  session.commit('input');
}
