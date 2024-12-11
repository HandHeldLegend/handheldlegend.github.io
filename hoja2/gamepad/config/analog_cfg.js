// Analog Packed Distances Class
class AnalogPackedDistances {
    constructor(buffer) {
        this.buffer = buffer || new ArrayBuffer(130);
        this.view = new DataView(this.buffer);
    }

    get firstDistance() {
        return this.view.getInt32(0, true); // little-endian
    }

    set firstDistance(value) {
        this.view.setInt32(0, value, true);
    }

    getOffset(index) {
        if (index < 0 || index >= 63) {
            throw new Error('Offset index must be between 0 and 62');
        }
        return this.view.getInt16(4 + (index * 2), true);
    }

    setOffset(index, value) {
        if (index < 0 || index >= 63) {
            throw new Error('Offset index must be between 0 and 62');
        }
        this.view.setInt16(4 + (index * 2), value, true);
    }

    getAllOffsets() {
        return Array.from({length: 63}, (_, i) => this.getOffset(i));
    }

    setAllOffsets(offsetsArray) {
        if (offsetsArray.length !== 63) {
            throw new Error('Must provide exactly 63 offsets');
        }
        offsetsArray.forEach((offset, index) => this.setOffset(index, offset));
    }

    getBuffer() {
        return new Uint8Array(this.buffer);
    }
}

// Angle Map Class
class AngleMap {
    constructor(buffer) {
        this.buffer = buffer || new ArrayBuffer(12);
        this.view = new DataView(this.buffer);
    }

    get input() {
        return this.view.getFloat32(0, true);
    }

    set input(value) {
        this.view.setFloat32(0, value, true);
    }

    get output() {
        return this.view.getFloat32(4, true);
    }

    set output(value) {
        this.view.setFloat32(4, value, true);
    }

    get distance() {
        return this.view.getInt32(8, true);
    }

    set distance(value) {
        this.view.setInt32(8, value, true);
    }

    getBuffer() {
        return new Uint8Array(this.buffer);
    }
}

// Main Analog Configuration Class
export class AnalogConfig {
    constructor(buffer) {
        // If no buffer is provided, create a new one
        this.buffer = buffer || new ArrayBuffer(ANALOG_CFB_SIZE);
        this.view = new DataView(this.buffer);
    }

    // Analog Config Version
    get analogConfigVersion() {
        return this.view.getUint8(0);
    }

    set analogConfigVersion(value) {
        this.view.setUint8(0, value);
    }

    // Left X-axis methods (similar to previous implementation)
    get lxInvert() {
        const firstByte = this.view.getUint8(1);
        return (firstByte & 0x01) !== 0;
    }

    set lxInvert(value) {
        const currentByte = this.view.getUint8(1);
        const newByte = value 
            ? (currentByte | 0x01) 
            : (currentByte & 0xFE);
        this.view.setUint8(1, newByte);
    }

    get lxCenter() {
        const firstByte = this.view.getUint8(1);
        const secondByte = this.view.getUint8(2);
        return ((firstByte >>> 1) & 0x7F) | ((secondByte & 0x7F) << 7);
    }

    set lxCenter(value) {
        if (value < 0 || value > 0x7FFF) {
            throw new Error('LX center must be between 0 and 32767');
        }
        const firstByte = this.view.getUint8(1);
        const newFirstByte = (firstByte & 0x01) | ((value & 0x7F) << 1);
        this.view.setUint8(1, newFirstByte);
        this.view.setUint8(2, (value >>> 7) & 0x7F);
    }

    // (Other axis methods similar to previous implementation)
    // ... (ly, rx, ry invert and center methods)

    // Left Packed Distances
    getLeftPackedDistances() {
        const start = 9;
        const buffer = this.buffer.slice(start, start + 130);
        return new AnalogPackedDistances(buffer);
    }

    // Right Packed Distances
    getRightPackedDistances() {
        const start = 9 + 130;
        const buffer = this.buffer.slice(start, start + 130);
        return new AnalogPackedDistances(buffer);
    }

    // Left Angle Maps
    getLeftAngleMap(index) {
        if (index < 0 || index >= 16) {
            throw new Error('Left angle map index must be between 0 and 15');
        }
        const start = 9 + 260 + (index * 12);
        const buffer = this.buffer.slice(start, start + 12);
        return new AngleMap(buffer);
    }

    // Right Angle Maps
    getRightAngleMap(index) {
        if (index < 0 || index >= 16) {
            throw new Error('Right angle map index must be between 0 and 15');
        }
        const start = 9 + 260 + 192 + (index * 12);
        const buffer = this.buffer.slice(start, start + 12);
        return new AngleMap(buffer);
    }

    // Scaler Types
    get leftScalerType() {
        return this.view.getUint8(474);
    }

    set leftScalerType(value) {
        this.view.setUint8(474, value);
    }

    get rightScalerType() {
        return this.view.getUint8(475);
    }

    set rightScalerType(value) {
        this.view.setUint8(475, value);
    }

    // Method to get the entire configuration block
    getConfigurationBlock() {
        return new Uint8Array(this.buffer);
    }

    // Method to set the entire configuration block
    setConfigurationBlock(configBlock) {
        if (configBlock.length !== ANALOG_CFB_SIZE) {
            throw new Error(`Configuration block must be ${ANALOG_CFB_SIZE} bytes`);
        }
        new Uint8Array(this.buffer).set(configBlock);
    }
}

// You would need to define ANALOG_CFB_SIZE before creating this class
// For example:
// const ANALOG_CFB_SIZE = 512; // or whatever the actual size is