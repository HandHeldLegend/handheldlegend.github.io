// Baud rate and default timeout
const DEFAULT_BAUD_RATE = 9600;
const DEFAULT_TIMEOUT = 2000;

// Major and minor numbers.
const CH341_TTY_MAJOR = 169;
const CH341_TTY_MINORS = 256;

// Requests.
const USB_RT_CH341 = 0x21; // (USB_TYPE_CLASS | USB_RECIP_INTERFACE)

const CMD_R = 0x95;     // 149
const CMD_W = 0x9A;     // 154
const CMD_C1 = 0xA1;    // 161
const CMD_C2 = 0xA4;    // 164
const CMD_C3 = 0x5F;    // 95

const CH341_CTO_O = 0x10;
const CH341_CTO_D = 0x20;
const CH341_CTO_R = 0x40;

const CH341_CTI_C = 0x01;
const CH341_CTI_DS = 0x02;

const CH341_CTRL_RI = 0x04;

const CH341_CTI_DC = 0x08;
const CH341_CTI_ST = 0x0f;

const CH341_CTT_M = 1 << 3;
const CH341_CTT_F = (1 << 2) | (1 << 6);
const CH341_CTT_P = 1 << 2;
const CH341_CTT_O = 1 << 1;

const CH341_L_ER = 0x80;
const CH341_L_ET = 0x40;
const CH341_L_PS = 0x38;
const CH341_L_PM = 0x28;
const CH341_L_PE = 0x18;
const CH341_L_PO = 0x08;
const CH341_L_SB = 0x04;
const CH341_L_D8 = 0x03;
const CH341_L_D7 = 0x02;
const CH341_L_D6 = 0x01;
const CH341_L_D5 = 0x00;

const CH341_RB = 0x05;
const CH341_RL = 0x18;
const CH341_NB = 0x01;
const CH341_NW = 2;
const CH341_NR = 2;

// USB_CH341 line coding constants
const USB_CH341_1_STOP_BITS = 0;
const USB_CH341_1_5_STOP_BITS = 1;
const USB_CH341_2_STOP_BITS = 2;
const USB_CH341_NO_PARITY = 0;
const USB_CH341_ODD_PARITY = 1;
const USB_CH341_EVEN_PARITY = 2;
const USB_CH341_MARK_PARITY = 3;
const USB_CH341_SPACE_PARITY = 4;

// Constants describing various quirks and errors
const NO_UNION_NORMAL = 1 << 0;
const SINGLE_RX_URB = 1 << 1;
const NO_CAP_LINE = 1 << 2;
const NO_DATA_INTERFACE = 1 << 4;
const IGNORE_DEVICE = 1 << 5;
const QUIRK_CONTROL_LINE_STATE = 1 << 6;
const CLEAR_HALT_CONDITIONS = 1 << 7;

class NiceReader {
    constructor(usbDevice) {
        this.usbDevice = usbDevice;
        console.log(this.usbDevice);

        const iface = this.usbDevice.configuration.interfaces[0];
        const endpoints = iface.alternate.endpoints;
        this.epIn = endpoints.find(ep => ep.direction === "in" && ep.type === "bulk");
        this.epInNum = this.epIn.endpointNumber;

        this.epOut = endpoints.find(ep => ep.direction === "out" && ep.type === "bulk");
        this.epOutNum = this.epOut.endpointNumber;

        this.maxChunkSize = 32;

        this.epCmd = endpoints.find(ep => ep.type === "interrupt");
        this.epCmdNum = this.epCmd.endpointNumber;

        this._writableStream = null;
        this._readableStream = null;
        this.reading = false;
        this.streamClosed = false;

        console.log("epIn", this.epIn);
        console.log("epOut", this.epOut);
    }

