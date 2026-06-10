import HojaGamepad from '../js/gamepad.js';

/** @type {HojaGamepad} */
const gamepad = HojaGamepad.getInstance();
const basebandCmd = 2;
const gamepadCfgBlock = 0;

const btManifestUrl = "https://raw.githubusercontent.com/HandHeldLegend/HOJA-ESP32-Baseband/master/manifest.json";
async function getCurrentBasebandVersion() {
    let response = await fetch(btManifestUrl);

    if(response.ok) {
        const data = await response.json();
        if(data.fw_version) return data.fw_version;
        else return false;
    }
}

let wirelessConfig = {
    hardware: {
        chip: { model: "Unknown", present: false, active: false }
    },
    options: {
        showUpdateTools: false,
        showFccInfo: false,
        showWlanPin: false,
        updateAvailable: false
    },
    externalFirmware: {
        version: 0
    },
    wlan: {
        pin: "0000"
    },
    fcc: {
        id: "N/A",
        text: "This device complies with Part 15 of the FCC Rules. Operation is subject to the following two conditions: (1) this device may not cause harmful interference, and (2) this device must accept any interference received, including interference that may cause undesired operation."
    }
};

async function writeGamepadMemBlock() {
    await gamepad.sendBlock(gamepadCfgBlock);
}

function sanitizeWlanPinInput(raw) {
    return raw.replace(/[^0-9]/g, '').slice(0, 4);
}

function wlanPinToValue(digits) {
    if (digits === '') return 0;
    return Math.min(9999, parseInt(digits, 10));
}

function formatWlanPin(value) {
    return wlanPinToValue(String(value)).toString().padStart(4, '0');
}

function decodeText(buffer) {
    const decoder = new TextDecoder('utf-8');
    const str = decoder.decode(buffer);
    return str.replace(/\x00/g, '');
}

function wirelessChipFromStatic(btStatic) {
    const model = decodeText(btStatic.part_number);
    const hasModel = model.trim() !== '';
    const status = btStatic.wireless_part_status;

    if (!hasModel && status === 0) {
        return { model: "Unknown", present: false, active: false };
    }

    return {
        model: hasModel ? model : "Unknown",
        present: true,
        active: status > 0
    };
}

function updateBadge(id, component) {
    const el = document.getElementById(id);
    if (!el) return;
    if (!component.present) {
        el.textContent = 'Not Present';
        el.className = 'status-badge not-present';
    } else if (component.active) {
        el.textContent = 'Active';
        el.className = 'status-badge active';
    } else {
        el.textContent = 'Inactive';
        el.className = 'status-badge inactive';
    }
}

function updateWirelessUI() {
    const chipModel = document.getElementById('wireless-chip-model');
    if (chipModel) chipModel.textContent = wirelessConfig.hardware.chip.model;
    updateBadge('wireless-chip-status', wirelessConfig.hardware.chip);

    const pinInput = document.getElementById('wlan-dongle-pin');
    if (pinInput) pinInput.value = wirelessConfig.wlan.pin;

    const firmwareVersion = document.getElementById('wireless-firmware-version');
    if (firmwareVersion) firmwareVersion.textContent = String(wirelessConfig.externalFirmware.version);
}

function setupWlanPinInput() {
    const pinInput = document.getElementById('wlan-dongle-pin');
    if (!pinInput) return;

    pinInput.addEventListener('input', (e) => {
        e.target.value = sanitizeWlanPinInput(e.target.value);
    });

    pinInput.addEventListener('change', async (e) => {
        const value = wlanPinToValue(sanitizeWlanPinInput(e.target.value));
        const formatted = formatWlanPin(value);
        e.target.value = formatted;
        wirelessConfig.wlan.pin = formatted;
        gamepad.gamepad_cfg.wlan_dongle_key = value;
        await writeGamepadMemBlock();
    });
}

