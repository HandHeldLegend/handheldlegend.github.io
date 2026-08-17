import HojaGamepad from '../js/gamepad.js';

/** @type {HojaGamepad} */
const gamepad = HojaGamepad.getInstance();

// pmic_status, byte 26 of STATIC_BLOCK_BATTERY. Firmware widened this from 3
// states to 5 when battery pack detection landed; older firmware reported 2 for
// every "PMIC ok" case, and 3/4 were split out of it.
const PMIC_STATUS = {
    NO_DRIVER:       0, // No PMIC driver compiled in for this board
    NOT_RESPONDING:  1, // PMIC expected but silent on I2C, or init never ran
    OK_PACK:         2, // PMIC ok, battery pack positively detected
    OK_NO_PACK:      3, // PMIC ok, no battery pack detected. Not an error
    OK_PACK_UNKNOWN: 4  // PMIC ok, detection did not complete
};

// rgb_idle_glow, as offered by the RGB module's "On, Off" selector.
const IDLE_GLOW_OFF = 1;

// Pack presence, derived from pmic_status. The firmware samples this once at
// boot and never re-reads it, so it is not a live value and cannot be retried.
const PACK = {
    PRESENT: 'present',
    ABSENT: 'absent',
    UNKNOWN: 'unknown',
    NA: 'na' // No working PMIC, so nothing looked for a pack either way
};

function decodePmicStatus(value) {
    switch (value) {
        case PMIC_STATUS.NO_DRIVER:
            return { badge: { text: 'Not Present', cls: 'not-present' }, pack: PACK.NA };
        case PMIC_STATUS.NOT_RESPONDING:
            // Soft fault: this also covers boot transports that skip battery
            // init entirely, so it is not exclusively a hardware failure.
            return { badge: { text: 'Not Responding', cls: 'inactive' }, pack: PACK.NA };
        case PMIC_STATUS.OK_PACK:
            return { badge: { text: 'Active', cls: 'active' }, pack: PACK.PRESENT };
        case PMIC_STATUS.OK_NO_PACK:
            return { badge: { text: 'Active', cls: 'active' }, pack: PACK.ABSENT };
        case PMIC_STATUS.OK_PACK_UNKNOWN:
            return { badge: { text: 'Active', cls: 'active' }, pack: PACK.UNKNOWN };
        default: {
            // Later firmware may append to this ladder. Report what we got
            // rather than rounding it to whichever neighbour looks plausible.
            const text = Number.isFinite(value) ? `Unknown (${value})` : 'Unknown';
            return { badge: { text, cls: 'unknown' }, pack: PACK.UNKNOWN };
        }
    }
}

let batteryConfig = {
    battery: { model: "Unknown", capacity: "Unknown" },
    status: { isCharging: false, isDone: false, percentage: false },
    hardware: {
        pmic: { model: "Unknown", status: PMIC_STATUS.NO_DRIVER },
        fuelGauge: { model: "Unknown", present: false, active: false }
    }
};

// The input report hook drives these updates on every USB report. Replacing the
// panel's nodes on each one would wipe the user's text selection and restart the
// charging animations mid-cycle every time the percentage ticks, so the markup
// is built once per layout and the values are patched into it in place.
const LAYOUT = { ABSENT: 'absent', NORMAL: 'normal' };

const PANEL_INFO = `
        <div class="status-right">
            <div class="panel-row">
                <span class="info-label">Model</span>
                <span class="info-value" id="battery-model"></span>
            </div>
            <div class="battery-sep"></div>
            <div class="panel-row">
                <span class="info-label">Capacity</span>
                <span class="info-value" id="battery-capacity"></span>
            </div>
        </div>`;

const PANEL_HTML = {
    // No battery fitted: there is nothing to charge or measure, so the charge
    // state the device keeps reporting is inert and has no row here.
    [LAYOUT.ABSENT]: `
        <div class="status-left">
            <div class="battery-icon empty">
                <div class="battery-level" style="width: 0%"></div>
            </div>
            <div class="battery-info">
                <div class="battery-percent">No Battery</div>
            </div>
        </div>${PANEL_INFO}`,

    [LAYOUT.NORMAL]: `
        <div class="status-left">
            <div class="battery-icon">
                <div class="battery-level"></div>
            </div>
            <div class="battery-info">
                <div class="battery-percent"></div>
                <div class="battery-status">
                    <span class="status-indicator"></span>
                    <span class="battery-status-text"></span>
                </div>
            </div>
        </div>${PANEL_INFO}`
};

