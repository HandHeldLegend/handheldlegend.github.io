/**
 * Demo-controller hooks for the "joysticks" section (used only with ?demo; see src/device/mock.js).
 *   seed(device)                 adjust device.config / device.static after the base demo data is set
 *   command(block, cmd, device)  return { status, data } to customize a config command's reply,
 *                                or undefined for the default success. May dispatch events on device.
 *
 * Simulates the firmware's calibration (src/input/stick_scaling.c):
 *   CALIBRATE_START  → centers captured, in_distance = 256 for every slot, curves reset to linear, then a
 *                      timer "rolls" both sticks around so in_distance grows like a real octagonal gate.
 *   CALIBRATE_STOP   → timer stops, analog_calibration_set = 1.
 *   CAPTURE_JOYSTICK_LEFT/RIGHT → 8-byte reply (float32 angle, float32 distance) from the last streamed
 *                      position, or a random notch if the joystick stream isn't running.
 */
import { decodeInputReport } from '../../device/reports.js';
import { fwDefine } from '../../device/struct.js';

const SLOT_FIELDS = ['joy_config_l', 'joy_config_r'];
let calTimer = 0;
let last = null; // last joystick report {lx, ly, rx, ry} (snapback stage)
let listening = false;

/** A slightly octagonal gate: notches reach further than the walls between them. */
const gateDistance = (angleDeg, base) => base + 90 * Math.cos((angleDeg * Math.PI) / 45) ** 2;

function seedSlots(slots, base, jitter) {
  slots.forEach((s, i) => {
    if (i < 8) {
      const a = i * 45 + (i % 2 ? jitter : -jitter * 0.5);
      s.enabled = 1;
      s.in_angle = (a + 360) % 360;
      s.in_distance = gateDistance(i * 45, base) + (i % 3) * 7;
      s.out_angle = i * 45;
      s.out_distance = 2048;
      s.deadzone = i % 2 ? 4 : 2;
    } else {
      Object.assign(s, { enabled: 0, in_angle: 0, in_distance: 2048, out_angle: 0, out_distance: 2048, deadzone: 2 });
    }
  });
  return slots;
}

export function seed(device) {
  const a = device.config.analog;
  a.joy_config_l = seedSlots(a.joy_config_l, 1420, 1.6);
  a.joy_config_r = seedSlots(a.joy_config_r, 1385, -1.1);
  a.l_deadzone_outer = 72;
  a.r_deadzone_outer = 72;
  a.lx_center = 2051; a.ly_center = 2039; a.rx_center = 2044; a.ry_center = 2056;

  if (listening) return; // seed runs on every demo start; listeners only once
  listening = true;
  device.addEventListener('input', (e) => {
    const r = decodeInputReport(e.detail);
    if (r?.sticks) last = r.sticks.snapback;
  });
  device.addEventListener('disconnect', () => { clearInterval(calTimer); calTimer = 0; last = null; });
}

function startCalibration(device) {
  const a = device.config.analog;
  for (const f of SLOT_FIELDS) {
    const slots = a[f];
    slots.forEach((s) => { s.in_distance = 256; });
    a[f] = slots;
  }
  a.l_exp_scaler = fwDefine('ANALOG_EXP_STORED_DEFAULT', 51);
  a.r_exp_scaler = fwDefine('ANALOG_EXP_STORED_DEFAULT', 51);
  a.lx_center = 2048 + Math.round(Math.random() * 12 - 6);
  a.ly_center = 2048 + Math.round(Math.random() * 12 - 6);
  a.rx_center = 2048 + Math.round(Math.random() * 12 - 6);
  a.ry_center = 2048 + Math.round(Math.random() * 12 - 6);

  // Sweep both "sticks" round: left a bit faster than right, ~2.5 s per lap, walls short of the notches.
  const t0 = performance.now();
  let prev = [0, 0];
  clearInterval(calTimer);
  calTimer = setInterval(() => {
    const t = (performance.now() - t0) / 1000;
    const angles = [t * 150, t * 120];
    SLOT_FIELDS.forEach((f, k) => {
      const slots = a[f];
      // Walk the swept arc in 2° steps so no slot's ±4° window is skipped.
      for (let ang = prev[k]; ang <= angles[k]; ang += 2) {
        const lap = Math.min(1, ang / 720); // the first two laps reach further each time
        const reach = 380 + lap * (gateDistance(ang % 360, k ? 1385 : 1420) - 380);
        for (const s of slots) {
          if (!s.enabled) continue;
          const d = Math.abs(((s.in_angle - ang) % 360 + 540) % 360 - 180);
          if (d <= 4 && reach > s.in_distance) s.in_distance = reach;
        }
      }
      prev[k] = angles[k];
      a[f] = slots;
    });
  }, 50);
}

function captureReply(stick) {
  let x; let y;
  if (last) {
    [x, y] = stick === 'left' ? [last.lx, last.ly] : [last.rx, last.ry];
  } else {
    const ang = Math.floor(Math.random() * 8) * 45 + (Math.random() * 4 - 2);
    x = Math.cos((ang * Math.PI) / 180) * 1400;
    y = Math.sin((ang * Math.PI) / 180) * 1400;
  }
  let angle = (Math.atan2(y, x) * 180) / Math.PI;
  if (angle < 0) angle += 360;
  const data = new Uint8Array(8);
  const v = new DataView(data.buffer);
  v.setFloat32(0, angle, true);
  v.setFloat32(4, Math.hypot(x, y), true);
  return { status: true, data };
}

export function command(block, cmd, device) {
  if (block !== 'analog') return undefined;
  switch (cmd) {
    case 'CALIBRATE_START':
      startCalibration(device);
      return { status: true, data: null };
    case 'CALIBRATE_STOP':
      clearInterval(calTimer);
      calTimer = 0;
      device.config.analog.analog_calibration_set = 1;
      return { status: true, data: null };
    case 'CAPTURE_JOYSTICK_LEFT':
      return captureReply('left');
    case 'CAPTURE_JOYSTICK_RIGHT':
      return captureReply('right');
    default:
      return undefined;
  }
}
