import HojaGamepad from '../js/gamepad.js';

/** @type {HojaGamepad} */
const gamepad = HojaGamepad.getInstance();

let batteryConfig = {
    battery: { model: "Unknown", capacity: "Unknown" },
    status: { isCharging: false, isDone: false, percentage: false },
    hardware: {
        pmic: { model: "Unknown", present: false, active: false },
        fuelGauge: { model: "Unknown", present: false, active: false }
    }
};

function updateBatteryDisplay() {
    const display = document.getElementById('battery-status-content');
    if (!display) return;

    const { isCharging, isDone, percentage } = batteryConfig.status;
    const hasFuelGauge = percentage !== false && percentage <= 100;
    
    let levelClass = '';
    let iconClass = '';
    const percent = hasFuelGauge ? Math.max(0, Math.min(100, percentage)) : 50;

    if (hasFuelGauge) {
        if (percent <= 20) { levelClass = 'low'; iconClass = 'low'; }
        else if (percent <= 50) { levelClass = 'medium'; iconClass = 'medium'; }
        else { iconClass = 'high'; }
    }

    if (isCharging && !isDone) {
        levelClass += ' charging';
        iconClass = 'charging';
    } else if (isDone) {
        iconClass = 'high';
    }

    let statusText = 'Discharging';
    let statusClass = 'discharging';

    if (isDone) {
        statusText = 'Fully Charged';
        statusClass = 'full';
    } else if (isCharging) {
        statusText = 'Charging';
        statusClass = 'charging';
    }

    display.innerHTML = `
        <div class="status-left">
            <div class="battery-icon ${iconClass}">
                <div class="battery-level ${levelClass}" style="width: ${isDone ? 100 : percent}%"></div>
            </div>
            <div class="battery-info">
                <div class="battery-percent">
                    ${hasFuelGauge ? `${percent}%` : '<span class="unavailable-badge">% N/A</span>'}
                </div>
                <div class="battery-status">
                    <span class="status-indicator ${statusClass}"></span>
                    ${statusText}
                </div>
            </div>
        </div>
        <div class="status-right">
            <div class="panel-row">
                <span class="info-label">Model</span>
                <span class="info-value" id="battery-model">${batteryConfig.battery.model}</span>
            </div>
            <div class="battery-sep"></div>
            <div class="panel-row">
                <span class="info-label">Capacity</span>
                <span class="info-value" id="battery-capacity">${batteryConfig.battery.capacity}</span>
            </div>
        </div>
    `;
}

