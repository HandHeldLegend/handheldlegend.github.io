/**
 * mock.js — A simulated HOJA controller for demos, UI development and automated testing.
 *
 * Enable with `?demo` in the URL (e.g. index.html?demo#/joysticks) or the "Try the demo controller"
 * button on Home. It patches the shared `device` instance so the whole app — session, sections,
 * deep links — runs exactly as with real hardware: blocks read/write in memory, commands succeed,
 * and live input reports stream at ~60 Hz (sticks orbit, buttons blink, IMU wobbles).
 *
 * Nothing here talks to USB. Writes are logged to the console with the [demo] prefix.
 */
import { device } from './hoja-device.js';
import { LAYOUT, encodeText, enumValues } from './struct.js';
import { encodeInputReport, INPUT_COUNT } from './reports.js';

/** Sections that provide demo hooks in src/sections/<id>/demo.js (seed + command). */
const DEMO_SECTIONS = ['gamepad', 'input', 'joysticks', 'snapback', 'motion', 'rgb', 'battery', 'wireless'];
let hooks = [];

let active = false;
let timer = null;
let streamKind = 'raw';
let focused = 0;

export const isDemo = () => active;

/** Input names/types as a typical full-featured build would report them. */
function seedInputStatic() {
  const codes = enumValues('mapper_input_code_t').filter((e) => e.value >= 0 && !e.name.endsWith('_MAX'));
  const slots = device.static.input.input_info;
  const pretty = {
    SOUTH: 'A', EAST: 'B', WEST: 'X', NORTH: 'Y', UP: 'Up', DOWN: 'Down', LEFT: 'Left', RIGHT: 'Right',
    LB: 'L', RB: 'R', LT: 'ZL', LT_ANALOG: 'ZL Ana', RT: 'ZR', RT_ANALOG: 'ZR Ana', START: 'Start', SELECT: 'Select',
    HOME: 'Home', SHARE: 'Capture', LS: 'LS', RS: 'RS', LP1: 'LP1', RP1: 'RP1', LP2: 'LP2', RP2: 'RP2',
  };
  for (const c of codes) {
    const key = c.name.replace('INPUT_CODE_', '');
    const slot = slots[c.value];
    if (!slot) continue;
    const isStickDir = /^[LR][XY]_/.test(key);
    const isHover = key === 'LT_ANALOG' || key === 'RT_ANALOG';
    const unused = /^MISC|^TP/.test(key);
    slot.input_type = unused ? 0 : isStickDir ? 3 : isHover ? 2 : 1;
    slot.input_name = encodeText(pretty[key] || key, 8);
    slot.rgb_group = { SOUTH: 2, EAST: 2, WEST: 2, NORTH: 2, UP: 1, DOWN: 1, LEFT: 1, RIGHT: 1, START: 3, SELECT: 3, HOME: 4 }[key] || 0;
  }
  device.static.input.input_info = slots;
}

function seed() {
  const s = device.static;
  s.device.name = encodeText('Demo Controller', 16);
  s.device.maker = encodeText('Hand Held Legend', 16);
  s.device.fw_version = 0x6800_0000;
  s.device.snes_supported = 1;
  s.device.joybus_supported = 1;

  Object.assign(s.analog, { axis_lx: 1, axis_ly: 1, axis_rx: 1, axis_ry: 1, axis_lt: 1, axis_rt: 1, invert_allowed: 1 });
  Object.assign(s.imu, { axis_gyro_a: 1, axis_accel_a: 1 });
  Object.assign(s.haptic, { haptic_hd: 1, haptic_sd: 0 });
  s.battery.battery_capacity_mah = 1000;
  s.battery.battery_part_number = encodeText('DEMO-1000', 24);
  s.battery.pmic_status = 2;
  s.battery.pmic_part_number = encodeText('BQ25180', 24);
  s.battery.fuelgauge_status = 1;
  s.battery.fuelgauge_part_number = encodeText('MAX17048', 24);
  Object.assign(s.bluetooth, { bluetooth_bdr_supported: 1, bluetooth_ble_supported: 1, external_update_supported: 1, wireless_part_status: 2, wlan_supported: 1 });
  s.bluetooth.part_number = encodeText('ESP32-C3', 24);
  s.bluetooth.external_version_number = 0xffff; // newest possible, so no update badge in demo
  s.bluetooth.fcc_id = encodeText('2A-DEMO-0001', 24);
  s.rgb.rgb_groups = 4;
  s.rgb.rgb_group_names = ['D-Pad', 'Face', 'Start', 'Logo'].map((n, i) => {
    const g = s.rgb.rgb_group_names[i];
    g.rgb_group_name = encodeText(n, 8);
    return g;
  });
  s.rgb.rgb_player_group = 3;
  seedInputStatic();

  const c = device.config;
  c.gamepad.gamepad_config_version = LAYOUT.defines.CFG_BLOCK_GAMEPAD_VERSION ?? 0;
  c.gamepad.gamepad_default_mode = 0;
  c.gamepad.gamepad_mac_address = [0x7c, 0xbb, 0x8a, 0x12, 0x34, 0x56];
  c.gamepad.gamepad_color_body = 0x8e7cc3;
  c.gamepad.gamepad_color_buttons = 0xe9e8ee;
  c.gamepad.gamepad_color_grip_left = 0x2f6bd8;
  c.gamepad.gamepad_color_grip_right = 0xe23b3b;
  c.gamepad.webusb_enable_popup = 1;
  c.haptic.haptic_strength = 200;
  c.haptic.haptic_triggers = 1;
  c.user.user_name = encodeText('Player 1', 24);
  c.analog.analog_calibration_set = 1;
  c.analog.l_deadzone = 80;
  c.analog.r_deadzone = 80;
  c.analog.l_exp_scaler = 51;
  c.analog.r_exp_scaler = 51;
  c.hover.hover_calibration_set = 1;
  c.rgb.rgb_mode = 0;
  c.rgb.rgb_speed = 1000;
  c.rgb.rgb_brightness = 2048;
  c.rgb.rgb_colors = [0x2f6bd8, 0xe23b3b, 0xf4b41a, 0x23a35a, ...new Array(28).fill(0x8e7cc3)];
  c.imu.imu_gyro_sensitivity = [120, 120, 120];
  c.imu.imu_accel_sensitivity = [100, 100, 100];
}

