import { serial } from "./ch341polyfill";

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

class CH341SER {

    constructor() {

        this.epOut = null;
        this.epIn = null;
        this.epCmd = null;

        this.ctrlin = 0; /* input control lines (DCD, DSR, RI, break, overruns) */
        this.ctrlout = 0; /* output control lines (DTR, RTS) */

        this.clocal = false;
        this.hardflow = false;

        this.dtr = false;
        this.rts = false;
    }

    static async create() {
        const device = await CH341SER.requestDevice();
        const instance = new CH341SER(device);
        await instance.initialize();
        return instance;
    }

    static async requestDevice() {
        
        let device = devices.find(d => d.vendorId === 0x1a86);

        if (!device) {
            device = await navigator.usb.requestDevice({
                filters: [
                    { vendorId: 0x1a86 },  // CH34X
                ]
            });
        }

        return device;
    }

    async initialize() {
        console.log("ch341ser initialize");
        console.log(this.device);

        await this.device.open();
        await this.device.selectConfiguration(1);  // Assuming configuration 1

        const iface = this.device.configuration.interfaces[0];
        this.itf = iface.interfaceNumber;

        await this.device.claimInterface(this.itf);

        const endpoints = iface.alternate.endpoints;
        this.epIn = endpoints.find(ep => ep.direction === "in" && ep.type === "bulk");
        this.epInNum = this.epIn.endpointNumber;

        this.epOut = endpoints.find(ep => ep.direction === "out" && ep.type === "bulk");
        this.epOutNum = this.epOut.endpointNumber;

        this.epCmd = endpoints.find(ep => ep.type === "interrupt");
        this.epCmdNum = this.epCmd.endpointNumber;

        console.log(`Endpoints configured: in=${this.epInNum}, out=${this.epOutNum}, cmd=${this.epCmdNum}`);
    }

    

