import HojaGamepad from '../js/gamepad.js';

import NumberSelector from '../components/number-selector.js';
import MultiPositionButton from '../components/multi-position-button.js';
import GroupRgbPicker from '../components/group-rgb-picker.js';
import AngleSelector from '../components/angle-selector.js';
import RemapSelector from '../components/remap-selector.js';

import TristateButton from '../components/tristate-button.js';
import SingleShotButton from '../components/single-shot-button.js';

import MacAddressSelector from '../components/mac-address-selector.js';

import { enableTooltips } from '../js/tooltips.js';

/** @type {HojaGamepad} */
const gamepad = HojaGamepad.getInstance();
const gamepadCfgBlockNumber = 0;

async function writeGamepadMemBlock() {
    await gamepad.sendBlock(gamepadCfgBlockNumber);
}

// Convert a hex string (RRGGBB) back to a Uint32 RGB value
function hexToUint32Rgb(hexString) {
    // Ensure the hex string is 6 characters long, and convert it to a Uint32
    return parseInt(hexString, 16) >>> 0; // >>> 0 ensures it's treated as unsigned
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

export function render(container) {

    let bodyColor = uint32ToRgbHex(gamepad.gamepad_cfg.gamepad_color_body);
    let buttonsColor = uint32ToRgbHex(gamepad.gamepad_cfg.gamepad_color_buttons);
    let griplColor = uint32ToRgbHex(gamepad.gamepad_cfg.gamepad_color_grip_left);
    let griprColor = uint32ToRgbHex(gamepad.gamepad_cfg.gamepad_color_grip_right);

    let hexDefault = '';
    for(let i = 0; i < 6; i++)
    {
        let val = gamepad.gamepad_cfg.switch_mac_address[i].toString(16);
        hexDefault+=val;
        if(i != 5) hexDefault += ",";
    }

    container.innerHTML = `
            <h2>Default Mode</h2>
            <multi-position-button 
                id="default-mode-selector" 
                labels="SWITCH, XINPUT, GCUSB, GC, N64, SNES"
                default-selected="${gamepad.gamepad_cfg.default_mode}"
            ></multi-position-button>
            </h2>

            <h2>Switch USB Mac Address
                <div class="header-tooltip" tooltip="This is the MAC address only used for 
                Switch mode when connected via USB.">?</div>
            </h2>
            <mac-address-selector 
                default-value="${hexDefault}"
            ></mac-address-selector>

            <h2>Switch Device Colors
            <div class="header-tooltip" tooltip="Colors which determine how the Switch
            displays the controller in menus and some games.">?</div>
            </h2>
            <group-rgb-picker 
                id="body-color"
                group-name="Body" 
                color="${bodyColor}"
            ></group-rgb-picker>

            <group-rgb-picker 
                id="button-color"
                group-name="Buttons" 
                color="${buttonsColor}"
            ></group-rgb-picker>

            <group-rgb-picker 
                id="lgrip-color"
                group-name="Left Grip" 
                color="${griplColor}"
            ></group-rgb-picker>

            <group-rgb-picker 
                id="rgrip-color"
                group-name="Right Grip" 
                color="${griprColor}"
            ></group-rgb-picker>

            <h3 class="devinfo">Build: ${String(gamepad.device_static.fw_version)}</h3>
    `;

    /** @type {MultiPositionButton} */
    const modeSelector = container.querySelector('multi-position-button[id="default-mode-selector"]');
    modeSelector.addEventListener('change', async (e) => {
        console.log("Default mode change");
        gamepad.gamepad_cfg.gamepad_default_mode = e.detail.selectedIndex;
        await writeGamepadMemBlock();
    });

    const macSelector = container.querySelector('mac-address-selector');
    const bodyPicker = container.querySelector('group-rgb-picker[id="body-color"]');
    const buttonPicker = container.querySelector('group-rgb-picker[id="button-color"]');
    const lgripPicker = container.querySelector('group-rgb-picker[id="lgrip-color"]');
    const rgripPicker = container.querySelector('group-rgb-picker[id="rgrip-color"]');

    bodyPicker.addEventListener('color-change', async (e) => {
        let u32color = hexToUint32Rgb(e.detail.color);
        gamepad.gamepad_cfg.gamepad_color_body = u32color;
        await writeGamepadMemBlock();
    });

    buttonPicker.addEventListener('color-change', async (e) => {
        let u32color = hexToUint32Rgb(e.detail.color);
        gamepad.gamepad_cfg.gamepad_color_buttons = u32color;
        await writeGamepadMemBlock();
    });

    lgripPicker.addEventListener('color-change', async (e) => {
        let u32color = hexToUint32Rgb(e.detail.color);
        gamepad.gamepad_cfg.gamepad_color_grip_left = u32color;
        await writeGamepadMemBlock();
    });

    rgripPicker.addEventListener('color-change', async (e) => {
        let u32color = hexToUint32Rgb(e.detail.color);
        gamepad.gamepad_cfg.gamepad_color_grip_right = u32color;
        await writeGamepadMemBlock();
    });

    enableTooltips(container);

    console.log(gamepad.gamepad_cfg);
}