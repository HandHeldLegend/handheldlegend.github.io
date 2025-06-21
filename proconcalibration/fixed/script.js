const SUBCMD_REPORT_MODE = 0x03;
const SUBCMD_SET_LED    = 0x30;
const SUBCMD_SPI_READ   = 0x10;

const REPLY_SUBCMD_IDX = 13;

const SPI_READ_ADDR_LOW_IDX = 14;
const SPI_READ_ADDR_HIGH_IDX = 15;
const SPI_READ_DATA_LEN_IDX = 18;
const SPI_READ_DATA_IDX = 19;

const ADDR_HI_FACTORY = 0x60;
const ADDR_LO_FACTORY_LEFT_ANALOG   = 0x3D;
const ADDR_LO_FACTORY_RIGHT_ANALOG  = 0x46;

const ADDR_HI_USER  = 0x80; 
const ADDR_LO_USER_LEFT_ANALOG      = 0x10; 
const ADDR_LO_USER_RIGHT_ANALOG     = 0x1B; 

class SwitchController {
    constructor() {
        this.gpn = 0; // Global Packet Number
        this.device = null;
        this.isConnected = false;
        this.factoryCalibration = {
            leftStick: { x: { center: 2048, max: 0, min: 0 }, y: { center: 2048, max: 0, min: 0 } },
            rightStick: { x: { center: 2048, max: 0, min: 0 }, y: { center: 2048, max: 0, min: 0 } }
        };
        this.userCalibration = {
            leftStick: { x: { center: 2048, max: 1700, min: 1700 }, y: { center: 2048, max: 1700, min: 1700 } },
            rightStick: { x: { center: 2048, max: 1700, min: 1700 }, y: { center: 2048, max: 1700, min: 1700 } }
        };
        this.useUserCalibration = false;
        this.setupEventListeners();
        this.spiInProgress = false; // Flag to prevent multiple SPI commands at once
        this.spiWaiters = [];
    }

    getAndIncrementGPN() {
        this.gpn = (this.gpn + 1) % 0xF; // Wrap around at 0xF
        return this.gpn;
    }

    setupEventListeners() {
        document.getElementById('connectBtn').addEventListener('click', () => this.connect());
        document.getElementById('disconnectBtn').addEventListener('click', () => this.disconnect());
        document.getElementById('calibrationToggle').addEventListener('click', () => this.toggleCalibration());
    }

    async connect() {
        try {
            this.updateStatus('Requesting device access...');
            
            const devices = await navigator.hid.requestDevice({
                filters: [
                    { vendorId: 0x057E, productId: 0x2006 }, // Joy-Con Left
                    { vendorId: 0x057E, productId: 0x2007 }, // Joy-Con Right  
                    { vendorId: 0x057E, productId: 0x2009 }, // Pro Controller
                    { vendorId: 0x057E, productId: 0x200E }  // Charging Grip
                ]
            });

            if (devices.length === 0) {
                throw new Error('No device selected');
            }

            this.device = devices[0];
            await this.device.open();
            

            this.device.addEventListener('inputreport', (event) => {
                this.processInputReport(event);
            });

            // Add disconnect listener
            navigator.hid.addEventListener('disconnect', (event) => {
                if (event.device === this.device) {
                    this.updateStatus('Device disconnected');
                    this.disconnect();
                }
            });
            
            this.isConnected = true;
            this.updateButtons();
            await this.setPlayerLeds(0x01); // Set all LEDs on for testing
            await this.sendReadFactoryCalibration();
            await this.sendReadUserCalibration();
            
        } catch (error) {
            this.updateStatus(`Connection failed: ${error.message}`);
            console.error('Connection error:', error);
        }
    }

    async disconnect() {
        if (this.device) {
            await this.device.close();
            this.device = null;
        }
        this.isConnected = false;
        this.updateButtons();
        this.updateStatus('Disconnected');
    }

    async sendReadFactoryCalibration() {
        if (!this.device.open) {
            this.updateStatus('Device not connected!');
            return;
        }
        
        // Read factory calibration data for left and right analog sticks
        await this.readSPI(ADDR_HI_FACTORY, ADDR_LO_FACTORY_LEFT_ANALOG, 9);
        await this.readSPI(ADDR_HI_FACTORY, ADDR_LO_FACTORY_RIGHT_ANALOG, 9);
    }

