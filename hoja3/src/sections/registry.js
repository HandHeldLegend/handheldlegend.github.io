/**
 * registry.js — Every page in the app, as plain data.
 *
 * This file must stay free of DOM code: the MCP server (mcp/server.mjs) imports it in Node to
 * describe the app to AI assistants and build deep links.
 *
 * Fields:
 *   id          route segment: #/<id>
 *   title       nav label
 *   summary     one line shown on tiles and page headers (also used by the MCP server)
 *   icon        name in assets/icons/ui.svg (without the "i-" prefix)
 *   tone        SFC splash color: red | yellow | blue | green | lavender
 *   group       sidebar group id (see GROUPS)
 *   device      true when the page needs a connected controller
 *   requires    capability flag from session.caps that must be true (null = always available)
 *   keywords    extra search terms for assistants
 *   params      documented deep-link query params: { name: description }
 *   load        lazy import of the view module (exports mount(root, ctx))
 */

export const GROUPS = [
  { id: 'start', title: 'Start' },
  { id: 'controls', title: 'Controls' },
  { id: 'feedback', title: 'Lights & feedback' },
  { id: 'system', title: 'Power & wireless' },
  { id: 'device', title: 'Device' },
  { id: 'play', title: 'Play' },
  { id: 'app', title: 'App' },
];

