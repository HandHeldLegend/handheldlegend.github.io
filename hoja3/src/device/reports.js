/**
 * reports.js — Decode (and, for the demo controller, encode) the live WebUSB input report.
 *
 * Layout from HOJA-LIB-RP2040 src/usb/webusb.c `webusb_send_rawinput()` (64 bytes, ~125 Hz):
 *   [0]      report id: 0xFF raw/hover stream, 0xFE joystick stream (choose with device.setInputMode)
 *   [1]      bit0 charging, bit1 charge done
 *   [2]      fuel gauge percent
 *   [3..8]   accel x, y, z   int16 LE
 *   [9..14]  gyro  x, y, z   int16 LE
 *   0xFF (raw):
 *     [15..16] focused input: big-endian u16, bit15 = pressed, low 15 bits = 0..4095
 *     [17..52] all 36 mapper inputs: bit7 = pressed, bits0-6 = value >> 5 (0..127)
 *   0xFE (joysticks), big-endian u16 values centered at 2048:
 *     [15..22] lx, ly, rx, ry after snapback filtering
 *     [23..30] lx, ly, rx, ry after deadzone processing
 */
export const INPUT_COUNT = 36;

const be16 = (v, i) => (v.getUint8(i) << 8) | v.getUint8(i + 1);

/**
 * @param {DataView} v
 * @returns {{kind: 'raw'|'joysticks', charging: boolean, chargeDone: boolean, batteryPercent: number,
 *   accel: {x:number,y:number,z:number}, gyro: {x:number,y:number,z:number},
 *   focused?: {value:number, pressed:boolean}, inputs?: Array<{value:number, pressed:boolean}>,
 *   sticks?: {snapback:{lx,ly,rx,ry}, deadzone:{lx,ly,rx,ry}}}|null}
 *   Stick values are centered (−2048..2047). Raw input values are 0..127 (7-bit).
 */
export function decodeInputReport(v) {
  const id = v.getUint8(0);
  if (id !== 0xff && id !== 0xfe) return null;
  const out = {
    kind: id === 0xff ? 'raw' : 'joysticks',
    charging: !!(v.getUint8(1) & 1),
    chargeDone: !!(v.getUint8(1) & 2),
    batteryPercent: v.getUint8(2),
    accel: { x: v.getInt16(3, true), y: v.getInt16(5, true), z: v.getInt16(7, true) },
    gyro: { x: v.getInt16(9, true), y: v.getInt16(11, true), z: v.getInt16(13, true) },
  };
  if (id === 0xff) {
    const f = be16(v, 15);
    out.focused = { value: f & 0x7fff, pressed: !!(f & 0x8000) };
    out.inputs = [];
    for (let i = 0; i < INPUT_COUNT; i++) {
      const b = v.getUint8(17 + i);
      out.inputs.push({ value: b & 0x7f, pressed: !!(b & 0x80) });
    }
  } else {
    const stick = (o) => ({ lx: be16(v, o) - 2048, ly: be16(v, o + 2) - 2048, rx: be16(v, o + 4) - 2048, ry: be16(v, o + 6) - 2048 });
    out.sticks = { snapback: stick(15), deadzone: stick(23) };
  }
  return out;
}

/** Inverse of decodeInputReport (used by the demo controller). Returns a DataView of 64 bytes. */
export function encodeInputReport(r) {
  const v = new DataView(new ArrayBuffer(64));
  const put16 = (i, n) => { v.setUint8(i, (n >> 8) & 0xff); v.setUint8(i + 1, n & 0xff); };
  v.setUint8(0, r.kind === 'joysticks' ? 0xfe : 0xff);
  v.setUint8(1, (r.charging ? 1 : 0) | (r.chargeDone ? 2 : 0));
  v.setUint8(2, r.batteryPercent ?? 0);
  const a = r.accel || {}; const g = r.gyro || {};
  [a.x, a.y, a.z, g.x, g.y, g.z].forEach((n, i) => v.setInt16(3 + i * 2, n || 0, true));
  if (r.kind === 'joysticks') {
    const s = r.sticks;
    [s.snapback, s.deadzone].forEach((st, k) => {
      ['lx', 'ly', 'rx', 'ry'].forEach((ax, i) => put16(15 + k * 8 + i * 2, Math.max(0, Math.min(4095, Math.round(st[ax] + 2048)))));
    });
  } else {
    put16(15, (r.focused?.value ?? 0) | (r.focused?.pressed ? 0x8000 : 0));
    (r.inputs || []).forEach((inp, i) => v.setUint8(17 + i, (inp.value & 0x7f) | (inp.pressed ? 0x80 : 0)));
  }
  return v;
}

/**
 * Subscribe to decoded input reports. Returns an unsubscribe function.
 *   const stop = onInputReport(device, (r) => { if (r.kind === 'joysticks') ... });
 */
export function onInputReport(device, fn) {
  const handler = (e) => { const r = decodeInputReport(e.detail); if (r) fn(r, e.detail); };
  device.addEventListener('input', handler);
  return () => device.removeEventListener('input', handler);
}