    async sendReadUserCalibration() {
        if (!this.device.open) {
            this.updateStatus('Device not connected!');
            return;
        }
        
        // Read user calibration data for left and right analog sticks
        await this.readSPI(ADDR_HI_USER, ADDR_LO_USER_LEFT_ANALOG, 11);
        await this.readSPI(ADDR_HI_USER, ADDR_LO_USER_RIGHT_ANALOG, 11);
    }

    clearSPIFlag() {
        this.spiInProgress = false;
        // Wake up any waiting operations
        this.spiWaiters.forEach(resolve => resolve());
        this.spiWaiters = [];
    }

    async readSPI(addressUpper, addressLower, length) {
        // Wait for any ongoing SPI operation to complete
        while (this.spiInProgress) {
            await new Promise(resolve => this.spiWaiters.push(resolve));
        }

        this.spiInProgress = true; // Set flag to prevent concurrent SPI commands


            // SPI flash read command format: [0x01, 0x10, addr_low, addr_high, 0x00, 0x00, length]
            const command = new Uint8Array([
                this.getAndIncrementGPN(),
                0,0,0,0,0,0,0,0,
                SUBCMD_SPI_READ,
                addressLower & 0xFF, // Lower byte of address
                addressUpper & 0xFF, // Upper byte of address
                0x00, // Padding byte
                0x00, // Padding byte
                length // Length of data to read
            ]);
            
            return await this.device.sendReport(0x01, command);

    }

    parseFactoryCalibrationData(leftRight, spiData)
    {
        if (leftRight === 'left') {
            this.factoryCalibration.leftStick.x.max = ((spiData[1] << 8) & 0xF00) | spiData[0];
            this.factoryCalibration.leftStick.y.max = (spiData[2] << 4) | (spiData[1] >> 4);

            this.factoryCalibration.leftStick.x.center = ((spiData[4] << 8) & 0xF00) | spiData[3];
            this.factoryCalibration.leftStick.y.center = (spiData[5] << 4) | (spiData[4] >> 4);

            this.factoryCalibration.leftStick.x.min = ((spiData[7] << 8) & 0xF00) | spiData[6];
            this.factoryCalibration.leftStick.y.min = (spiData[8] << 4) | (spiData[7] >> 4);

            console.log('Parsed factory left stick calibration:', this.factoryCalibration.leftStick);
        } else if (leftRight === 'right') {

            // Max and center are swapped here as well.
            this.factoryCalibration.rightStick.x.center = ((spiData[1] << 8) & 0xF00) | spiData[0];
            this.factoryCalibration.rightStick.y.center = (spiData[2] << 4) | (spiData[1] >> 4);

            this.factoryCalibration.rightStick.x.max = ((spiData[4] << 8) & 0xF00) | spiData[3];
            this.factoryCalibration.rightStick.y.max = (spiData[5] << 4) | (spiData[4] >> 4);

            this.factoryCalibration.rightStick.x.min = ((spiData[7] << 8) & 0xF00) | spiData[6];
            this.factoryCalibration.rightStick.y.min = (spiData[8] << 4) | (spiData[7] >> 4);

            console.log('Parsed factory right stick calibration:', this.factoryCalibration.rightStick);
        } else {
            console.error('Invalid stick type for calibration:', leftRight);
            return;
        }

        this.updateCalibrationDisplay();
    }