export const SECTIONS = [
  {
    id: 'home', title: 'Home', icon: 'home', tone: 'lavender', group: 'start', device: false, requires: null,
    summary: 'Connect a controller and see its status at a glance.',
    params: { connect: 'Set to 1 to open the controller picker immediately (needs a click in most browsers).' },
    load: () => import('./home/view.js'),
  },
  {
    id: 'input', title: 'Input', icon: 'input', tone: 'lavender', group: 'controls', device: true, requires: null,
    summary: 'Remap buttons per output mode, analog trigger thresholds and rapid trigger.',
    keywords: ['remap', 'mapping', 'buttons', 'trigger', 'hall effect', 'rapid trigger', 'hover', 'calibrate triggers'],
    params: { mode: 'Output profile to edit: switch | xinput | snes | n64 | gamecube | sinput', input: 'Input to open in the editor: INPUT_CODE name (e.g. south, lt_analog), the build’s input name, or its number', tab: 'remap | calibrate' },
    load: () => import('./input/view.js'),
  },
  {
    id: 'joysticks', title: 'Joysticks', icon: 'joystick', tone: 'red', group: 'controls', device: true, requires: 'analog',
    summary: 'Calibrate sticks, set deadzones, response curve, invert axes and angle maps.',
    keywords: ['calibration', 'deadzone', 'drift', 'notches', 'octagon', 'gate', 'angle', 'sensitivity', 'curve'],
    params: { stick: 'left | right', tab: 'Sub-view to open: calibrate | sensitivity | angles | axes (deadzone = old alias)' },
    load: () => import('./joysticks/view.js'),
  },
  {
    id: 'snapback', title: 'Snapback', icon: 'snapback', tone: 'green', group: 'controls', device: true, requires: 'analog',
    summary: 'Tune the snapback filter that removes stick "bounce" when you let go.',
    keywords: ['snapback', 'filter', 'bounce', 'melee', 'dash back'],
    params: { stick: 'left | right' },
    load: () => import('./snapback/view.js'),
  },
  {
    id: 'motion', title: 'Motion', icon: 'motion', tone: 'yellow', group: 'controls', device: true, requires: 'imu',
    summary: 'Gyro and accelerometer calibration, sensitivity and live view.',
    keywords: ['gyro', 'imu', 'accelerometer', 'motion controls', 'calibrate gyro'],
    load: () => import('./motion/view.js'),
  },
  {
    id: 'rgb', title: 'RGB', icon: 'rgb', tone: 'red', group: 'feedback', device: true, requires: 'rgb',
    summary: 'LED colors per group, effects, speed and brightness.',
    keywords: ['led', 'lights', 'color', 'color', 'rainbow', 'brightness'],
    load: () => import('./rgb/view.js'),
  },
  {
    id: 'haptics', title: 'Haptics', icon: 'haptics', tone: 'yellow', group: 'feedback', device: true, requires: 'haptics',
    summary: 'Rumble strength, trigger haptics and a feedback test.',
    keywords: ['rumble', 'vibration', 'hd rumble', 'force feedback'],
    load: () => import('./haptics/view.js'),
  },
  {
    id: 'battery', title: 'Battery', icon: 'battery', tone: 'green', group: 'system', device: true, requires: 'battery',
    summary: 'Battery, charger (PMIC) and fuel gauge status.',
    keywords: ['battery', 'charging', 'pmic', 'fuel gauge', 'power'],
    load: () => import('./battery/view.js'),
  },
  {
    id: 'wireless', title: 'Wireless', icon: 'wireless', tone: 'blue', group: 'system', device: true, requires: 'wireless',
    summary: 'Bluetooth pairing info, wireless module firmware and WLAN dongle settings.',
    keywords: ['bluetooth', 'pairing', 'esp32', 'baseband', 'wlan', 'dongle', 'fcc'],
    params: { update: 'Set to 1 to open the wireless module update dialog', baud: 'esptool baud rate override (default 115200)' },
    load: () => import('./wireless/view.js'),
  },
  {
    id: 'gamepad', title: 'Gamepad', icon: 'gamepad', tone: 'blue', group: 'device', device: true, requires: null,
    summary: 'Default mode, Switch body colors, MAC address and device info.',
    keywords: ['mode', 'default mode', 'switch', 'xinput', 'colors', 'mac', 'bootloader'],
    load: () => import('./gamepad/view.js'),
  },
  {
    id: 'user', title: 'User', icon: 'user', tone: 'green', group: 'device', device: true, requires: null,
    summary: 'Your player name stored on the controller.',
    keywords: ['username', 'name', 'player'],
    load: () => import('./user/view.js'),
  },
  {
    id: 'firmware', title: 'Firmware', icon: 'firmware', tone: 'blue', group: 'device', device: false, requires: null,
    summary: 'Update firmware, install HOJA on a blank board, or recover a controller.',
    keywords: ['update', 'firmware', 'bootloader', 'bootsel', 'uf2', 'flash', 'nuke', 'install', 'recover'],
    params: { build: 'Build id to preselect for install (e.g. gcu_2, progcc_3.2)' },
    load: () => import('./firmware/view.js'),
  },
  {
    id: 'arena', title: 'Arena', icon: 'arena', tone: 'red', group: 'play', device: true, requires: null,
    summary: 'Gameplay testing arena: try your connected controller in a platform-fighter sandbox.',
    keywords: ['test', 'play', 'game', 'input display', 'latency', 'wavedash', 'dash', 'melee'],
    params: { tab: 'play | lab | help', mode: 'free | targets (lab / help also open those tabs)' },
    load: () => import('./arena/view.js'),
  },
  {
    id: 'settings', title: 'App settings', icon: 'settings', tone: 'lavender', group: 'app', device: false, requires: null,
    summary: 'Theme (dark, light or system), motion, install and updates.',
    keywords: ['theme', 'dark mode', 'light mode', 'install app', 'offline'],
    params: { theme: 'dark | light | system' },
    load: () => import('./settings/view.js'),
  },
  {
    id: 'about', title: 'Help & about', icon: 'help', tone: 'lavender', group: 'app', device: false, requires: null,
    summary: 'Troubleshooting, version info and attributions.',
    keywords: ['help', 'support', 'troubleshooting', 'attributions', 'license', 'version'],
    load: () => import('./about/view.js'),
  },
];

export function getSection(id) {
  return SECTIONS.find((s) => s.id === id);
}
