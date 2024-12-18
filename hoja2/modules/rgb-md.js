import HojaGamepad from '../gamepad/gamepad.js';

import NumberSelector from '../components/number-selector.js';
import MultiPositionButton from '../components/multi-position-button.js';
import GroupRgbPicker from '../components/group-rgb-picker.js';
import AngleSelector from '../components/angle-selector.js';
import RemapSelector from '../components/remap-selector.js';

import TristateButton from '../components/tristate-button.js';
import SingleShotButton from '../components/single-shot-button.js';

import { enableTooltips } from '../tooltips.js';
import Rgbgroupname from '../factory/parsers/rgbGroupName.js';

function decodeText(buffer) {
    const decoder = new TextDecoder('utf-8');
    const str = decoder.decode(buffer);
    
    // Remove any null characters (0x00) from the string
    return str.replace(/\x00/g, '');
}

function uint32ToRgbHex(uint32) {
    console.log(uint32);
    // Mask out everything except the RGB components (last 3 bytes)
    uint32 &= 0x00FFFFFF;  // Mask the last byte (keeping the RGB part)
    //uint32 >>>= 8;         // Unsigned right shift to get only the RGB components
    
    // Convert to hex string and pad with leading zeros if necessary
    let hexString = uint32.toString(16).padStart(6, '0');
    
    // Ensure it's exactly 6 characters long
    return hexString;
}

// Convert a hex string (RRGGBB) back to a Uint32 RGB value
function hexToUint32Rgb(hexString) {
    // Ensure the hex string is 6 characters long, and convert it to a Uint32
    return parseInt(hexString, 16) >>> 0; // >>> 0 ensures it's treated as unsigned
}

export function render(container) {

    /** @type {HojaGamepad} */
    let gamepad = HojaGamepad.getInstance();

    let colors = gamepad.rgb_cfg.rgb_colors;

    let nameCount = gamepad.rgb_static.rgb_groups;

    /** @type {Rgbgroupname[]} */
    let names = gamepad.rgb_static.rgb_group_names;
    
    let decodedNames = []

    for(let i = 0; i < nameCount; i++)
    {
        decodedNames.push(decodeText(names[i].rgb_group_name));
    }

    let rgbPickersHTML = '';
    for(let i = 0; i < decodedNames.length; i++) {

        let colorText = uint32ToRgbHex(colors[i]);

        // Generate RGB Pickers
        rgbPickersHTML += `
        <group-rgb-picker 
            idx="${i}"
            id="rgb-picker-${i}"
            group-name="${decodedNames[i]}" 
            color="${colorText}"
        ></group-rgb-picker>
        `
    }

    container.innerHTML = `
            <h1>RGB Settings</h1>
            <h2>Brightness</h2>
            <number-selector 
                id="brightness-slider" 
                type="float" 
                min="0" 
                max="100" 
                step="0.5" 
                default-value="85"
            ></number-selector>

            <h2>Mode</h2>
            <multi-position-button 
                id="rgbModeButton" 
                labels="User, Rainbow"
                default-selected="0"
            ></multi-position-button>

            <h2>Colors</h2>
            ${rgbPickersHTML}
    `;

    // Optional: Add event listeners to specific number selectors
    const brightnessSelector = container.querySelector('number-selector[id="brightness-slider"]');
    brightnessSelector.addEventListener('change', (e) => {
        console.log(`Brightness changed to: ${e.detail.value}`);
    });

    const rgbModuleVersion = 0x1;

    // Check values
    if(!gamepad.rgb_cfg.rgb_config_version)
    {
        gamepad.rgb_cfg.rgb_config_version = rgbModuleVersion;
        gamepad.rgb_cfg.rgb_brightness = 500;
        gamepad.sendBlock(3);
    }

    const rgbPickers = container.querySelectorAll('group-rgb-picker');
    rgbPickers.forEach(picker => {
        picker.addEventListener('color-change', (e) => {
            let idx = parseInt(e.target.getAttribute('idx'));
            
            let u32color = hexToUint32Rgb(e.detail.color);

            let tmpArr = gamepad.rgb_cfg.rgb_colors;
            tmpArr[idx] = u32color;
            gamepad.rgb_cfg.rgb_colors = tmpArr;

            gamepad.sendBlock(3);
        });
    });
}