    get writable() {
        if (this._writableStream) {
            return this._writableStream;
        }

        this._writableStream = new WritableStream({
            start: async (controller) => {
                console.log("Writer started");
            },

            write: async (chunk, controller) => {
                console.log("Write chunk of ", chunk.byteLength, " bytes");

                if(chunk.byteLength <= this.maxChunkSize)
                {
                    await this.usbDevice.transferOut(this.epOut.endpointNumber, chunk);
                }
                else
                {
                    let i = 0;
                    let pendingTransfers = [];
                    let remainingBytes = chunk.byteLength;
                    while(remainingBytes > 0)
                    {
                        const nchunk = chunk.subarray(
                            i * this.maxChunkSize,
                            (i + 1) * this.maxChunkSize
                        );

                        pendingTransfers.push(this.usbDevice.transferOut(this.epOut.endpointNumber, nchunk));
                        remainingBytes -= nchunk.byteLength;
                        i++
                    }
                    
                    await Promise.all(pendingTransfers);
                }

                
            },

            close: async (controller) => {
                this._writableStream = null;
            },

            abort: async (reason) => {
                console.error('Stream aborted', reason);
                this._writableStream = null;
            }
        });

        return this._writableStream;
    }

    get readable() {
        if (this._readableStream) {
            return this._readableStream;
        }

        this._readableStream = new ReadableStream({
            start: (controller) => {
                this.reading = true;
                this.streamClosed = false;
                this.readLoop(controller);
            },
            pull: async (controller) => {
                // This method is called when the consumer is ready to receive more data
                if (!this.reading) {
                    this.reading = true;
                    this.readLoop(controller);
                }
            },
            cancel: (reason) => {
                console.log('Stream cancelled:', reason);
                this.reading = false;
                this.streamClosed = true;
                this._readableStream = null;
            }
        });

        return this._readableStream;
    }

    async readLoop(controller) {
        while (this.reading && !this.streamClosed) {
            try {
                const result = await this.usbDevice.transferIn(this.epIn.endpointNumber, this.epIn.packetSize);

                if (result.data && result.data.byteLength > 0) {

                    if (this.streamClosed || controller.desiredSize <= 0) {
                        console.log("Stream closed or backpressure, stopping enqueue.");
                        this.reading = false;
                        break;
                    }

                    const data = new Uint8Array(result.data.buffer);
                    controller.enqueue(data);
                    this.reading = false;
                    break;
                }

                if (result.status === 'stall') {
                    console.log('Endpoint stalled. Clearing halt condition.');
                    await this.usbDevice.clearHalt('in', this.epIn.endpointNumber);
                }

                console.log('Transfer status:', result.status);
            } catch (error) {
                if (error.name === 'NotFoundError') {
                    this.streamClosed = true;
                    controller.close();
                } else {
                    console.error('Error reading from device:', error);
                    controller.error(error);
                }
                break;
            }
        }
        console.log("Stopped reading");
    }
}

export class NiceSerial {
    async requestPort(options) {
        console.log("requestPort");
        console.log(options);
        const newPort = new SerialPort();
        await newPort.getPort();

        return newPort;
    }
}

export class SerialPort {

    #ctrlout = 0;
    #reader = null;

    constructor() {

        this.usbDevice = null;
        this.itf = null;
        this.outEp = null;
        this.inEp = null;
        this.cmdEp = null;

        this.#reader = null;
        this.#ctrlout = 0;
    }

