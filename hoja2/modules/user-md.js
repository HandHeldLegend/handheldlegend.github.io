import HojaGamepad from '../gamepad/gamepad.js';

import NumberSelector from '../components/number-selector.js';
import MultiPositionButton from '../components/multi-position-button.js';
import GroupRgbPicker from '../components/group-rgb-picker.js';
import AngleSelector from '../components/angle-selector.js';
import RemapSelector from '../components/remap-selector.js';

import TristateButton from '../components/tristate-button.js';
import SingleShotButton from '../components/single-shot-button.js';

import { enableTooltips } from '../tooltips.js';

/** @type {HojaGamepad} */
let gamepad = HojaGamepad.getInstance();

function decodeText(buffer) {
    const decoder = new TextDecoder('utf-8');
    const str = decoder.decode(buffer);
    
    // Remove any null characters (0x00) from the string
    return str.replace(/\x00/g, '');
}

export function render(container) {

    let userNameHTML = ``;

    let userNameDecoded = decodeText(gamepad.user_cfg.user_name);

    if(userNameDecoded == "")
    {
        userNameHTML = `
        <text-entry placeholder="Enter username..."></text-entry>
        `;
    }
    else
    {
        userNameHTML = `
        <text-entry default-value="${userNameDecoded}"></text-entry>
        `
    }

    container.innerHTML = `
            <h1>User Settings</h1>
            ${userNameHTML}
    `;
}