/** Synthesized live state at time t (seconds). */
function frame(t) {
  const orbit = (r, speed, phase = 0) => [Math.cos(t * speed + phase) * r, Math.sin(t * speed + phase) * r];
  const [lx, ly] = orbit(1500 + 400 * Math.sin(t * 0.7), 1.3);
  const [rx, ry] = orbit(900, -0.9, 1);
  const pressedIdx = Math.floor(t * 2) % 12;
  const imuOff = !!device.config.imu.imu_disabled;
  const base = {
    charging: true, chargeDone: false, batteryPercent: 76,
    accel: imuOff ? { x: 0, y: 0, z: 0 } : { x: Math.round(Math.sin(t) * 800), y: Math.round(Math.cos(t * 0.8) * 600), z: 4096 },
    gyro: imuOff ? { x: 0, y: 0, z: 0 } : { x: Math.round(Math.sin(t * 2.1) * 900), y: Math.round(Math.cos(t * 1.7) * 700), z: Math.round(Math.sin(t * 0.9) * 400) },
  };
  if (streamKind === 'joysticks') {
    const dz = (v) => (Math.abs(v) < 80 ? 0 : v);
    return encodeInputReport({ ...base, kind: 'joysticks', sticks: {
      snapback: { lx, ly, rx, ry }, deadzone: { lx: dz(lx), ly: dz(ly), rx: dz(rx), ry: dz(ry) } } });
  }
  const inputs = [];
  for (let i = 0; i < INPUT_COUNT; i++) {
    const type = device.static.input.input_info[i]?.input_type ?? 0;
    let value = 0;
    if (type === 2) value = Math.round((Math.sin(t * 1.5 + i) * 0.5 + 0.5) * 127);
    else if (type === 3) value = Math.round(Math.max(0, Math.sin(t * 1.3 + i)) * 127);
    else if (type === 1 && i === pressedIdx) value = 127;
    inputs.push({ value, pressed: value > 64 });
  }
  const fv = Math.round((inputs[focused]?.value ?? 0) * 32.24);
  return encodeInputReport({ ...base, kind: 'raw', inputs, focused: { value: fv, pressed: fv > 2048 } });
}

function patch(name, fn) {
  Object.defineProperty(device, name, { value: fn, configurable: true, writable: true });
}

/** Turn the demo controller on and fire the normal 'connect' event. */
export async function startDemo() {
  if (active) return;
  active = true;
  Object.defineProperty(device, 'isConnected', { get: () => active, configurable: true });
  const ok = async () => true;
  patch('connect', async () => { startDemo(); return true; });
  patch('open', ok);
  patch('requestBlock', async () => {});
  patch('requestStatic', async () => {});
  patch('readAllConfig', async () => {});
  patch('readAllStatic', async () => {});
  patch('sendBlock', async (b) => { console.debug('[demo] write block', b); });
  patch('sendReport', async () => {});
  patch('save', async () => { console.debug('[demo] save'); await new Promise((r) => setTimeout(r, 300)); return true; });
  patch('sendConfigCommand', async (block, cmd) => {
    console.debug('[demo] command', block, cmd);
    await new Promise((r) => setTimeout(r, 400));
    const blockKey = typeof block === 'string' ? block : LAYOUT.blocks.config.find((b) => b.index === block)?.key;
    const cmdName = typeof cmd === 'string' ? cmd : Object.entries(LAYOUT.commands[blockKey] || {}).find(([, v]) => v === cmd)?.[0];
    for (const hk of hooks) {
      const r = await hk.command?.(blockKey, cmdName ?? cmd, device); // hooks may be async; raw id when unnamed
      if (r) return r;
    }
    return { status: true, data: null };
  });
  patch('rebootToBootloader', async () => { console.info('[demo] reboot to bootloader (ignored)'); return true; });
  patch('setInputMode', async (joysticks) => { streamKind = joysticks ? 'joysticks' : 'raw'; });
  patch('setFocusedInput', async (code) => { focused = code; });
  patch('disconnect', async () => { stopDemo(); return true; });

  seed();
  hooks = await Promise.all(DEMO_SECTIONS.map((id) => import(`../sections/${id}/demo.js`).catch(() => ({}))));
  for (const hk of hooks) {
    try { hk.seed?.(device); } catch (err) { console.warn('[demo] seed hook failed', err); }
  }
  const t0 = performance.now();
  timer = setInterval(() => {
    device.dispatchEvent(new CustomEvent('input', { detail: frame((performance.now() - t0) / 1000) }));
  }, 16);
  device.dispatchEvent(new CustomEvent('connect', { detail: { device, demo: true } }));
}

export function stopDemo() {
  if (!active) return;
  active = false;
  clearInterval(timer);
  for (const k of ['isConnected', 'connect', 'open', 'requestBlock', 'requestStatic', 'readAllConfig', 'readAllStatic', 'sendBlock',
    'sendReport', 'save', 'sendConfigCommand', 'rebootToBootloader', 'setInputMode', 'setFocusedInput', 'disconnect']) {
    delete device[k];
  }
  device.dispatchEvent(new CustomEvent('disconnect', { detail: {} }));
}
