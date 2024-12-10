export class RgbConfig {
    constructor(buffer) {
        // If no buffer is provided, create a new one
        this.buffer = buffer || new ArrayBuffer(RGB_CFB_SIZE);
        this.view = new DataView(this.buffer);
    }

    // Getter and setter for rgb_config_version
    get rgbConfigVersion() {
        return this.view.getUint8(0);
    }

    set rgbConfigVersion(value) {
        this.view.setUint8(0, value);
    }

    // Getter and setter for rgb_mode
    get rgbMode() {
        return this.view.getUint8(1);
    }

    set rgbMode(value) {
        this.view.setUint8(1, value);
    }

    // Getter and setter for rgb_speed_factor
    get rgbSpeedFactor() {
        return this.view.getUint8(2);
    }

    set rgbSpeedFactor(value) {
        this.view.setUint8(2, value);
    }

    // Getter and setter for rgb_colors (32 colors, 32-bit each)
    getRgbColor(index) {
        if (index < 0 || index >= 32) {
            throw new Error('Color index must be between 0 and 31');
        }
        return this.view.getUint32(3 + (index * 4), true); // true for little-endian
    }

    setRgbColor(index, color) {
        if (index < 0 || index >= 32) {
            throw new Error('Color index must be between 0 and 31');
        }
        this.view.setUint32(3 + (index * 4), color, true); // true for little-endian
    }

    // Method to get all RGB colors
    getAllRgbColors() {
        return Array.from({length: 32}, (_, i) => this.getRgbColor(i));
    }

    // Method to set all RGB colors
    setAllRgbColors(colorsArray) {
        if (colorsArray.length !== 32) {
            throw new Error('Must provide exactly 32 colors');
        }
        colorsArray.forEach((color, index) => this.setRgbColor(index, color));
    }

    // Method to get the entire configuration block
    getConfigurationBlock() {
        return new Uint8Array(this.buffer);
    }

    // Method to set the entire configuration block
    setConfigurationBlock(configBlock) {
        if (configBlock.length !== RGB_CFB_SIZE) {
            throw new Error(`Configuration block must be ${RGB_CFB_SIZE} bytes`);
        }
        new Uint8Array(this.buffer).set(configBlock);
    }
}

// You would need to define RGB_CFB_SIZE before creating this class
// For example:
// const RGB_CFB_SIZE = 64; // or whatever the actual size is