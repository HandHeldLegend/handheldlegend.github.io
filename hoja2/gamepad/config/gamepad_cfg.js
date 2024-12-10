export class GamepadConfig {
    constructor(buffer) {
        // If no buffer is provided, create a new one
        this.buffer = buffer || new ArrayBuffer(GAMEPAD_CFB_SIZE);
        this.view = new DataView(this.buffer);
    }

    // Getter and setter for gamepad_config_version
    get gamepadConfigVersion() {
        return this.view.getUint8(0);
    }

    set gamepadConfigVersion(value) {
        this.view.setUint8(0, value);
    }

    // Getter and setter for switch_mac_address
    get switchMacAddress() {
        const macAddress = new Uint8Array(this.buffer, 1, 6);
        return Array.from(macAddress);
    }

    set switchMacAddress(macAddressArray) {
        if (macAddressArray.length !== 6) {
            throw new Error('MAC address must be 6 bytes');
        }
        const macAddressView = new Uint8Array(this.buffer, 1, 6);
        macAddressView.set(macAddressArray);
    }

    // Getter and setter for gamepad_default_mode
    get gamepadDefaultMode() {
        return this.view.getUint8(7);
    }

    set gamepadDefaultMode(value) {
        this.view.setUint8(7, value);
    }

    // Getter and setter for sp_function_mode
    get spFunctionMode() {
        return this.view.getUint8(8);
    }

    set spFunctionMode(value) {
        this.view.setUint8(8, value);
    }

    // Getter and setter for dpad_socd_mode
    get dpadSocdMode() {
        return this.view.getUint8(9);
    }

    set dpadSocdMode(value) {
        this.view.setUint8(9, value);
    }

    // Method to get the entire configuration block
    getConfigurationBlock() {
        return new Uint8Array(this.buffer);
    }

    // Method to set the entire configuration block
    setConfigurationBlock(configBlock) {
        if (configBlock.length !== GAMEPAD_CFB_SIZE) {
            throw new Error(`Configuration block must be ${GAMEPAD_CFB_SIZE} bytes`);
        }
        new Uint8Array(this.buffer).set(configBlock);
    }
}

// You would need to define GAMEPAD_CFB_SIZE before creating this class
// For example:
const GAMEPAD_CFB_SIZE = 64; // assuming this is the total size