    parseUserCalibrationData(leftRight, spiData) {
        if (leftRight === 'left') {
            if(spiData[0] == 0xB2 && spiData[1] == 0xA1)
            {
                this.userCalibration.leftStick.x.max = ((spiData[1+2] << 8) & 0xF00) | spiData[0+2];
                this.userCalibration.leftStick.y.max = (spiData[2+2] << 4) | (spiData[1+2] >> 4);

                this.userCalibration.leftStick.x.center = ((spiData[4+2] << 8) & 0xF00) | spiData[3+2];
                this.userCalibration.leftStick.y.center = (spiData[5+2] << 4) | (spiData[4+2] >> 4);

                this.userCalibration.leftStick.x.min = ((spiData[7+2] << 8) & 0xF00) | spiData[6+2];
                this.userCalibration.leftStick.y.min = (spiData[8+2] << 4) | (spiData[7+2] >> 4);

                console.log('Parsed user left stick calibration:', this.userCalibration.leftStick);
            }
            else {
                console.error('User left calibration is unused');
            }
        } else if (leftRight === 'right') {
            if(spiData[0] == 0xB2 && spiData[1] == 0xA1)
            {

                this.userCalibration.rightStick.x.center = ((spiData[1+2] << 8) & 0xF00) | spiData[0+2];
                this.userCalibration.rightStick.y.center = (spiData[2+2] << 4) | (spiData[1+2] >> 4);

                // Max and center are swapped for the right stick! This was incorrect previously.
                this.userCalibration.rightStick.x.max = ((spiData[4+2] << 8) & 0xF00) | spiData[3+2];
                this.userCalibration.rightStick.y.max = (spiData[5+2] << 4) | (spiData[4+2] >> 4);

                this.userCalibration.rightStick.x.min = ((spiData[7+2] << 8) & 0xF00) | spiData[6+2];
                this.userCalibration.rightStick.y.min = (spiData[8+2] << 4) | (spiData[7+2] >> 4);

                console.log('Parsed user right stick calibration:', this.userCalibration.rightStick);
            }
            else {
                console.error('User right calibration is unused');
            }
        } else {
            console.error('Invalid stick type for calibration:', leftRight);
        }

        this.updateCalibrationDisplay();
    }

    readSPIResponse(addressUpper, addressLower, length, spiData) {
        this.clearSPIFlag();

        switch(addressUpper) {
            // Debug print for factory calibration
            case ADDR_HI_FACTORY:
                if(addressLower === ADDR_LO_FACTORY_LEFT_ANALOG) {
                    this.parseFactoryCalibrationData('left', spiData);
                }
                else if(addressLower === ADDR_LO_FACTORY_RIGHT_ANALOG) {
                    this.parseFactoryCalibrationData('right', spiData);
                }
                break;

            // Debug print for user calibration
            case ADDR_HI_USER:
                if(addressLower === ADDR_LO_USER_LEFT_ANALOG) {
                    this.parseUserCalibrationData('left', spiData);
                }
                else if(addressLower === ADDR_LO_USER_RIGHT_ANALOG) {
                    this.parseUserCalibrationData('right', spiData);
                }
                break;
        }
    }

    async setPlayerLeds(leds) {
        if (!this.device.open) {
            this.updateStatus('Device not connected!');
            return;
        }
        
        // Convert LED states to byte
        let ledByte = leds & 0x0F;
        
        // Send command to set player LEDs
        const command = new Uint8Array(
            [this.getAndIncrementGPN(), 
                0,0,0,0,0,0,0,0,
                SUBCMD_SET_LED, ledByte]);
        
        console.log('Setting player LEDs');
        await this.device.sendReport(0x01, command);
        this.updateStatus('Player LEDs set.');
    }

    async initInputMode() {
        if (!this.device.open) 
        {
            this.updateStatus('Device not connected!');
            return;
        }
        
        // Send command to initialize input mode
        const initCommand = new Uint8Array(
            [this.getAndIncrementGPN(), 
                0,0,0,0,0,0,0,0,
                SUBCMD_REPORT_MODE, 0x30
            ]); // Example command

            console.log('Sending input mode init command:', initCommand);
        
        await this.device.sendReport(0x01, initCommand);
        this.updateStatus('Input mode init sent.');
    }

    processFullInputReport(stickData) {

        let rawLeftX = stickData[0] | ( (stickData[1] & 0x0F) << 8);
        let rawLeftY = (stickData[1] >> 4) | (stickData[2] << 4);
        let rawRightX = stickData[3] | ( (stickData[4] & 0x0F) << 8);
        let rawRightY = (stickData[4] >> 4) | (stickData[5] << 4);
        
        this.updateJoystickDisplay('left', rawLeftX, rawLeftY);
        this.updateJoystickDisplay('right', rawRightX, rawRightY);
    }

    processInputReport(e) {
        
        const {data, device, reportId } = e;

        let command = data.getUint8(13);

        switch(reportId) {
            default:
            break;

            // Command response with input data
            case 0x21:
                if(command == SUBCMD_SPI_READ)
                {
                    console.log('Received SPI read response');
                    const addressUpper = data.getUint8(SPI_READ_ADDR_HIGH_IDX);
                    const addressLower = data.getUint8(SPI_READ_ADDR_LOW_IDX);
                    const length = data.getUint8(SPI_READ_DATA_LEN_IDX);
                    const fullData = new Uint8Array(data.buffer, SPI_READ_DATA_IDX, length);
                    this.readSPIResponse(addressUpper, addressLower, length, fullData);
                }

            break;

            // Standard full input report
            case 0x30:
                const stickData = new Uint8Array(data.buffer, 5, 6); // Assuming first 6 bytes are stick data
                this.processFullInputReport(stickData);
            break;
        }
    }

