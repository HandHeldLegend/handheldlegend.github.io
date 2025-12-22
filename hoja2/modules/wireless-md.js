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
        if(data.fw_version) return data.fw_version + 100;
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
        updateAvailable: false // New Flag
    },
    fcc: {
        id: "N/A",
        text: "This device complies with Part 15 of the FCC Rules. Operation is subject to the following two conditions: (1) this device may not cause harmful interference, and (2) this device must accept any interference received."
    }
};

function decodeText(buffer) {
    const decoder = new TextDecoder('utf-8');
    const str = decoder.decode(buffer);
    
    // Remove any null characters (0x00) from the string
    return str.replace(/\x00/g, '');
}

function updateWirelessUI() {
    const chipModel = document.getElementById('wireless-chip-model');
    const chipStatus = document.getElementById('wireless-chip-status');

    if (chipModel) chipModel.textContent = wirelessConfig.hardware.chip.model;

    if (chipStatus) {
        const isPresent = wirelessConfig.hardware.chip.present;
        chipStatus.textContent = isPresent ? 'Available' : 'Unavailable';
        chipStatus.className = `status-badge ${isPresent ? 'active' : 'not-present'}`;
    }
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
.status-badge.not-present { background: var(--color-p4-grad); color: var(--color-text-tertiary); }

.hardware-label { font-size: var(--font-size-sm); color: var(--color-text-secondary); font-weight: 500; }
.hardware-model { font-size: var(--font-size-md); color: var(--color-text-tertiary); font-weight: 600; }
`;

export async function render(container) {

    const currentBasebandVersion = await getCurrentBasebandVersion();
    const showBasebandUpdate = gamepad.bluetooth_static.external_version_number < currentBasebandVersion ? true : false;

    wirelessConfig = {
    hardware: {
        chip: { 
            model: decodeText(gamepad.bluetooth_static.part_number), 
            present: true, 
            active: gamepad.bluetooth_static.bluetooth_status > 0 
        }
    },
    options: {
        showUpdateTools: gamepad.bluetooth_static.external_update_supported > 0,
        showFccInfo: decodeText(gamepad.bluetooth_static.fcc_id.buffer) != "",
        updateAvailable: showBasebandUpdate
    },
    fcc: {
        id: decodeText(gamepad.bluetooth_static.fcc_id.buffer),
        text: "This device complies with Part 15 of the FCC Rules. Operation is subject to the following two conditions: (1) this device may not cause harmful interference, and (2) this device must accept any interference received."
    }};

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
            ${wirelessConfig.options.updateAvailable ? `
                <div class="update-msg">Wireless Update Available!</div>
            ` : ''}
            <div class="button-group">
                <button class="btn-wireless" onclick="window.enterWirelessUpdate()">Enter Update Mode</button>
                <button class="btn-wireless" onclick="window.openUpdatePage()">Update Page</button>
                <button class="btn-wireless" onclick="window.openHelpPage()">Help Page</button>
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

    // Initial UI Sync
    updateWirelessUI();
}

/**
 * Configure the wireless module
 * @param {Object} config 
 */
export function setWirelessConfig(config) {
    if (config.hardware?.chip) Object.assign(wirelessConfig.hardware.chip, config.hardware.chip);
    if (config.options) Object.assign(wirelessConfig.options, config.options);
    if (config.fcc) Object.assign(wirelessConfig.fcc, config.fcc);

    // If container exists, re-render to reflect optional sections or update messages
    const container = document.getElementById('wireless-chip-model')?.closest('.wireless-panel')?.parentElement;
    if (container) render(container);
    else updateWirelessUI();
}

// Example Default Setup
setWirelessConfig({
    hardware: {
        chip: { model: "ESP32-PICO-MINI-02", present: true }
    },
    options: {
        showUpdateTools: true,
        updateAvailable: true,
        showFccInfo: true
    }
});