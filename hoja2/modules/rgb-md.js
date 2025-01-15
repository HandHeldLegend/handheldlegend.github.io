import HojaGamepad from '../js/gamepad.js';

import NumberSelector from '../components/number-selector.js';
import MultiPositionButton from '../components/multi-position-button.js';
import GroupRgbPicker from '../components/group-rgb-picker.js';
import AngleSelector from '../components/angle-selector.js';
import RemapSelector from '../components/remap-selector.js';

import TristateButton from '../components/tristate-button.js';
import SingleShotButton from '../components/single-shot-button.js';

import { enableTooltips } from '../js/tooltips.js';
import Rgbgroupname from '../factory/parsers/rgbGroupName.js';

/** @type {HojaGamepad} */
const gamepad = HojaGamepad.getInstance();
const rgbCfgBlockNumber = 3;

async function writeRgbMemBlock() {
    await gamepad.sendBlock(rgbCfgBlockNumber);
}

function decodeText(buffer) {
    const decoder = new TextDecoder('utf-8');
    const str = decoder.decode(buffer);
    
    // Remove any null characters (0x00) from the string
    return str.replace(/\x00/g, '');
}

function uint32ToRgbHex(uint32) {
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

    let colors = gamepad.rgb_cfg.rgb_colors;

    let nameCount = gamepad.rgb_static.rgb_groups;

    /** @type {Rgbgroupname[]} */
    let names = gamepad.rgb_static.rgb_group_names;
    let startBrightness = ((gamepad.rgb_cfg.rgb_brightness) / 4096) * 100;
    startBrightness = Math.round(startBrightness);

    let animationTime = gamepad.rgb_cfg.rgb_speed;

    let rgbMode = gamepad.rgb_cfg.rgb_mode;
    
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
            <h2>Brightness</h2>
            <number-selector 
                id="brightness-slider" 
                type="int" 
                min="0" 
                max="100" 
                step="1" 
                default-value="${startBrightness}"
            ></number-selector>

            <h2>Animation Time (ms)</h2>
            <number-selector 
                id="speed-slider" 
                type="int" 
                min="300" 
                max="5000" 
                step="25" 
                default-value="${animationTime}"
            ></number-selector>

            <h2>Mode</h2>
            <multi-position-button 
                id="rgb-mode-select" 
                labels="User, Rainbow, React"
                default-selected="${rgbMode}"
            ></multi-position-button>

            <h2>Colors</h2>
            ${rgbPickersHTML}
    `;

    // Optional: Add event listeners to specific number selectors
    const brightnessSelector = container.querySelector('number-selector[id="brightness-slider"]');
    brightnessSelector.addEventListener('change', (e) => {
        console.log(`Brightness changed to: ${e.detail.value}`);
        let bright = e.detail.value;
        bright = (bright > 100) ? 100 : bright;
        bright = (bright < 0) ? 0 : bright;
        let outbright = (bright/100) * 4096;
        outbright = Math.round(outbright);
        gamepad.rgb_cfg.rgb_brightness = outbright;
        writeRgbMemBlock();
    });

    const speedSelector = container.querySelector('number-selector[id="speed-slider"]');
    speedSelector.addEventListener('change', (e) => {
        console.log(`Speeed changed to: ${e.detail.value}`);
        let speed = e.detail.value;
        speed = (speed > 5000) ? 5000 : speed;
        speed = (speed < 300) ? 300 : speed;
        gamepad.rgb_cfg.rgb_speed = speed;
        writeRgbMemBlock();
    });

    const rgbModuleVersion = 0x1;

    const rgbPickers = container.querySelectorAll('group-rgb-picker');
    rgbPickers.forEach(picker => {
        picker.addEventListener('color-change', (e) => {
            let idx = parseInt(e.target.getAttribute('idx'));
            
            let u32color = hexToUint32Rgb(e.detail.color);

            let tmpArr = gamepad.rgb_cfg.rgb_colors;
            tmpArr[idx] = u32color;
            gamepad.rgb_cfg.rgb_colors = tmpArr;

            writeRgbMemBlock();
        });
    });

    const modeSelector = container.querySelector('multi-position-button[id="rgb-mode-select"]');
    modeSelector.addEventListener('change', (e) => {
        console.log("RGB mode change");
        gamepad.rgb_cfg.rgb_mode = e.detail.selectedIndex;
        writeRgbMemBlock();
    });
}