const wirelessStyle = `
.wireless-panel {
    display: flex; flex-direction: column; width: 100%; max-width: 360px;
    padding: var(--spacing-md); box-sizing: border-box; border-radius: var(--border-radius-md);
    background: var(--color-p1-grad);
    background-color: var(--color-p1); border: var(--spacing-xs) solid var(--color-p1-dark);
    margin-bottom: var(--spacing-md); gap: 12px;
}

.panel-row { display: flex; justify-content: space-between; align-items: center; width: 100%; }

.update-msg {

    background: var(--color-p2-grad);
    color: var(--color-text-tertiary);
    padding: 6px 10px;
    border-radius: var(--border-radius-md);
    margin-left: auto;
    margin-right: auto;
    width: 200px;
    font-size: var(--font-size-md);
    font-weight: 600;
    text-align: center;
    border: 1px solid var(--color-p2-dark);
    animation: pulse 2.3s ease-in-out infinite;
}

@keyframes pulse { 
    0%, 100% { filter: brightness(1); } 
    50% { filter: brightness(1.1); box-shadow: 0 0 5px var(--color-p3); } 
}

.button-group { display: flex; gap: 8px; width: 320px; margin-top: 4px; margin-left: auto; margin-right: auto}

.btn-wireless {
    flex: 1;

    height: var(--button-h);
    font-family: var(--font-family-primary);
    font-size: var(--font-size-md);

    box-sizing: border-box;
    border-radius: var(--border-radius-md);
    
    background: var(--color-p3-grad);
    background-color: var(--color-p3);
    border: var(--spacing-xs) solid var(--color-p3-dark);

    font-size: var(--font-size-sm);
    cursor: pointer;
    transition: all 0.1s ease-in-out;
}

@media (hover: hover) {
    .btn-wireless:hover {
        filter:brightness(1.1);
        box-shadow: var(--box-shadow-outset);
        transform: translate(-1px, -1px);
        transition: all 0.1s ease-in-out;
    }
}

.btn-wireless:active { transform: scale(0.98); }

.fcc-section {
    padding-top: 8px; border-top: 1px solid var(--color-p1-dark);
    font-size: 10px; color: var(--color-text-secondary); line-height: 1.4;
}

.fcc-id { font-weight: bold; color: var(--color-text-tertiary); margin-bottom: 4px; }

.status-badge { padding: 4px 10px; border-radius: 12px; font-size: var(--font-size-sm); font-weight: bold; text-transform: uppercase; }
.status-badge.active { background: var(--color-p3-grad); color: var(--color-text-tertiary); }
.status-badge.inactive { background: var(--color-p2-grad); color: var(--color-text-tertiary); }
.status-badge.not-present { background: var(--color-p5-grad); color: var(--color-text-tertiary); }

.hardware-label { font-size: var(--font-size-sm); color: var(--color-text-secondary); font-weight: 500; }
.hardware-model { font-size: var(--font-size-md); color: var(--color-text-tertiary); font-weight: 600; }

.wlan-pin-input {
    width: 72px;
    height: var(--button-h);
    box-sizing: border-box;
    border-radius: var(--border-radius-md);
    border: var(--spacing-xs) solid var(--color-p1-dark);
    background: var(--color-p1);
    color: var(--color-text-tertiary);
    font-family: var(--font-family-primary);
    font-size: var(--font-size-md);
    font-weight: 600;
    text-align: center;
    letter-spacing: 0.15em;
    outline: none;
    transition: all var(--transition-quick);
}

.wlan-pin-input:focus {
    filter: brightness(1.1);
    border-color: var(--color-p3-dark);
}
`;