function updateHardwareUI() {
    const pmicModel = document.getElementById('pmic-model');
    const fuelModel = document.getElementById('fuel-gauge-model');
    
    if (pmicModel) pmicModel.textContent = batteryConfig.hardware.pmic.model;
    if (fuelModel) fuelModel.textContent = batteryConfig.hardware.fuelGauge.model;

    updateBadge('pmic-status', batteryConfig.hardware.pmic);
    updateBadge('fuel-gauge-status', batteryConfig.hardware.fuelGauge);
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

function decodeText(buffer) {
    const decoder = new TextDecoder('utf-8');
    const str = decoder.decode(buffer);
    
    // Remove any null characters (0x00) from the string
    return str.replace(/\x00/g, '');
}

function batteryReportHook(data) {
    return;

    const chargeVal = data.getUint8(37);
    batteryConfig.status.isCharging = (chargeVal & 0x01) !== 0;
    batteryConfig.status.isDone = (chargeVal & 0x02) !== 0;
    batteryConfig.hardware.pmic.active = (chargeVal & 0x04) !== 0; 
    const fuelGaugeMissing = (chargeVal & 0x08) !== 0;
    batteryConfig.hardware.fuelGauge.active = !fuelGaugeMissing;
    batteryConfig.status.percentage = !fuelGaugeMissing ? data.getUint8(38) : false;

    updateBatteryDisplay();
    updateHardwareUI();
}

const batteryStyle = `
.battery-panel {
    display: flex; width: 100%; max-width: 360px;
    padding: var(--spacing-md); box-sizing: border-box; border-radius: var(--border-radius-md);
    background: var(--color-p1-grad);
    background-color: var(--color-p1); border: var(--spacing-xs) solid var(--color-p1-dark);
    margin-bottom: var(--spacing-md);
}

.status-left { display: flex; align-items: center; gap: 16px; flex: 1.2; }
.status-right { 
    display: flex; flex-direction: column; justify-content: center; gap: 8px; 
    flex: 1; padding-left: 16px; border-left: 1px solid var(--color-p1-dark); 
}

.panel-row { display: flex; justify-content: space-between; align-items: center; width: 100%; }
.panel-column { display: flex; flex-direction: column; width: 100%; gap: 12px; }

.battery-sep {
    max-width: 350px;
    width: 100%;
    height: 1px;
    background-color: var(--color-p1-dark);
    margin-left: auto;
    margin-right: auto;
}

.battery-icon {
    position: relative; width: 60px; height: 28px; border: 3px solid var(--color-p5-dark);
    background: var(--color-p5-grad); border-radius: 4px; padding: 2px; flex-shrink: 0;
}
.battery-icon::after {
    content: ''; position: absolute; right: -8px; top: 50%; transform: translateY(-50%);
    width: 5px; height: 12px; background: var(--color-p5-grad); border-radius: 0 2px 2px 0;
}
.battery-level {
    height: 100%; background: var(--color-p3-grad); border-radius: 2px;
    transition: all var(--transition-steady);
}
.battery-level.low { background: var(--color-p4-grad); }
.battery-level.medium { background: var(--color-p2-grad); }
.battery-level.charging { background: var(--color-p1-grad); animation: pulse 2.3s ease-in-out infinite; }

@keyframes pulse { 
    0%, 100% { filter: brightness(1); } 
    50% { filter: brightness(1.2); } 
}

.battery-info { flex: 1; }
.battery-percent { font-size: var(--font-size-lg); font-weight: 700; color: var(--color-text-tertiary); line-height: 1; margin-bottom: 4px; }
.battery-status { font-size: var(--font-size-sm); color: var(--color-text-secondary); display: flex; align-items: center; gap: 6px; }

.status-indicator { width: 8px; height: 8px; border-radius: 50%; display: inline-block; transition: filter var(--transition-steady); }
.status-indicator.charging { background: var(--color-p1-grad); animation: blink 2.5s ease-in-out infinite; }
.status-indicator.full { background: var(--color-p3-grad); }
.status-indicator.discharging { background: var(--color-text-secondary); }

@keyframes blink { 
    0%, 100% { filter: brightness(1); } 
    50% { filter: brightness(1.8); box-shadow: 0 0 8px var(--color-p1); } 
}

.info-label, .hardware-label { font-size: var(--font-size-sm); color: var(--color-text-secondary); font-weight: 500; }
.info-value, .hardware-model { font-size: var(--font-size-md); color: var(--color-text-tertiary); font-weight: 600; }

.status-badge { padding: 4px 10px; border-radius: 12px; font-size: var(--font-size-sm); font-weight: bold; text-transform: uppercase; }
.status-badge.active { background: var(--color-p3-grad); color: var(--color-text-tertiary); }
.status-badge.inactive { background: var(--color-p2-grad); color: var(--color-text-tertiary); }
.status-badge.not-present { background: var(--color-p5-grad); color: var(--color-text-tertiary); }
`;

export function render(container) {
    container.innerHTML = `
    <style>${batteryStyle}</style>
    
    <h3>Battery Status & Info</h3>
    <div class="battery-panel" id="battery-status-content"></div>
    
    <div class="separator"></div>

    <h3>Hardware Components</h3>
    <div class="battery-panel">
        <div class="panel-column">
            <div class="panel-row">
                <div class="hardware-name">
                    <div class="hardware-label">PMIC</div>
                    <div class="hardware-model" id="pmic-model">-</div>
                </div>
                <span class="status-badge" id="pmic-status">Unknown</span>
            </div>
            <div class="battery-sep"></div>
            <div class="panel-row">
                <div class="hardware-name">
                    <div class="hardware-label">Fuel Gauge</div>
                    <div class="hardware-model" id="fuel-gauge-model">-</div>
                </div>
                <span class="status-badge" id="fuel-gauge-status">Unknown</span>
            </div>
        </div>
    </div>
    `;

    gamepad.setReportHook(batteryReportHook);

    let bModel = decodeText(gamepad.battery_static.battery_part_number.buffer);
    let bCapacity = gamepad.battery_static.battery_capacity_mah;
    let pActive = gamepad.battery_static.pmic_status == 2 ? true : false;
    let pModel = decodeText(gamepad.battery_static.pmic_part_number);
    let fPresent = gamepad.battery_static.fuelgauge_status == 0 ? false : true;
    let fActive = gamepad.battery_static.fuelgauge_status == 2 ? true : false;
    let fModel = decodeText(gamepad.battery_static.fuelgauge_part_number);

    setHardwareConfig({
        battery: { model: bModel, capacity: bCapacity + " mAh" },
        hardware: {
            pmic: { model: pModel, present: true, active: pActive },
            fuelGauge: { model: fModel, present: fPresent, active: fActive }
        }
    });

    // Debug
    batteryConfig.status.isCharging = true;
    batteryConfig.status.isDone = false;
    batteryConfig.status.percentage = fPresent ? 20 : false;

    updateBatteryDisplay();
    updateHardwareUI();
}

export function setHardwareConfig(config) {
    if (config.battery) Object.assign(batteryConfig.battery, config.battery);
    if (config.hardware?.pmic) Object.assign(batteryConfig.hardware.pmic, config.hardware.pmic);
    if (config.hardware?.fuelGauge) Object.assign(batteryConfig.hardware.fuelGauge, config.hardware.fuelGauge);
    
    updateBatteryDisplay();
    updateHardwareUI();
}