let panelLayout = null;
let panelEls = {};

function ensurePanel(display, layout) {
    if (panelLayout === layout) return;

    panelLayout = layout;
    display.innerHTML = PANEL_HTML[layout];
    panelEls = {
        icon: display.querySelector('.battery-icon'),
        level: display.querySelector('.battery-level'),
        percent: display.querySelector('.battery-percent'),
        indicator: display.querySelector('.status-indicator'),
        statusText: display.querySelector('.battery-status-text'),
        model: display.querySelector('#battery-model'),
        capacity: display.querySelector('#battery-capacity')
    };
}

function setText(el, text) {
    if (!el || el.textContent === text) return;
    el.textContent = text;
}

function setClass(el, base, modifier) {
    const cls = modifier ? `${base} ${modifier}` : base;
    if (!el || el.className === cls) return;
    el.className = cls;
}

function setWidth(el, width) {
    if (!el || el.style.width === width) return;
    el.style.width = width;
}

function updateBatteryDisplay() {
    const display = document.getElementById('battery-status-content');
    if (!display) return;

    const { pack } = decodePmicStatus(batteryConfig.hardware.pmic.status);
    const absent = pack === PACK.ABSENT;

    ensurePanel(display, absent ? LAYOUT.ABSENT : LAYOUT.NORMAL);

    setText(panelEls.model, batteryConfig.battery.model);
    setText(panelEls.capacity, batteryConfig.battery.capacity);

    if (absent) return;

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
        levelClass = levelClass ? `${levelClass} charging` : 'charging';
        iconClass = 'charging';
    } else if (isDone) {
        iconClass = 'high';
    }

    // Done is checked before charging, matching the firmware's own priority: a
    // device reporting both flags renders as complete.
    let statusText = 'Discharging';
    let statusClass = 'discharging';

    if (isDone) {
        statusText = 'Fully Charged';
        statusClass = 'full';
    } else if (isCharging) {
        statusText = 'Charging';
        statusClass = 'charging';
    }

    // These colors mirror the board's status LED, so when the user has turned
    // the idle glow off the indicator goes dark the same way the LED does. The
    // status text beside it still says what the state is.
    if (gamepad.rgb_cfg.rgb_idle_glow === IDLE_GLOW_OFF) statusClass = 'off';

    // The firmware could not confirm whether a battery is fitted and declined to
    // guess, so neither do we. The charge state above may still be real.
    if (pack === PACK.UNKNOWN) statusText += ' · Battery Unconfirmed';

    // Patched in place rather than re-rendered, so the pulse/blink animations on
    // these elements keep running instead of restarting on every percent tick.
    setClass(panelEls.icon, 'battery-icon', iconClass);
    setClass(panelEls.level, 'battery-level', levelClass);
    setWidth(panelEls.level, `${isDone ? 100 : percent}%`);
    setText(panelEls.percent, hasFuelGauge ? `${percent}%` : '% N/A');
    setClass(panelEls.indicator, 'status-indicator', statusClass);
    setText(panelEls.statusText, statusText);
}

function updateHardwareUI() {
    setText(document.getElementById('pmic-model'), batteryConfig.hardware.pmic.model);
    setText(document.getElementById('fuel-gauge-model'), batteryConfig.hardware.fuelGauge.model);

    const { badge } = decodePmicStatus(batteryConfig.hardware.pmic.status);

    setBadge('pmic-status', badge);
    setBadge('fuel-gauge-status', fuelGaugeBadge(batteryConfig.hardware.fuelGauge));
}

// fuelgauge_status is still 3-state. The pack values above do not apply to it.
function fuelGaugeBadge(component) {
    if (!component.present) return { text: 'Not Present', cls: 'not-present' };
    return component.active
        ? { text: 'Active', cls: 'active' }
        : { text: 'Inactive', cls: 'inactive' };
}

