/**
 * Demo-controller hooks for the "snapback" section (used only with ?demo; see src/device/mock.js).
 *   seed(device)                 adjust device.config / device.static after the base demo data is set
 *   command(block, cmd, device)  return { status, data } to customize a config command's reply,
 *                                or undefined for the default success. May dispatch events on device.
 *
 * The real controller sends an analog dump (0xFA) by itself whenever an axis is flicked to the edge and
 * released — there is no command for it. The demo imitates that: every few seconds it "flicks" the next
 * axis (LX, LY, RX, RY…) and dispatches a 'snapback' event with a 64-byte DataView in the firmware format
 * ([0] 0xFA, [1] axis, [2..63] (value + 2048) >> 4). The simulated rebound respects that stick's current
 * filter mode and cutoff so changing the settings visibly changes the plot.
 */
const SAMPLE_S = 0.0005;   // 2 kHz analog poll
const SAMPLES = 62;
const INTERVAL_MS = 4000;

let timer = 0;
let axis = 0;
let listening = false;

/** Underdamped spring rebound from ~87 % (where the firmware starts recording), in −1..1. */
function rawRebound(sign) {
  const out = [];
  const f = 42 + Math.random() * 8;      // Hz
  const decay = 85 + Math.random() * 20; // 1/s
  for (let i = 0; i < SAMPLES; i++) {
    const t = i * SAMPLE_S;
    out.push(sign * 0.87 * Math.cos(2 * Math.PI * f * t) * Math.exp(-decay * t));
  }
  return out;
}

/** Rough stand-ins for the firmware filters (snapback_lpf.c / snapback_auto.c). */
function filtered(raw, type, cutoffHz) {
  if (type === 2) return raw; // Off
  if (type === 1) {
    // Auto: once the stick crosses center, hold back the rebound and let it decay in.
    const sign = Math.sign(raw[0]);
    let crossed = false;
    return raw.map((v) => {
      if (Math.sign(v) !== sign) crossed = true;
      return crossed ? v * 0.12 : v;
    });
  }
  // Low-pass (first order) inside the ~88 % filter zone.
  const hz = Math.min(150, Math.max(30, cutoffHz || 60));
  const alpha = 1 - Math.exp(-2 * Math.PI * hz * SAMPLE_S);
  let y = raw[0];
  return raw.map((v) => (y += alpha * (v - y)));
}

function dump(device) {
  const a = device.config.analog;
  const left = axis < 2;
  const type = left ? a.l_snapback_type : a.r_snapback_type;
  const cutoff = (left ? a.l_snapback_intensity : a.r_snapback_intensity) / 10;
  const sign = Math.random() < 0.5 ? -1 : 1;
  const samples = filtered(rawRebound(sign), type > 2 ? 0 : type, cutoff);

  const buf = new Uint8Array(64);
  buf[0] = 0xfa;
  buf[1] = axis;
  samples.forEach((v, i) => {
    const raw = Math.round(v * 2048 + (Math.random() * 24 - 12)) + 2048;
    buf[2 + i] = Math.max(0, Math.min(255, raw >> 4));
  });
  device.dispatchEvent(new CustomEvent('snapback', { detail: new DataView(buf.buffer) }));
  axis = (axis + 1) % 4;
}

export function seed(device) {
  const a = device.config.analog;
  a.l_snapback_type = 0;
  a.r_snapback_type = 0;
  a.l_snapback_intensity = 600;
  a.r_snapback_intensity = 750;

  clearInterval(timer);
  axis = 0;
  timer = setInterval(() => { if (device.isConnected) dump(device); }, INTERVAL_MS);
  if (!listening) {
    listening = true;
    device.addEventListener('disconnect', () => { clearInterval(timer); timer = 0; });
  }
}

export function command() { return undefined; }
