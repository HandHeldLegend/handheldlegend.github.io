var _fw_version = 0xFFFF;
var _baseband_version = 0xFFFF;
var _backend_version = 0xFFFF;
var _device_id = 0xFFFF;

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
        if(_basebandButtonElement.hasAttribute('disabled'))
        {
            _basebandButtonElement.setAttribute('disabled', 'false');
            _basebandButtonElement.removeAttribute('disabled');
        }
        
    }
    else _basebandButtonElement.setAttribute('disabled', 'true');
}

function _version_baseband_enable_notification(enable)
{
    if(enable)
    {
        _basebandBoxElement.setAttribute("disabled", "false");
        _version_baseband_enable_button(true);
    }
    else
    {
        _basebandBoxElement.setAttribute("disabled", "true");
        _version_baseband_enable_button(false);
    }
}

function _version_firmware_enable_notification(enable)
{
    if(enable==true)
    {
        console.log("Enable FW Update box.");
        _firmwareBoxElement.setAttribute("disabled", "false");
    }
    else
    {
        console.log("Disable FW Update box.");
        _firmwareBoxElement.setAttribute("disabled", "true");
    }
}

function _version_replace_strings(id, changelog)
{
    console.log("Get changelog for " + id);
    var e = document.getElementById("fwChangeLog");
    e.innerHTML = changelog;

    var f = document.getElementById("downloadLink");
    f.setAttribute('href', FW_UPDATE_URLS[id]);
}

function _version_get_manifest_data(id)
{
    if(!DEVICE_FW_MANIFEST_URLS[id])
    {
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

function version_read_id()
{
    return _device_id;
}

function version_read_fw()
{
    return _fw_version;
}

function version_read_baseband()
{
    return _baseband_version;
}

function version_read_backend()
{
    return _backend_version;
}

function version_disable_notifications()
{
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


function _version_fw_is_up_to_date()
{
    var to_return = false;

    if(_device_id != 0xFFFF)
    {
        
        if(network_is_available())
        {
            _version_get_manifest_data(_device_id)
            .then((manifest) => {
                _version_replace_strings(_device_id, manifest.changelog);

                if (manifest.fw_version < _fw_version)
                {
                    console.log("Device firmware is newer than release.");
                    _version_firmware_enable_notification(false);
                }
                else if (manifest.fw_version == _fw_version)
                {
                    console.log("Device firmware is up to date.");
                    _version_firmware_enable_notification(false);
                }
                else 
                {
                    console.log("Device firmware is out of date.");
                    _version_firmware_enable_notification(true);
                }

                _version_baseband_is_up_to_date();
                config_get_chain(WEBUSB_CMD_FW_GET);

            });

            
        }
        else 
        {
            _version_firmware_enable_notification(false);
            _version_baseband_is_up_to_date();
            config_get_chain(WEBUSB_CMD_FW_GET);
        }
    }
}

function _version_baseband_is_up_to_date()
{
    if(_baseband_version == 0xFFFE)
    {
        console.log("Baseband not initialized.");
        _version_baseband_enable_notification(true);
    }
    else if(_baseband_version != 0xFFFF || !_baseband_version)
    {
        if(network_is_available())
        {
            if(_baseband_version > HOJA_BASEBAND_VERSION)
            {
                console.log("Device baseband is newer than release.");
                return true;
            }
            else if(_baseband_version == HOJA_BASEBAND_VERSION)
            {
                console.log("Device baseband is up to date.");
                _version_baseband_enable_notification(false);
            }
            else
            {
                console.log("Device baseband is out of date.");
                _version_baseband_enable_notification(true);
            }
        }
        else
        {
            console.log("Network not available. Skipping Baseband checks.");
            _version_baseband_enable_notification(false);
        }
    }
    else
    {
        console.log("Baseband is unused with this device.");
        _version_baseband_enable_notification(false);
    }

    
}

function version_interpret_values_data(data)
{
    _fw_version         = (data.getUint8(1) << 8)   | (data.getUint8(2));
    _device_id          = (data.getUint8(3) << 8)   | (data.getUint8(4));
    _backend_version    = (data.getUint8(5) << 8)   | (data.getUint8(6));
    _baseband_version   = (data.getUint8(7)<<8)     | (data.getUint8(8));

    console.log("Device ID: " + _device_id.toString());
    console.log("FW Verson: " + _fw_version.toString());
    console.log("HOJA Version: " + _backend_version.toString());
    console.log("BT Baseband Version: " + _baseband_version);

    _version_fw_is_up_to_date();
}