function setBadge(id, badge) {
    const el = document.getElementById(id);
    if (!el || !badge) return;
    setText(el, badge.text);

    const cls = `status-badge ${badge.cls}`;
    if (el.className !== cls) el.className = cls;
}

function decodeText(buffer) {
    const decoder = new TextDecoder('utf-8');
    const str = decoder.decode(buffer);
    
    // Remove any null characters (0x00) from the string
    return str.replace(/\x00/g, '');
}

function batteryReportHook(data) {

    // Original charging data is set on embedded like so:
    /* webusb_input_report[1] = (uint8_t)batstat.charging | ((uint8_t)batstat.charging_done << 1);
        webusb_input_report[2] = fgstat.percent; */

    // Byte 1 contains charging status, PMIC active, and fuel gauge missing flags
    // Byte 2 contains the battery percentage if fuel gauge is present

    const chargeVal = data.getUint8(1);
    const percentVal = data.getUint8(2);
    
    batteryConfig.status.isCharging = (chargeVal & 0x01) !== 0;
    batteryConfig.status.isDone = (chargeVal & 0x02) !== 0;
    batteryConfig.status.percentage = batteryConfig.hardware.fuelGauge.present ? percentVal : false;

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

/* Mirrors the on-board status LED (firmware anm_idle.c, colors from
   devices_shared_types.h) so the screen agrees with the hardware in front of the
   user. Full brightness on purpose - the firmware right-shifts every channel by
   one only to dim the physical LED, which would just look muddy here. */
.battery-panel {
    /* COLOR_ORANGE is #FF4D00. Nudged warmer here because the same hue reads
       noticeably redder as a flat swatch on a dark panel than it does emitted
       from the LED. Hue only - full saturation and value are unchanged. */
    --led-charging: #FF6600;
    --led-complete: #00FF00; /* COLOR_GREEN  */
    --led-idle:     #15FFF1; /* COLOR_CYAN   */
    --led-off:      #000000; /* COLOR_BLACK  - idle glow disabled */
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
.battery-level.charging {
    background: linear-gradient(150deg, var(--led-charging) 0%, color-mix(in srgb, var(--led-charging) 80%, black) 100%);
    animation: pulse 2.3s ease-in-out infinite;
}

@keyframes pulse { 
    0%, 100% { filter: brightness(1); } 
    50% { filter: brightness(1.2); } 
}

.battery-info { flex: 1; }
/* Matches .info-value so the readout and the Model/Capacity values agree. */
.battery-percent { font-size: var(--font-size-md); font-weight: 600; color: var(--color-text-tertiary); line-height: 1; margin-bottom: 4px; }
.battery-status { font-size: var(--font-size-sm); color: var(--color-text-secondary); display: flex; align-items: center; gap: 6px; }

/* The board re-evaluates state every 2000ms and crossfades over 800ms, so match
   that fade rather than snapping between colors. */
.status-indicator {
    width: 8px; height: 8px; border-radius: 50%; display: inline-block;
    transition: background-color 800ms ease, filter var(--transition-steady);
}
.status-indicator.charging { background: var(--led-charging); animation: blink 2.5s ease-in-out infinite; }
.status-indicator.full { background: var(--led-complete); }
.status-indicator.discharging { background: var(--led-idle); }
.status-indicator.off { background: var(--led-off); }

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
/* Deliberately not styled as a state: the device declined to report one. */
.status-badge.unknown {
    background: transparent; color: var(--color-text-secondary);
    border: 2px dashed var(--color-p5-dark); padding: 2px 8px;
}

.battery-icon.empty { opacity: 0.45; }
`;

export function render(container) {
    // Fresh DOM, so the cached panel layout and element refs are stale.
    panelLayout = null;
    panelEls = {};

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
    let pStatus = gamepad.battery_static.pmic_status;
    let pModel = decodeText(gamepad.battery_static.pmic_part_number);
    let fPresent = gamepad.battery_static.fuelgauge_status == 0 ? false : true;
    let fActive = gamepad.battery_static.fuelgauge_status == 2 ? true : false;
    let fModel = decodeText(gamepad.battery_static.fuelgauge_part_number);

    setHardwareConfig({
        battery: { model: bModel, capacity: bCapacity + " mAh" },
        hardware: {
            pmic: { model: pModel, status: pStatus },
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