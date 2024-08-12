const HOJA_BACKEND_VERSION = 0x0001; // Current backend firmware (Old called settings version)

const HOJA_BASEBAND_VERSION = 0xA013; // Current BT Modem firmware

const INIT_INSTRUCTIONS = 
{
    0xA001 : // ProGCC 3
    `Hold the 'Sync' button on the top<br>
    of the controller while plugging it in.<br>
    Download the firmware using the below button<br>
    then drag the file to the RP USB device in <br>
    Finder/File Explorer.
    `,
    0xA002 : // ProGCC 3+ (OG Vibration model)
    `No init instructions for this device yet.
    `,
    0xB001 : // SuperGamepad+
    `Hold the 'B' button on the<br>
    controller while plugging it in.<br>
    Download the firmware using the below button<br>
    then drag the file to the RP USB device in <br>
    Finder/File Explorer.
    `,

    0xC001 : // GC Ultimate
    `Please ask Mitch for instructions on flashing.`,

    0xF001 : // Phob 2.1
    `Hold the 'Start' button while plugging in.<br>
    Download the firmware using the below button<br>
    then drag the file to the RP USB device in <br>
    Finder/File Explorer.
    `
}

const DEVICE_BT_FW_MANIFEST_URL = "https://raw.githubusercontent.com/HandHeldLegend/HOJA-ESP32-Baseband/master/manifest.json";

const DEVICE_FW_MANIFEST_URLS = 
{
    0xA001  : "https://raw.githubusercontent.com/HandHeldLegend/ProGCC-V3-RP2040/main/PROGCC_RP2040_manifest.json",
    0xA002  : "https://raw.githubusercontent.com/HandHeldLegend/ProGCC-V3-Plus/master/FW/PROGCCPLUS_ERM_RP2040_manifest.json", // ProGCC 3+
    0xA004  : "https://raw.githubusercontent.com/HandHeldLegend/ProGCC-V3-Plus/master/FW/PROGCC3.1_RP2040_manifest.json", // ProGCC 3.1

    0xB001  : "https://raw.githubusercontent.com/HandHeldLegend/SuperGamepadPlus/master/FW/SUPERGAMEPAD_RP2040_manifest.json",  // SuperGamepad+
    0xB002  : "https://raw.githubusercontent.com/HandHeldLegend/UniSNES/master/FW/UNISNES_RP2040_manifest.json",           // UniSNES

    0xC001  : "https://raw.githubusercontent.com/HandHeldLegend/GC-Ultimate/master/FW/GCULTIMATE_RP2040_manifest.json",       // GC Ultimate PROTOTYPE
    0xC002  : "https://raw.githubusercontent.com/HandHeldLegend/GC-Ultimate/master/FW/GCULTIMATE_R4_RP2040_manifest.json",       // GC Ultimate R4
    0xA00A  : "https://raw.githubusercontent.com/mitchellcairns/HOJA-ThingamaPro/master/THINGAMAPRO_RP2040_manifest.json", // ThingamaPro (Esca)

    0xD001  : "https://raw.githubusercontent.com/HandHeldLegend/HOJA-Fightingbox-Mini/main/manifest.json", // Fightingbox mini (https://github.com/Fightingbox/Fightingbox-mini)

    0xF001  : "https://raw.githubusercontent.com/HandHeldLegend/HOJA-PHOB-2.1/main/HOJA-PHOB_manifest.json"           // Phob 2.1
}

const FW_UPDATE_URLS = 
{
    0xA001 : "https://raw.githubusercontent.com/HandHeldLegend/ProGCC-V3-RP2040/main/build/PROGCC_RP2040",                 // ProGCC 3
    0xA002 : "https://raw.githubusercontent.com/HandHeldLegend/ProGCC-V3-Plus/master/FW/build/PROGCCPLUS_ERM_RP2040",      // ProGCC 3+
    0xA004 : "https://raw.githubusercontent.com/HandHeldLegend/ProGCC-V3-Plus/master/FW/build/PROGCC3.1_RP2040",           // ProGCC 3.1

    0xB001 : "https://raw.githubusercontent.com/mitchellcairns/SuperGamepadPlus/master/FW/build/SUPERGAMEPAD_RP2040",      // SuperGamepad+
    0xB002 : "https://raw.githubusercontent.com/HandHeldLegend/UniSNES/master/FW/build/UNISNES_RP2040",                    // UniSNES
    0xC001  : "https://raw.githubusercontent.com/HandHeldLegend/GC-Ultimate/master/FW/build/GCULTIMATE_RP2040", // GC Ultimate
    0xC002  : "https://raw.githubusercontent.com/HandHeldLegend/GC-Ultimate/master/FW/build/GCULTIMATE_R4_RP2040", // GC Ultimate R4,
    0xA00A : "https://raw.githubusercontent.com/mitchellcairns/HOJA-ThingamaPro/master/build/THINGAMAPRO_RP2040",          // ThingamaPro

    0xF001  : "https://raw.githubusercontent.com/HandHeldLegend/HOJA-PHOB-2.1/main/build/HOJA-PHOB"             // Phob 2.1
};

function devices_firmware_initialization_check()
{
    // Get the current URL
    const url = new URL(window.location.href);

    // Try to get the 'init' parameter value
    const initValue = url.searchParams.get('init');
    const initNum = Number(initValue)
    
    if(initNum in FW_UPDATE_URLS)
    {
        var iff = document.getElementById("downloadLinkInitial");
        iff.setAttribute('href', FW_UPDATE_URLS[initNum]);

        document.getElementById("initialize-board-box").setAttribute('disabled', 'false');

        // Replace text for instruction
        document.getElementById("fwInitializeInstructions").innerHTML = INIT_INSTRUCTIONS[initNum];
    }
}
