/**
 * ch34x-webusb.js — A minimal Web Serial-shaped port for WCH CH34x USB-serial chips over WebUSB.
 *
 * Port of hoja_esptool/src/plugin/niceSerial.js (the "WebUSB" switch on the standalone HOJA
 * baseband updater). In update mode the controller's USB mux connects the port to a CH340 bridge
 * wired to the ESP32's UART. Desktop Chrome/Edge talk to it through Web Serial (navigator.serial)
 * using the OS driver; Android Chrome has no Web Serial, so this class drives the CH34x directly.
 *
 * It implements just enough of the Web Serial `SerialPort` interface for esptool-js's Transport:
 *   getInfo(), open(), close(), readable, writable, setSignals({ dataTerminalReady, requestToSend })
 *
 * Behavior is kept identical to the shipped niceSerial.js (vendor init sequence, fixed baud
 * registers, 32-byte OUT chunks, one-packet-per-pull reads), only cleaned up and commented.
 * Register values follow the Linux ch341 driver.
 */
import { t } from '../../i18n/index.js';

/** USB ids of the CH340 bridge used in HOJA controllers (same filter as the standalone updater). */
export const CH34X_FILTER = Object.freeze({ usbVendorId: 0x1a86, usbProductId: 0x7522 });

// Vendor requests (Linux ch341.c).
const CMD_W = 0x9a;  // write register(s)
const CMD_C1 = 0xa1; // serial init
const CMD_C2 = 0xa4; // modem control (DTR/RTS)

// Modem control output bits (active low on the wire; inverted in setControl()).
const CTO_D = 0x20; // DTR
const CTO_R = 0x40; // RTS

const MAX_OUT_CHUNK = 32;

/** Bulk-endpoint streams for a claimed CH34x interface. */
class Ch34xStreams {
  /** @param {USBDevice} usb */
  constructor(usb) {
    this.usb = usb;
    const endpoints = usb.configuration.interfaces[0].alternate.endpoints;
    this.epIn = endpoints.find((ep) => ep.direction === 'in' && ep.type === 'bulk');
    this.epOut = endpoints.find((ep) => ep.direction === 'out' && ep.type === 'bulk');
    this._writable = null;
    this._readable = null;
    this.reading = false;
    this.closed = false;
  }

  get writable() {
    if (this._writable) return this._writable;
    this._writable = new WritableStream({
      write: async (chunk) => {
        if (chunk.byteLength <= MAX_OUT_CHUNK) {
          await this.usb.transferOut(this.epOut.endpointNumber, chunk);
          return;
        }
        // Queue all 32-byte transfers at once; WebUSB keeps them in order on the endpoint.
        const pending = [];
        for (let pos = 0; pos < chunk.byteLength; pos += MAX_OUT_CHUNK) {
          pending.push(this.usb.transferOut(this.epOut.endpointNumber, chunk.subarray(pos, pos + MAX_OUT_CHUNK)));
        }
        await Promise.all(pending);
      },
      close: () => { this._writable = null; },
      abort: () => { this._writable = null; },
    });
    return this._writable;
  }

  get readable() {
    if (this._readable) return this._readable;
    this._readable = new ReadableStream({
      start: (controller) => {
        this.reading = true;
        this.closed = false;
        this.readLoop(controller);
      },
      // Each pull reads (at most) one USB packet, which gives the consumer natural back-pressure.
      pull: (controller) => {
        if (!this.reading) {
          this.reading = true;
          this.readLoop(controller);
        }
      },
      cancel: () => {
        this.reading = false;
        this.closed = true;
        this._readable = null;
      },
    });
    return this._readable;
  }

  async readLoop(controller) {
    while (this.reading && !this.closed) {
      try {
        const result = await this.usb.transferIn(this.epIn.endpointNumber, this.epIn.packetSize);
        if (result.data && result.data.byteLength > 0) {
          if (this.closed || controller.desiredSize <= 0) { this.reading = false; break; }
          controller.enqueue(new Uint8Array(result.data.buffer));
          this.reading = false;
          break;
        }
        if (result.status === 'stall') await this.usb.clearHalt('in', this.epIn.endpointNumber);
      } catch (err) {
        if (err?.name === 'NotFoundError') { // device unplugged
          this.closed = true;
          controller.close();
        } else {
          controller.error(err);
        }
        break;
      }
    }
  }
}

/** A Web Serial-like port backed by a CH34x over WebUSB. */
export class Ch34xPort {
  #ctrl = 0;
  #streams = null;
  /** @type {USBDevice|null} */
  usbDevice = null;

  /**
   * Pick (or reuse an already-authorized) CH34x and claim it. Must run from a user gesture
   * unless the device was authorized before.
   */
  static async request() {
    if (!navigator.usb) throw new Error(t('WebUSB is not available in this browser.'));
    const known = await navigator.usb.getDevices();
    let usb = known.find((d) => d.vendorId === CH34X_FILTER.usbVendorId);
    if (!usb) usb = await navigator.usb.requestDevice({ filters: [{ vendorId: CH34X_FILTER.usbVendorId }] });
    const port = new Ch34xPort();
    await port.#claim(usb);
    return port;
  }

  async #claim(usb) {
    this.usbDevice = usb;
    await usb.open();
    await usb.selectConfiguration(1);
    await usb.claimInterface(usb.configuration.interfaces[0].interfaceNumber);
  }

  async #controlOut(request, value, index) {
    try {
      await this.usbDevice.controlTransferOut({ requestType: 'vendor', recipient: 'device', request, value, index });
      return 0;
    } catch (err) {
      console.error('[ch34x] control transfer failed', err);
      return -1;
    }
  }

  #setControl(control) {
    return this.#controlOut(CMD_C2, ~control & 0xff, 0);
  }

  #setLine(bit, on) {
    const next = on ? (this.#ctrl | bit) : (this.#ctrl & ~bit & 0xff);
    if (next === this.#ctrl) return;
    this.#ctrl = next;
    // Not awaited, matching niceSerial.js — esptool-js sequences resets with its own sleeps.
    this.#setControl(this.#ctrl);
  }

  getInfo() {
    return { usbVendorId: this.usbDevice?.vendorId, usbProductId: this.usbDevice?.productId };
  }

  /** Initialize the bridge. The baud registers are fixed (the ESP32 ROM auto-bauds on sync). */
  async open() {
    if (!this.#streams) this.#streams = new Ch34xStreams(this.usbDevice);
    await this.#controlOut(CMD_C1, 0, 0);
    await this.#controlOut(CMD_W, 0x1312, 0xd982); // baud prescaler/divisor
    await this.#controlOut(CMD_W, 0x0f2c, 0x0007); // timeout
    await this.#controlOut(CMD_W, 0x2727, 0);      // hardware flow control off
  }

  async close() {
    const usb = this.usbDevice;
    this.usbDevice = null;
    this.#streams = null;
    if (usb) { try { await usb.close(); } catch { /* already gone */ } }
  }

  async forget() { /* nothing to forget: WebUSB permissions persist per origin */ }

  get readable() { return this.#streams?.readable ?? null; }
  get writable() { return this.#streams?.writable ?? null; }

  async getSignals() {
    return { dataCarrierDetect: false, clearToSend: false, ringIndicator: false, dataSetReady: false };
  }

  async setSignals(signals) {
    if (signals.dataTerminalReady !== undefined) this.#setLine(CTO_D, !!signals.dataTerminalReady);
    if (signals.requestToSend !== undefined) this.#setLine(CTO_R, !!signals.requestToSend);
  }

  async setLineCoding() { /* unused by esptool-js */ }
}