export async function render(container) {

    const currentBasebandVersion = await getCurrentBasebandVersion();
    const showBasebandUpdate = gamepad.bluetooth_static.external_version_number < currentBasebandVersion ? true : false;

    const wlanSupported = gamepad.bluetooth_static.wlan_supported > 0;

    wirelessConfig = {
        hardware: {
            chip: wirelessChipFromStatic(gamepad.bluetooth_static)
        },
        options: {
            showUpdateTools: gamepad.bluetooth_static.external_update_supported > 0,
            showFccInfo: decodeText(gamepad.bluetooth_static.fcc_id.buffer) != "",
            showWlanPin: wlanSupported,
            updateAvailable: showBasebandUpdate
        },
        externalFirmware: {
            version: gamepad.bluetooth_static.external_version_number
        },
        wlan: {
            pin: formatWlanPin(gamepad.gamepad_cfg.wlan_dongle_key)
        },
        fcc: {
            id: decodeText(gamepad.bluetooth_static.fcc_id.buffer),
            text: "This device complies with Part 15 of the FCC Rules. Operation is subject to the following two conditions: (1) this device may not cause harmful interference, and (2) this device must accept any interference received, including interference that may cause undesired operation."
        }
    };

    container.innerHTML = `
    <style>${wirelessStyle}</style>
    <div class="wireless-panel">
        <div class="panel-row">
            <div class="hardware-name">
                <div class="hardware-label">Wireless Chip</div>
                <div class="hardware-model" id="wireless-chip-model">-</div>
            </div>
            <span class="status-badge" id="wireless-chip-status">Unknown</span>
        </div>

        ${wirelessConfig.options.showUpdateTools ? `
            <div class="panel-row">
                <div class="hardware-name">
                    <div class="hardware-label">External Firmware</div>
                    <div class="hardware-model">Installed version</div>
                </div>
                <span class="hardware-model" id="wireless-firmware-version">${wirelessConfig.externalFirmware.version}</span>
            </div>
            ${wirelessConfig.options.updateAvailable ? `
                <div class="update-msg">Wireless Update Available!</div>
            ` : ''}
            <div class="button-group">
                <button class="btn-wireless" onclick="window.enterWirelessUpdate()">Enter Update Mode</button>
                <button class="btn-wireless" onclick="window.openUpdatePage()">Update Page</button>
                <button class="btn-wireless" onclick="window.openHelpPage()">Help Page</button>
            </div>
        ` : ''}

        ${wirelessConfig.options.showWlanPin ? `
        <div class="panel-row">
            <div class="hardware-name">
                <div class="hardware-label">WLAN Dongle PIN</div>
                <div class="hardware-model">4-digit pairing key</div>
            </div>
            <input
                id="wlan-dongle-pin"
                class="wlan-pin-input"
                type="text"
                inputmode="numeric"
                pattern="[0-9]*"
                maxlength="4"
                value="${wirelessConfig.wlan.pin}"
                autocomplete="off"
                spellcheck="false"
            >
        </div>
        ` : ''}

        ${wirelessConfig.options.showFccInfo ? `
        <div class="fcc-section">
            <div class="fcc-id">FCC ID: ${wirelessConfig.fcc.id}</div>
            <div>${wirelessConfig.fcc.text}</div>
        </div>
        ` : ''}
    </div>
    `;

    // Global hooks for button actions
    window.enterWirelessUpdate = () => {
        console.log("Entering wireless update mode...");
        if(gamepad) {
            gamepad.sendConfigCommand(gamepadCfgBlock, basebandCmd);
        }
    };

    window.openUpdatePage = () => {
        window.open('https://handheldlegend.github.io/hoja_baseband/', '_blank');
    };

    window.openHelpPage = () => {
        window.open('https://docs.handheldlegend.com/s/portal/doc/esp32-baseband-update-page-vhX2Im50kN', '_blank');
    };

    setupWlanPinInput();
    updateWirelessUI();
}

/**
 * Configure the wireless module
 * @param {Object} config 
 */
export function setWirelessConfig(config) {
    if (config.hardware?.chip) Object.assign(wirelessConfig.hardware.chip, config.hardware.chip);
    if (config.options) Object.assign(wirelessConfig.options, config.options);
    if (config.externalFirmware) Object.assign(wirelessConfig.externalFirmware, config.externalFirmware);
    if (config.wlan) Object.assign(wirelessConfig.wlan, config.wlan);
    if (config.fcc) Object.assign(wirelessConfig.fcc, config.fcc);

    const container = document.getElementById('wireless-chip-model')?.closest('.wireless-panel')?.parentElement;
    if (container) render(container);
    else updateWirelessUI();
}