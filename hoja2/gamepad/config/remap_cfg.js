export class RemapConfig {
    constructor(buffer) {
        // If no buffer is provided, create a new one
        this.buffer = buffer || new ArrayBuffer(REMAP_CFB_SIZE);
        this.view = new DataView(this.buffer);
    }

    // Getter and setter for remap_config_version
    get remapConfigVersion() {
        return this.view.getUint8(0);
    }

    set remapConfigVersion(value) {
        this.view.setUint8(0, value);
    }

    // Getter and setter for profiles (12 profiles, 16-bit each)
    getProfile(index) {
        if (index < 0 || index >= 12) {
            throw new Error('Profile index must be between 0 and 11');
        }
        return this.view.getUint16(1 + (index * 2), true); // true for little-endian
    }

    setProfile(index, profile) {
        if (index < 0 || index >= 12) {
            throw new Error('Profile index must be between 0 and 11');
        }
        this.view.setUint16(1 + (index * 2), profile, true); // true for little-endian
    }

    // Get all profiles
    getAllProfiles() {
        return Array.from({length: 12}, (_, i) => this.getProfile(i));
    }

    // Set all profiles
    setAllProfiles(profilesArray) {
        if (profilesArray.length !== 12) {
            throw new Error('Must provide exactly 12 profiles');
        }
        profilesArray.forEach((profile, index) => this.setProfile(index, profile));
    }

    // Getter and setter for disabled options (12 disabled options, 16-bit each)
    getDisabledOption(index) {
        if (index < 0 || index >= 12) {
            throw new Error('Disabled option index must be between 0 and 11');
        }
        return this.view.getUint16(25 + (index * 2), true); // true for little-endian
    }

    setDisabledOption(index, disabledOption) {
        if (index < 0 || index >= 12) {
            throw new Error('Disabled option index must be between 0 and 11');
        }
        this.view.setUint16(25 + (index * 2), disabledOption, true); // true for little-endian
    }

    // Get all disabled options
    getAllDisabledOptions() {
        return Array.from({length: 12}, (_, i) => this.getDisabledOption(i));
    }

    // Set all disabled options
    setAllDisabledOptions(disabledOptionsArray) {
        if (disabledOptionsArray.length !== 12) {
            throw new Error('Must provide exactly 12 disabled options');
        }
        disabledOptionsArray.forEach((option, index) => this.setDisabledOption(index, option));
    }

    // Method to get the entire configuration block
    getConfigurationBlock() {
        return new Uint8Array(this.buffer);
    }

    // Method to set the entire configuration block
    setConfigurationBlock(configBlock) {
        if (configBlock.length !== REMAP_CFB_SIZE) {
            throw new Error(`Configuration block must be ${REMAP_CFB_SIZE} bytes`);
        }
        new Uint8Array(this.buffer).set(configBlock);
    }
}

// You would need to define REMAP_CFB_SIZE before creating this class
// For example:
// const REMAP_CFB_SIZE = 64; // or whatever the actual size is