/**
 * esp-flasher.js — Writes HOJA ESP32 baseband firmware with esptool-js.
 *
 * Port of the flashing half of hoja_esptool/src/app.js (the standalone "HOJA Baseband Updater"
 * hoja2 opened in a new tab). Same files, offsets, USB filter, baud and flash options:
 *
 *   bootloader.bin       @ 0x1000   ┐
 *   partition-table.bin  @ 0x8000   ├ from HOJA-ESP32-Baseband/master/build on GitHub
 *   ESP32.bin            @ 0x10000  ┘
 *   connect → eraseFlash() → writeFlash({ flashSize/mode/freq: 'keep', compress: true })
 *
 * Two transports, like the standalone page's Serial/WebUSB switch:
 *   'serial'  Web Serial (desktop Chrome/Edge, uses the OS CH340 driver)
 *   'usb'     WebUSB CH34x driver from ./ch34x-webusb.js (Android, or when no driver is installed)
 *
 * In demo mode (`simulate: true`) nothing touches USB or the network; a timed fake run drives the
 * same callbacks so the update dialog can be demonstrated.
 */
import { CH34X_FILTER, Ch34xPort } from './ch34x-webusb.js';
import { t, N_ } from '../../i18n/index.js';

const FW_BASE = 'https://raw.githubusercontent.com/HandHeldLegend/HOJA-ESP32-Baseband/master/build';
/** name: English, for the esptool-style log; label: English source of the in-sentence name shown to users (t()). */
export const BASEBAND_IMAGES = Object.freeze([
  { name: 'Bootloader', label: N_('bootloader'), url: `${FW_BASE}/bootloader/bootloader.bin`, address: 0x1000 },
  { name: 'Partition table', label: N_('partition table'), url: `${FW_BASE}/partition_table/partition-table.bin`, address: 0x8000 },
  { name: 'Firmware', label: N_('firmware'), url: `${FW_BASE}/ESP32.bin`, address: 0x10000 },
]);

/** The baseband images are built for the original ESP32 (sdkconfig CONFIG_IDF_TARGET="esp32"). */
const EXPECTED_CHIP = 'ESP32';
const DEFAULT_BAUD = 115200;
const ESPTOOL_URL = new URL('../../../vendor/esptool-js/esptool.js', import.meta.url).href;
/**
 * The standalone updater always enabled esptool's packet tracing (hex dump of every USB packet to
 * the console). That's only useful for debugging and costs memory on a 1 MB write, so it's on
 * only with ?debug in the URL.
 */
const TRACE = new URLSearchParams(location.search).has('debug');

/** Which transports this browser can use. Android has WebUSB but no (USB) Web Serial. */
export function availableTransports() {
  const android = /Android/i.test(navigator.userAgent);
  const serial = !!navigator.serial && !android;
  return { serial, usb: !!navigator.usb, preferred: serial ? 'serial' : 'usb' };
}