    async #controlOut(request, value, index) {
        try {
            // Set up the control transfer parameters
            const setup = {
                requestType: 'vendor',
                recipient: 'device',
                request: request,
                value: value,
                index: index
            };

            // Perform the control transfer
            await this.usbDevice.controlTransferOut(setup);

            // If we reach here, the transfer was successful
            return 0;
        } catch (error) {
            console.error('Control transfer failed:', error);
            return -1; // Return a negative value to indicate an error
        } finally {
        }
    }

    async #setControl(control) {
        let value = 0;
        value |= (~control & 0xFF);
        await this.#controlOut(CMD_C2, value, 0x0000);
    }

    async #deviceInit()
    {

        if(!this.#reader)
        {
            this.#reader = new NiceReader(this.usbDevice, this.inEp, this.outEp);
        }

        await this.#controlOut(CMD_C1, 0, 0);
        await this.#controlOut(CMD_W, 0x1312, 0xD982);
        await this.#controlOut(CMD_W, 0x0f2c, 0x0007); // Timeout
        await this.#controlOut(CMD_W, 0x2727, 0); // HW Flow off
    }

    async #setRTS(raise, clear)
    {

        let newctrl = this.#ctrlout;

        if(raise)
        {
            newctrl |= CH341_CTO_R;   // Set bit
        }

        if(clear)
        {
            newctrl &= (~CH341_CTO_R) & 0xFF;  // Clear bit (active low)
        }

        if(this.#ctrlout != newctrl)
        {
            this.#ctrlout = newctrl;
            this.#setControl(this.#ctrlout);
        }
    }

    async #setDTR(raise, clear)
    {
        let newctrl = this.#ctrlout;

        if(raise)
        {
            newctrl |= CH341_CTO_D;   // Set bit
        }

        if(clear)
        {
            newctrl &= (~CH341_CTO_D) & 0xFF;  // Clear bit (active low)
        }

        if(this.#ctrlout != newctrl)
        {
            this.#ctrlout = newctrl;
            this.#setControl(this.#ctrlout);
        }
    }

    #getBaudFactors(baval) {
        let a, b, c;

        switch (baval) {
            case 921600:
                a = 0xf3;
                b = 7;
                break;
            case 307200:
                a = 0xd9;
                b = 7;
                break;
            default:
                if (baval > 6000000 / 255) {
                    b = 3;
                    c = 6000000;
                } else if (baval > 750000 / 255) {
                    b = 2;
                    c = 750000;
                } else if (baval > 93750 / 255) {
                    b = 1;
                    c = 93750;
                } else {
                    b = 0;
                    c = 11719;
                }
                a = Math.floor(c / baval);
                if (a === 0 || a === 0xFF) {
                    throw new Error("Invalid baud rate");
                }
                if ((c / a - baval) > (baval - c / (a + 1))) {
                    a++;
                }
                a = 256 - a;
                break;
        }

        return { factor: a, divisor: b };
    }

    #delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
      }

    getInfo() {
        return {
            usbVendorId: this.usbDevice.vendorId,
            usbProductId: this.usbDevice.productId,
        };
    }

    async getPort()
    {
        const filters = [{ usbVendorId: 0x1A86, usbProductId: 0x7522 }];

        const devices = await navigator.usb.getDevices();

        let device = devices.find(d => d.vendorId === 0x1A86);

        if (!device) {
            device = await navigator.usb.requestDevice({
                filters: [
                    { vendorId: 0x1A86 },  // CH34X
                ]
            });
        }

        this.usbDevice = device;

        await this.usbDevice.open();
        await this.usbDevice.selectConfiguration(1);

        const iface = this.usbDevice.configuration.interfaces[0];
        this.itf = iface.interfaceNumber;

        await this.usbDevice.claimInterface(this.itf);

        const endpoints = iface.alternate.endpoints;
        this.epIn = endpoints.find(ep => ep.direction === "in" && ep.type === "bulk");
        this.epInNum = this.epIn.endpointNumber;

        this.epOut = endpoints.find(ep => ep.direction === "out" && ep.type === "bulk");
        this.epOutNum = this.epOut.endpointNumber;

        this.epCmd = endpoints.find(ep => ep.type === "interrupt");
        this.epCmdNum = this.epCmd.endpointNumber;

        console.log(`Endpoints configured: in=${this.epInNum}, out=${this.epOutNum}, cmd=${this.epCmdNum}`);
    }

    async open(options) {
        console.log("open USB device");

        if(this.usbDevice !== null)
        {
            console.log("Already open")
        }

        await this.#deviceInit();

        console.log(options);
    }

    async close() {
        console.log("close USB device");
        await this.usbDevice.close();
        this.usbDevice = null;
    }

    async forget() {
        console.log("forget");
    }

    get readable() {
        //console.log("readable");
        return this.#reader.readable;
    }

    get writable() {
        //console.log("writable");
        return this.#reader.writable;
    }

    async getSignals() {
        //console.log("getSignals");
        const res = await this.port.getSignals();
        //console.log(res);
        return res;
    }

    async setSignals(signals) {
        //await this.delay(100);

        if(signals.dataTerminalReady !== undefined)
        {
            if(signals.dataTerminalReady)
            {
                await this.#setDTR(true, false);
            }
            else
            {
                await this.#setDTR(false, true);
            }
        }

        if(signals.requestToSend !== undefined)
        {
            if(signals.requestToSend)
            {
                await this.#setRTS(true, false);
            }
            else
            {
                await this.#setRTS(false, true);
            }
        }

    }

    async setLineCoding() {
        console.log("Unused setLineCoding");
    }
}

/* an object to be used for starting the serial workflow */
export const serial = new NiceSerial();