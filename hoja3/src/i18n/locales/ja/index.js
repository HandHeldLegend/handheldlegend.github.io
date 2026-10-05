/** Japanese dictionary: merges every area file. Add new areas here. */
import core from './core.js';
import home from './home.js';
import firmware from './firmware.js';
import settings from './settings.js';
import about from './about.js';
import input from './input.js';
import joysticks from './joysticks.js';
import snapback from './snapback.js';
import motion from './motion.js';
import rgb from './rgb.js';
import haptics from './haptics.js';
import battery from './battery.js';
import wireless from './wireless.js';
import gamepad from './gamepad.js';
import user from './user.js';
import arena from './arena.js';

// core is spread LAST so shared words (Cancel, Reset, Save…) keep one translation app-wide.
export default { ...home, ...firmware, ...settings, ...about, ...input, ...joysticks, ...snapback, ...motion, ...rgb, ...haptics, ...battery, ...wireless, ...gamepad, ...user, ...arena, ...core };