/** Baud override: the same `?baud=` URL parameter the standalone updater honored. */
export function baudFromUrl(params = {}) {
  const raw = params.baud ?? new URLSearchParams(location.search).get('baud');
  const n = Number(raw);
  return raw != null && Number.isInteger(n) && n >= 9600 && n <= 2000000 ? n : DEFAULT_BAUD;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** ArrayBuffer → "binary string" (one char per byte), the image format esptool-js 0.4 expects. */
function toBinaryString(buf) {
  const bytes = new Uint8Array(buf);
  let out = '';
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return out;
}

/**
 * Download the three baseband images. The dialog does this *before* switching the controller
 * into update mode, so an offline browser fails early instead of leaving the controller stuck.
 * @param {{onProgress?: (done:number, total:number, label:string)=>void, simulate?: boolean}} [o]
 *   label: the image's English label (translate with t()); '' when everything is downloaded.
 * @returns {Promise<Array<{name:string, address:number, data:string, size:number}>>}
 */
export async function downloadBasebandImages({ onProgress, simulate = false } = {}) {
  const out = [];
  for (const [i, img] of BASEBAND_IMAGES.entries()) {
    onProgress?.(i, BASEBAND_IMAGES.length, img.label);
    if (simulate) {
      await sleep(250);
      out.push({ ...img, data: '', size: [24576, 3072, 1048576][i] });
      continue;
    }
    const res = await fetch(img.url, { cache: 'no-store' });
    if (!res.ok) throw new Error(t('Couldn’t download the {file} (HTTP {status}).', { file: t(img.label), status: res.status }));
    const buf = await res.arrayBuffer();
    if (!buf.byteLength) throw new Error(t('The downloaded {file} is empty.', { file: t(img.label) }));
    out.push({ ...img, data: toBinaryString(buf), size: buf.byteLength });
  }
  onProgress?.(BASEBAND_IMAGES.length, BASEBAND_IMAGES.length, '');
  return out;
}

/**
 * One flashing session: connect → erase → write → close.
 *
 *   const f = new EspFlasher({ log, simulate });
 *   await f.connect('serial');            // needs a user gesture (port picker)
 *   await f.erase();
 *   await f.write(images, (pct) => …);
 *   await f.close();
 */
export class EspFlasher {
  /** @param {{log?: (line:string)=>void, simulate?: boolean, baud?: number}} [o] */
  constructor({ log = () => {}, simulate = false, baud = DEFAULT_BAUD } = {}) {
    this.log = log;
    this.simulate = simulate;
    this.baud = baud;
    this.port = null;
    this.transport = null;
    this.loader = null;
    this.chip = null;
  }

  get connected() { return this.simulate ? !!this.chip : !!this.loader; }

  /**
   * Ask for the CH340 port and sync with the ESP32 ROM bootloader (uploads the flasher stub).
   * Call straight from a click handler: the port picker needs the user gesture.
   * @param {'serial'|'usb'} kind
   * @returns {Promise<string>} chip description, e.g. "ESP32-D0WD-V3 (revision v3.1)"
   */
  async connect(kind) {
    if (this.connected) return this.chip;
    if (this.simulate) {
      this.log('Connecting...');
      await sleep(700);
      this.log('Detecting chip type... ESP32');
      await sleep(500);
      this.chip = 'ESP32-D0WD-V3 (revision v3.1)';
      this.log(`Chip is ${this.chip}`);
      this.log('Uploading stub... Running stub...');
      await sleep(400);
      return this.chip;
    }

    // 1. Pick the port (user gesture). Canceling the picker throws a NotFoundError.
    if (kind === 'usb') this.port = await Ch34xPort.request();
    else {
      if (!navigator.serial) throw new Error(t('Web Serial isn’t available in this browser. Try the USB option.'));
      this.port = await navigator.serial.requestPort({ filters: [CH34X_FILTER] });
    }

    // 2. Load esptool-js lazily (only needed here) and sync with the chip's ROM loader.
    const { ESPLoader, Transport } = await import(ESPTOOL_URL);
    const terminal = { clean() {}, writeLine: (s) => this.log(s), write: (s) => this.log(s) };
    // Transport(device, tracing, enableSlipReader) — SLIP reader off, as in the standalone updater.
    this.transport = new Transport(this.port, TRACE, false);
    const loader = new ESPLoader({ transport: this.transport, baudrate: this.baud, terminal, enableTracing: false });
    try {
      this.chip = await loader.main();
    } catch (err) {
      await this.#release();
      throw err;
    }
    const name = loader.chip?.CHIP_NAME;
    if (name && name !== EXPECTED_CHIP) {
      await this.#release();
      throw new Error(t('This wireless module is an {chip}, but the HOJA baseband firmware is built for the {expected}. Nothing was written.', { chip: name, expected: EXPECTED_CHIP }));
    }
    this.loader = loader;
    return this.chip;
  }

  /** Erase the whole flash (the standalone updater's "Erase" button). Takes ~10–30 s. */
  async erase() {
    if (this.simulate) {
      this.log('Erasing flash (this may take a while)...');
      await sleep(2200);
      this.log('Chip erase completed successfully');
      return;
    }
    if (!this.loader) throw new Error(t('Not connected to the wireless module.'));
    await this.loader.eraseFlash();
  }

  /**
   * Write all images (the standalone updater's "Flash" button).
   * @param {Array<{name:string,address:number,data:string,size:number}>} images
   * @param {(percent:number, label:string)=>void} [onProgress] 0–100 across all files, weighted by size;
   *   label = the image's English label (translate with t())
   */
  async write(images, onProgress) {
    const total = images.reduce((n, img) => n + img.size, 0) || 1;
    const before = images.map((_, i) => images.slice(0, i).reduce((n, img) => n + img.size, 0));
    if (this.simulate) {
      for (const [i, img] of images.entries()) {
        this.log(`Writing ${img.name.toLowerCase()} at 0x${img.address.toString(16)}...`);
        const steps = Math.max(4, Math.round((img.size / total) * 40));
        for (let s = 1; s <= steps; s++) {
          await sleep(110);
          onProgress?.(((before[i] + (img.size * s) / steps) / total) * 100, img.label);
        }
        this.log(`Wrote ${img.size} bytes at 0x${img.address.toString(16)}.`);
      }
      this.log('Hash of data verified.');
      return;
    }
    if (!this.loader) throw new Error(t('Not connected to the wireless module.'));
    await this.loader.writeFlash({
      fileArray: images.map((img) => ({ data: img.data, address: img.address })),
      // 'keep' everywhere: write the images byte-for-byte (the standalone updater left mode/freq
      // unset, which esptool-js 0.4.3 also treats as "don't patch the bootloader header").
      flashSize: 'keep',
      flashMode: 'keep',
      flashFreq: 'keep',
      eraseAll: false,
      compress: true,
      reportProgress: (fileIndex, written, fileTotal) => {
        const img = images[fileIndex];
        const done = before[fileIndex] + (fileTotal ? (written / fileTotal) * img.size : 0);
        onProgress?.((done / total) * 100, img?.label || '');
      },
    });
  }

  /** Release the port. The controller stays in update mode until it is unplugged. */
  async close() {
    if (this.simulate) { this.chip = null; return; }
    await this.#release();
  }

  async #release() {
    const t = this.transport;
    this.loader = null;
    this.transport = null;
    this.port = null;
    if (t) { try { await t.disconnect(); } catch (err) { console.warn('[wireless] port close', err?.message || err); } }
  }
}
