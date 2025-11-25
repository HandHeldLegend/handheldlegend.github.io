import HojaGamepad from '../js/gamepad.js';

import NumberSelector from '../components/number-selector.js';
import MultiPositionButton from '../components/multi-position-button.js';
import GroupRgbPicker from '../components/group-rgb-picker.js';
import AngleSelector from '../components/angle-selector.js';

import TristateButton from '../components/tristate-button.js';
import SingleShotButton from '../components/single-shot-button.js';

import { enableTooltips } from '../js/tooltips.js';

const parseBatteryBufferText = buffer => {
    const text = new TextDecoder().decode(buffer).trim();
    // Log each character code to see what's actually in there
    //console.log('Character codes:', [...text].map(c => c.charCodeAt(0)));
    
    // Remove any null bytes or other whitespace and then check
    const cleanText = text.replace(/\0+/g, '').trim();
    return cleanText === '~' ? false : cleanText;
};

/** @type {HojaGamepad} */
const gamepad = HojaGamepad.getInstance();



/**
 * Updates the battery status display
 * @param {boolean} isCharging - Whether the device is currently charging
 * @param {number} percentage - Battery percentage (0-100)
 */
function updateBatteryStatus(isCharging, isDone, percentage) {
    const chargingStatusEl = document.getElementById('charging-status');
    const batteryPercentageEl = document.getElementById('battery-percentage');
    const batteryBarEl = document.getElementById('battery-bar');
    
    if (!chargingStatusEl || !batteryPercentageEl || !batteryBarEl) {
        return;
    }
    
    // Update charging status
    chargingStatusEl.textContent = isCharging ? 'Yes' : 'No';
    chargingStatusEl.textContent = isDone ? 'Fully Charged' : chargingStatusEl.textContent;
    chargingStatusEl.className = `status-value ${isCharging ? 'charging' : 'not-charging'}`;
    chargingStatusEl.className = isDone ? 'charging-full' : chargingStatusEl.className;
    
    // Update percentage
    const clampedPercentage = Math.max(0, Math.min(254, percentage));
    if(percentage === false || percentage > 100) {
        batteryPercentageEl.textContent = `N/A`;
    }
    else
    {
        batteryPercentageEl.textContent = `${clampedPercentage}%`;
    }
    
    
    // Update visual battery bar
    batteryBarEl.style.width = `${clampedPercentage}%`;
    
    // Add color classes based on battery level
    batteryBarEl.className = 'battery-bar';
    if (isCharging) {
        batteryBarEl.classList.add('battery-charging');
    } else if (clampedPercentage <= 20) {
        batteryBarEl.classList.add('battery-low');
    } else if (clampedPercentage <= 50) {
        batteryBarEl.classList.add('battery-medium');
    } else {
        batteryBarEl.classList.add('battery-high');
    }
}

function batteryReportHook(data) {
    var chargeVal = data.getUint8(37);

    var isCharging = (chargeVal & 0x01) != 0;
    var doneCharging = (chargeVal & 0x02) != 0;
    var dischargeOnly = (chargeVal & 0x08) != 0;
    var percent = !dischargeOnly ? data.getUint8(38) : false;

    updateBatteryStatus(isCharging, doneCharging, percent);
}

export function render(container) {
    container.innerHTML = `
    <h2>Battery Information</h2>
    <h3>Battery Model</h3>
    <div class="app-text-container">
        ${parseBatteryBufferText(gamepad.battery_static.part_number)}
    </div>
    
    <h3>Battery Status</h3>
    <div class="battery-status-container">
        <div class="status-row">
            <span class="status-label">Charging: </span>
            <span id="charging-status" class="status-value">Unknown</span>
        </div>
        <div class="status-row">
            <span class="status-label">Battery Level:</span>
            <span id="battery-percentage" class="status-value">--</span>
        </div>
        <div class="battery-visual">
            <div id="battery-bar" class="battery-bar" style="width: 0%"></div>
        </div>
    </div>
    `;

    gamepad.setReportHook(batteryReportHook);
}