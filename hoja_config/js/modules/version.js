var _fw_version = 0xFFFF;
var _baseband_version = 0xFFFF;
var _backend_version = 0xFFFF;
var _device_id = 0xFFFF;

let _firmwareButtonElement = document.getElementById("fwButtonInstall");
let _firmwareBoxElement = document.getElementById("ood");
let _basebandBoxElement = document.getElementById("baseband-box");
let _basebandButtonElement = document.getElementById("basebandButton");

// Resets HOJA device into baseband update mode
async function version_reset_to_baseband() {
    console.log("Resetting to BASEBAND.");
    var dataOut = new Uint8Array([WEBUSB_CMD_BB_SET]);
    await device.transferOut(2, dataOut);
}

function _version_baseband_enable_button(enable) {
    if (enable) {
        if (_basebandButtonElement.hasAttribute('disabled')) {
            _basebandButtonElement.setAttribute('disabled', 'false');
            _basebandButtonElement.removeAttribute('disabled');
        }

    }
    else _basebandButtonElement.setAttribute('disabled', 'true');
}

function _version_baseband_enable_notification(enable) {
    if (enable) {
        _basebandBoxElement.setAttribute("disabled", "false");
        _version_baseband_enable_button(true);
    }
    else {
        _basebandBoxElement.setAttribute("disabled", "true");
        _version_baseband_enable_button(false);
    }
}

function _version_firmware_enable_notification(enable, device_id, checksum) {
    // Remove all existing click event listeners
    const oldElement = _firmwareButtonElement.cloneNode(true);
    _firmwareButtonElement.parentNode.replaceChild(oldElement, _firmwareButtonElement);
    _firmwareButtonElement = oldElement;

    if (enable == true) {
        if (device_id == null) {
            console.error("Cannot enable firmware button with null device id");
            return;
        }

        let firmwareURL = FW_UPDATE_URLS[device_id];

        console.log("Enable FW Update box.");

        _firmwareButtonElement.addEventListener('click', async () => {
            pico_update_attempt_flash(firmwareURL, checksum);
        });

        _firmwareBoxElement.setAttribute("disabled", "false");
    }
    else {
        console.log("Disable FW Update box.");
        _firmwareBoxElement.setAttribute("disabled", "true");
    }
}

function _version_replace_strings(id, changelog) {
    console.log("Get changelog for " + id);
    var e = document.getElementById("fwChangeLog");
    e.innerHTML = changelog;
}

function _version_get_manifest_data(id) {
    if (!DEVICE_FW_MANIFEST_URLS[id]) {
        console.log("Invalid device ID.");
        offline_indicator_enable(true, "Invalid Device Error");
        return;
    }

    var jsonUrl = DEVICE_FW_MANIFEST_URLS[id];

    return fetch(jsonUrl)
        .then((response) => {
            if (!response.ok) {
                offline_indicator_enable(true, "Github Network Error");
                throw new Error(`Network response was not ok: ${response.status}`);
            }
            offline_indicator_enable(false);
            return response.json();
        })
        .catch((error) => {
            offline_indicator_enable(true, "JSON Parse Error");
            console.error('Error fetching and parsing JSON:', error);
        });
}

function _version_get_baseband_manifest_data() {
    var jsonUrl = DEVICE_BT_FW_MANIFEST_URL;

    return fetch(jsonUrl)
        .then((response) => {
            if (!response.ok) {
                offline_indicator_enable(true, "Github Network Error");
                throw new Error(`Network response was not ok: ${response.status}`);
            }
            offline_indicator_enable(false);
            return response.json();
        })
        .catch((error) => {
            offline_indicator_enable(true, "JSON Parse Error");
            console.error('Error fetching and parsing JSON:', error);
        });
}

function version_read_id() {
    return _device_id;
}

function version_read_fw() {
    return _fw_version;
}

function version_read_baseband() {
    return _baseband_version;
}

function version_read_backend() {
    return _backend_version;
}

function version_disable_notifications() {
    // _basebandBoxElement.setAttribute("disabled", "true");
    // _firmwareBoxElement.setAttribute("disabled", "true");
    _version_baseband_enable_button(false);
}

// Obtain firmware information about the device
async function version_get_value() {
    var dataOut = new Uint8Array([WEBUSB_CMD_FW_GET]);
    await device.transferOut(2, dataOut);
}

// Resets device into USB bootloader (RP2040)
async function version_reset_to_bootloader() {
    var dataOut = new Uint8Array([WEBUSB_CMD_FW_SET]);
    await device.transferOut(2, dataOut);
}

function _version_fw_is_up_to_date() {
    var to_return = false;

    if (_device_id != 0xFFFF) {

        if (network_is_available()) {
            _version_get_manifest_data(_device_id)
                .then((manifest) => {
                    _version_replace_strings(_device_id, manifest.changelog);

                    if (manifest.fw_version < _fw_version) {
                        console.log("Device firmware is newer than release.");
                        _version_firmware_enable_notification(false);
                    }
                    else if (manifest.fw_version == _fw_version) {
                        console.log("Device firmware is up to date.");
                        _version_firmware_enable_notification(false);
                    }
                    else {
                        console.log("Device firmware is out of date.");

                        _version_firmware_enable_notification(true, _device_id, manifest.checksum);
                    }

                    _version_baseband_is_up_to_date();
                    config_get_chain(WEBUSB_CMD_FW_GET);

                });


        }
        else {
            _version_firmware_enable_notification(false);
            _version_baseband_is_up_to_date();
            config_get_chain(WEBUSB_CMD_FW_GET);
        }
    }
}

function _version_baseband_is_up_to_date() {
    if (_baseband_version == 0xFFFE) {
        console.log("Baseband not initialized.");
        _version_baseband_enable_notification(true);
    }
    else if (_baseband_version != 0xFFFF || !_baseband_version) {
        if (network_is_available()) {
            _version_get_baseband_manifest_data()
                .then((manifest) => {
                    if (manifest.fw_version < _baseband_version) {
                        console.log("Device baseband is newer than release.");
                        _version_baseband_enable_notification(false);
                    }
                    else if (manifest.fw_version == _baseband_version) {
                        console.log("Device baseband is up to date.");
                        _version_baseband_enable_notification(false);
                    }
                    else {
                        console.log("Device baseband is out of date.");
                        _version_baseband_enable_notification(true);
                    }

                });
        }
        else {
            console.log("Network not available. Skipping Baseband checks.");
            _version_baseband_enable_notification(false);
        }
    }
    else {
        console.log("Baseband is unused with this device.");
        _version_baseband_enable_notification(false);
    }


}

function version_interpret_values_data(data) {
    _fw_version = (data.getUint8(1) << 8) | (data.getUint8(2));
    _device_id = (data.getUint8(3) << 8) | (data.getUint8(4));
    _backend_version = (data.getUint8(5) << 8) | (data.getUint8(6));
    _baseband_version = (data.getUint8(7) << 8) | (data.getUint8(8));
    _settings_version = (data.getUint8(9) << 8) | (data.getUint8(10));
    _settings_bank = (data.getUint8(11));

    console.log("Device ID: 0x" + _device_id.toString(16));
    console.log("FW Verson: 0x" + _fw_version.toString(16));
    console.log("HOJA Version: 0x" + _backend_version.toString(16));
    console.log("BT Baseband Version: 0x" + _baseband_version.toString(16));
    console.log("HOJA Settings Version: 0x" + _settings_version.toString(16));
    console.log("Settings Bank: " + ((!_settings_bank) ? "A" : "B"));

    _version_fw_is_up_to_date();
}