    updateJoystickDisplay(stick, rawX, rawY) {
        const calibration = this.useUserCalibration ? this.userCalibration : this.factoryCalibration;
        const stickCal = calibration[stick + 'Stick'];
        
        // Apply calibration
        const calX = this.applyCalibration(rawX, stickCal.x);
        const calY = this.applyCalibration(rawY, stickCal.y);
        
        // Update raw values display
        document.getElementById(stick + 'RawX').textContent = rawX;
        document.getElementById(stick + 'RawY').textContent = rawY;
        
        // Update calibrated values display
        document.getElementById(stick + 'CalX').textContent = calX.toFixed(2);
        document.getElementById(stick + 'CalY').textContent = calY.toFixed(2);
        
        // Update visual dots
        const container = document.getElementById(stick + 'Stick');
        const size = 200;
        
        // Raw dot position (map 0-4095 to 0-200)
        const rawDotX = (rawX / 4095) * size;
        const rawDotY = size - (rawY / 4095) * size; // Invert Y
        
        // Calibrated dot position (map -1 to 1 to 0-200)
        const calDotX = ((calX + 1) / 2) * size;
        const calDotY = size - ((calY + 1) / 2) * size; // Invert Y
        
        document.getElementById(stick + 'RawDot').style.left = rawDotX + 'px';
        document.getElementById(stick + 'RawDot').style.top = rawDotY + 'px';
        
        document.getElementById(stick + 'CalibratedDot').style.left = calDotX + 'px';
        document.getElementById(stick + 'CalibratedDot').style.top = calDotY + 'px';
    }

    applyCalibration(rawValue, axisCalibration) {
        const { center, max, min } = axisCalibration;
        
        if (rawValue >= center) {
            
            // Above center, scale to 0-1
            return Math.min(1.0, (rawValue - center) / max);
        } else {
            // Below center, scale to -1-0
            return Math.max(-1.0, -(center - rawValue) / min);
        }
    }

    toggleCalibration() {
        this.useUserCalibration = !this.useUserCalibration;
        const toggle = document.getElementById('calibrationToggle');
        toggle.classList.toggle('active', this.useUserCalibration);
        
        document.getElementById('calibrationType').textContent = 
            this.useUserCalibration ? 'User' : 'Factory';
            
        this.updateCalibrationDisplay();
    }

    updateCalibrationDisplay() {
        const calibration = this.useUserCalibration ? this.userCalibration : this.factoryCalibration;
        
        // Left stick
        document.getElementById('leftXCenter').textContent = calibration.leftStick.x.center;
        document.getElementById('leftXMax').textContent = calibration.leftStick.x.max;
        document.getElementById('leftXMin').textContent = calibration.leftStick.x.min;
        
        document.getElementById('leftYCenter').textContent = calibration.leftStick.y.center;
        document.getElementById('leftYMax').textContent = calibration.leftStick.y.max;
        document.getElementById('leftYMin').textContent = calibration.leftStick.y.min;
        
        // Right stick
        document.getElementById('rightXCenter').textContent = calibration.rightStick.x.center;
        document.getElementById('rightXMax').textContent = calibration.rightStick.x.max;
        document.getElementById('rightXMin').textContent = calibration.rightStick.x.min;
        
        document.getElementById('rightYCenter').textContent = calibration.rightStick.y.center;
        document.getElementById('rightYMax').textContent = calibration.rightStick.y.max;
        document.getElementById('rightYMin').textContent = calibration.rightStick.y.min;
    }

    updateButtons() {
        document.getElementById('connectBtn').disabled = this.isConnected;
        document.getElementById('disconnectBtn').disabled = !this.isConnected;
    }

    updateStatus(message) {
        document.getElementById('status').textContent = message;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize the controller when the page loads
if ('hid' in navigator) {
    const controller = new SwitchController();
} else {
    document.getElementById('status').textContent = 
        'WebHID is not supported in this browser. Please use Chrome, Edge, or Opera.';
}