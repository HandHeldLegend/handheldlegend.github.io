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

export function render(container) {
    container.innerHTML = `
    <h2>Battery Information</h2>
    <h3>Battery Model</h3>
    <div class="app-text-container">
        ${parseBatteryBufferText(gamepad.battery_static.part_number)}
    </div>
    `;
}