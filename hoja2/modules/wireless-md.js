import HojaGamepad from '../js/gamepad.js';

import NumberSelector from '../components/number-selector.js';
import MultiPositionButton from '../components/multi-position-button.js';
import GroupRgbPicker from '../components/group-rgb-picker.js';
import AngleSelector from '../components/angle-selector.js';
import RemapSelector from '../components/remap-selector.js';

import TristateButton from '../components/tristate-button.js';
import SingleShotButton from '../components/single-shot-button.js';

import { enableTooltips } from '../js/tooltips.js';

const basebandCmd = 2;
const gamepadCfgBlock = 0;
const btManifestUrl = "https://raw.githubusercontent.com/HandHeldLegend/HOJA-ESP32-Baseband/master/manifest.json";
/** @type {HojaGamepad} */
const gamepad = HojaGamepad.getInstance();

const parseWirelessBufferText = buffer => {
    const text = new TextDecoder().decode(buffer).trim();
    // Log each character code to see what's actually in there
    //console.log('Character codes:', [...text].map(c => c.charCodeAt(0)));
    
    // Remove any null bytes or other whitespace and then check
    const cleanText = text.replace(/\0+/g, '').trim();
    return cleanText === '~' ? false : cleanText;
};


async function getCurrentBasebandVersion() {
    let response = await fetch(btManifestUrl);

    if(response.ok) {
        const data = await response.json();
        if(data.fw_version) return data.fw_version;
        else return false;
    }
}

export async function render(container) {

    let fccId = parseWirelessBufferText(gamepad.device_static.fcc_id);
    console.log(fccId);

    let showElabel = false;
    if(fccId !== false) { 
        showElabel = true;
    }

    const currentBasebandVersion = await getCurrentBasebandVersion();

    console.log("This baseband: " + gamepad.bluetooth_static.baseband_version);
    console.log("Newest baseband: " + currentBasebandVersion);

    let updateSegment = `
    <div class="app-text-container">
    Baseband is up to date.
    </div>
    `;

    let regulationSegment = `
    <h2>Regulatory Information</h2>
    <div class="app-text-container">
        <strong>FCC ID: ${fccId}</strong>
        <br>
        This device complies with Part 15 of the
        FCC Rules. Operation is subject to the
        following two conditions: (1) This device
        may not cause harmful interference, and (2)
        This device must accept any interference
        received, including interference that may
        cause undesired operation. 
    </div>
    `

    if(!showElabel) {
        regulationSegment = "";
    }

    if(gamepad.bluetooth_static.baseband_version < currentBasebandVersion) {
        updateSegment = `
        <div class="app-row">
            <single-shot-button id="baseband-button" state="ready" ready-text="Enter Baseband Mode" disabled-text="..."
                pending-text="Entering..." failure-text="Not connected." success-text="Entering..."
            ></single-shot-button>

            <single-shot-button id="open-update-page-button" state="ready" ready-text="Update Tool" disabled-text="..."
                pending-text="Opening..." failure-text="Opening..." success-text="Opening..."
            ></single-shot-button>

            <single-shot-button id="open-update-guide-button" state="ready" ready-text="Update Guide" disabled-text="..."
                pending-text="Opening..." failure-text="Opening..." success-text="Opening..."
            ></single-shot-button>
        </div>
        <div visible="true" class="app-text-container">
            To update your wireless firmware, first, click the 'Enter Baseband Mode' button. 
            Your indicator light/lights will begin to flash orange. At this point, you may click the 'Update Tool'
            to open the appropriate page to begin the update process. Follow all instructions from the update tool
            to properly update your device.
        </div>
        `;
    }

    container.innerHTML = `
    <h2>Baseband Update</h2>
    ${updateSegment}
    ${regulationSegment}
    `;

    if(gamepad.bluetooth_static.baseband_version < currentBasebandVersion) {
        const basebandButton = container.querySelector('single-shot-button[id="baseband-button"]');
        const openToolButton = container.querySelector('single-shot-button[id="open-update-page-button"]');
        const openGuideButton = container.querySelector('single-shot-button[id="open-update-guide-button"]');

        basebandButton.setOnClick(async () => {
            try {
                if(gamepad) {
                    gamepad.sendConfigCommand(gamepadCfgBlock, basebandCmd);
                    return true;
                }
                return false;
            }
            catch(e) {
                return false;
            }
        });

        openToolButton.setOnClick(() => {
            window.open("https://handheldlegend.github.io/hoja_baseband/", '_blank');
            return true;
        });

        openGuideButton.setOnClick(() => {
            window.open("https://docs.handheldlegend.com/s/portal/doc/esp32-baseband-update-page-vhX2Im50kN", '_blank');
            return true;
        });
    }   
    
}