    async controlIn(request, value, index, bufferSize) {

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
            const result = await this.device.controlTransferIn(setup, bufferSize);

            if (result.status === 'ok') {
                // Return the received data
                return result.data;
            }
            else {
                console.error("Error reading ctrl IN");
                return result.data;
            }

        } finally {

        }
    }

    // Activate
    async configure() {
        console.log("ch341 configure");

        try {
            const buffer = new Uint8Array(2);

            // Equivalent to ch341_control_in
            await this.controlIn(CMD_C3, 0, 0, 2);

            await this.controlOut(CMD_C1, 0, 0);

            await this.controlOut(CMD_W, 0x1312, 0xD982);

            // NIL=NotInLinux Driver

            await this.controlIn(CMD_R, 0x2C2C, 0, 2); // nil

            await this.setTimeout(0); // await this.controlOut(CMD_W, 0x0f2c, 0x0007);

            // Read
            await this.controlIn(CMD_R, 0x2518, 0, 2);

            await this.getStatus(); // 0x0706

            await this.setHwFlow(false); // await this.controlOut(CMD_W, 0x2727, 0); same thing

            return true; // Success
        } catch (error) {
            console.error('Error in ch341Configure:', error);
            return false; // Failure
        }
    }

    getBaudFactors(baval) {
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

    invert8Bits(number) {
        // Ensure we're only working with the lowest 8 bits
        const lowest8Bits = number & 0xFF;

        // Invert these 8 bits
        const inverted = lowest8Bits ^ 0xFF;

        // Combine the inverted 8 bits with the original upper bits
        return (number & ~0xFF) | inverted;
    }

    async setControl(control) {
        let value = 0;
        value |= this.invert8Bits(control);
        console.log("Send CTRL: ", value.toString(16));
        await this.controlOut(CMD_C2, value, 0x0000);
    }

    //async setTermios(termiosSettings) {
    /**
         * Sets the line coding (baud rate, stop bits, parity, and data bits) for the CH341 device.
         * @param {SerialOptions} serialOptions - The person object.
         * @return {Promise<void>} A promise that resolves when the line coding has been set.
         */
    async setLineCoding(serialOptions) {

        console.log(serialOptions);

        let baudRate = serialOptions.baudRate;
        let dataBits = serialOptions.dataBits;
        let stopBits = serialOptions.stopBits;
        let flowControl = serialOptions.flowControl;
        let parity = serialOptions.parity;

        if (baudRate === 0) {
            baudRate = 9600;
        }

        let divisor = 0;
        let reg_count = 0;
        let factor = 0;
        let reg_value = 0;
        let value = 0;
        let index = 0;

        const fres = this.getBaudFactors(baudRate);
        divisor = fres.divisor;
        factor = fres.factor;

        // Set data bits
        switch (dataBits) {
            case 5: reg_value |= CH341_L_D5; break;
            case 6: reg_value |= CH341_L_D6; break;
            case 7: reg_value |= CH341_L_D7; break;
            case 8: default: reg_value |= CH341_L_D8; break;
        }

        // Set stop bits
        if (stopBits == 2) {
            reg_value |= 0x04;
        }

        // Set parity
        switch (parity) {
            case USB_CH341_ODD_PARITY: reg_value |= CH341_L_PO; break;
            case USB_CH341_EVEN_PARITY: reg_value |= CH341_L_PE; break;
            case USB_CH341_MARK_PARITY: reg_value |= CH341_L_PM; break;
            case USB_CH341_SPACE_PARITY: reg_value |= CH341_L_PS; break;
            default: break;  // No parity
        }

        // Prepare control messages
        reg_value |= 0xc0;
        reg_count |= 0x9C;

        value |= reg_count;
        value |= (reg_value << 8);

        index |= 0x80 | divisor;
        index |= (factor << 8);


        //await this.controlOut(CMD_C1, value, index);
        await this.controlOut(CMD_C1, 0xC39C, 0xD98A); // Hardcode because the math is wrong

        await this.controlIn(CMD_R, 0x2C2C, 0, 2); //nil

        await this.setTimeout(baudRate);

        let newctrl = this.ctrlout | CH341_CTO_D;

        if (newctrl != this.ctrlout) {
            this.ctrlout = newctrl;
            await this.setControl(newctrl);
        }

        newctrl = this.ctrlout | CH341_CTO_R;

        if (newctrl != this.ctrlout) {
            this.ctrlout = newctrl;
            await this.setControl(newctrl);
        }

        await this.getStatus(); // 0x0706 // nil

        // Set hardware flow not implemented
        // flowControl
        await this.setHwFlow(false);

        await this.controlOut(CMD_W, 0x1312, 0xCC83);

        await this.controlIn(CMD_R, 0x2C2C, 0, 2); //nil
        await this.getStatus(); // 0x0706 // nil

        await this.setHwFlow(false);
    }

    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Sets control signal state for the port.
     * @param {Object} signals The signals to enable or disable.
     * @param {boolean} [signals.dataTerminalReady] - The DTR signal.
     * @param {boolean} [signals.requestToSend] - The RTS signal.
     * @param {boolean} [signals.break] - The BREAK signal.
     * @return {Promise<void>} A promise that resolves when the signal state has been changed.
     */
    async setSignals(signals) {
        console.log(signals);

        let newctrl = this.ctrlout;

        let dtr = signals.dataTerminalReady;
        let rts = signals.requestToSend;

        if (signals.dataTerminalReady === undefined) {
            dtr = this.dtr;
        }

        if (signals.requestToSend === undefined) {
            rts = this.rts;
        }

        // Handle DTR
        if (this.dtr != dtr) {
            this.dtr = dtr;
            if (dtr) {
                newctrl &= (~CH341_CTO_D) & 0xFF;  // Clear bit (active low)
            } else {
                newctrl |= CH341_CTO_D;   // Set bit
            }
            changed = true;
        }

        // Handle RTS
        if (this.rts != rts) {
            this.rts = rts;
            if (rts) {
                newctrl &= (~CH341_CTO_R) & 0xFF;  // Clear bit (active low)
            } else {
                newctrl |= CH341_CTO_R;   // Set bit
            }
            changed = true;
        }


        // Handle BREAK (if implemented)
        if (signals.break !== undefined) {
            // Implement BREAK handling here if needed
            // This might involve setting/clearing a specific bit
            // changed = true;
        }

        if (changed) {
            this.ctrlout = newctrl;
            await this.setControl(newctrl);
        }
    }

    /**
     * Sets control hw flow state for the port.
     * @param {boolean} enable Enable or disable hw flow.
     * @return {Promise<void>} A promise that resolves when the hw flow state has been changed.
     */
    async setHwFlow(enable) {
        let enabled = false;

        if (enable == true) {
            enabled = true;
        }

        if (enable == 'hardware') {
            enabled = true;
        }

        if (enabled) {
            console.log("HW Flow Enable");
            this.hardflow = true;
            await this.controlOut(CMD_W, 0x2727, 0x0101);
        }
        else {
            console.log("HW Flow Disable");
            this.hardflow = false;
            await this.controlOut(CMD_W, 0x2727, 0x0000);
        }
    }

    async setTimeout(baudRate) {
        //if (baudRate == 'default') {
        await this.controlOut(CMD_W, 0x0F2C, 0x0007);
        return;
        //}

        if (!baudRate) {
            await this.controlOut(CMD_W, 0x0F2C, 0x0007);
            return;
        }

        let timeout = Math.ceil(76800 / baudRate);
        if (timeout < 7) {
            timeout = 7;
        }

        await this.controlOut(CMD_W, 0x0F2C, timeout);
    }

    async getStatus() {
        await this.controlIn(CMD_R, 0x0706, 0, 2);
    }
}

export { CH341SER };