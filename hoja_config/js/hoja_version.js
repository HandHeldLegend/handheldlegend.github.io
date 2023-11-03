const DEVICE_FW_VERSIONS = 
{
    0xA001 : 0x0A18, // ProGCC 3
    0xA002 : 0x0A00, // ProGCC 3+
    0xB001 : 0x0A00, // SuperGamepad+
    0xB002 : 0x0A00, // UniSNES
    0xA00A : 0x0A00, // ThingamaPro (Esca)
};

const MODEM_FW = 0xA001; // Current BT Modem firmware

const FW_CHANGELOG = 
{
    0xA001 : // ProGCC 3
    `11.3.2023 Update:<br>
    - Update rumble range.<br>
    `,
    0xA002 : // ProGCC 3+
    `11.3.2023 Update:<br>
    - Initial firmware
    `,
    0xB001 : // SuperGamepad+
    `11.3.2023 Update:<br>
    - Initial firmware
    `,
    0xB002 : // UniSNES
    `11.3.2023 Update:<br>
    - Initial firmware
    `,
};

const INIT_INSTRUCTIONS = 
{
    0xA001 : // ProGCC 3
    `Hold the 'Sync' button on the top<br>
    of the controller while plugging it in.<br>
    Download the firmware using the below button<br>
    then drag the file to the RP USB device in <br>
    Finder/File Explorer.
    `,
    0xB001 : // SuperGamepad+
    `Hold the 'B' button on the<br>
    controller while plugging it in.<br>
    Download the firmware using the below button<br>
    then drag the file to the RP USB device in <br>
    Finder/File Explorer.
    `,
}

const FW_UPDATE_URLS = 
{
    0xA001 : "https://github.com/HandHeldLegend/ProGCC-V3-RP2040/raw/main/build/PROGCC_RP2040.uf2", // ProGCC 3
    0xA002 : "https://github.com/HandHeldLegend/ProGCC-V3-Plus/raw/master/FW/build/PROGCCPLUS_RP2040.uf2",  // ProGCC 3+
    0xB001 : "https://github.com/mitchellcairns/SuperGamepadPlus/raw/master/FW/build/SUPERGAMEPAD_RP2040.uf2",  // SuperGamepad+
    0xB002 : "https://github.com/HandHeldLegend/UniSNES/raw/master/FW/build/UNISNES_RP2040.uf2",  // UniSNES
    0xA00A : "https://github.com/mitchellcairns/HOJA-ThingamaPro/raw/master/build/THINGAMAPRO_RP2040.uf2"   // ThingamaPro
};

function replace_firmware_strings(id)
{
    console.log("Get changelog for " + id);
    var e = document.getElementById("fwChangeLog");
    e.innerHTML = FW_CHANGELOG[id];

    var f = document.getElementById("downloadLink");
    f.setAttribute('href', FW_UPDATE_URLS[id]);

    
}

function enable_firmware_initialization_check()
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

enable_firmware_initialization_check();

function enable_baseband_check()
{
    // Get the current URL
    const url = new URL(window.location.href);

    // Try to get the 'init' parameter value
    const initValue = url.searchParams.get('baseband');

    if(initValue)
    {
        var bb = document.getElementById('baseband-box').setAttribute('disabled', 'false');
    }
}

enable_baseband_check();