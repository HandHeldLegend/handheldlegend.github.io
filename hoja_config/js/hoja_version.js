const DEVICE_FW_VERSIONS = 
{
    0xA001 : 0x0A16, // ProGCC 3
    0xA002 : 0x0A00, // ProGCC 3+
    0xB001 : 0x0A00, // SuperGamepad+
};

const MODEM_FW = 0xA001; // Current BT Modem firmware

const FW_CHANGELOG = 
{
    0xA001 : // ProGCC 3
    `10.4.2023 Update:<br>
    - Add new rumble floor option.<br>
    - This allows calibration for different rumble resistance.<br>
    `,
    0xA002 : // ProGCC 3+
    `10.4.2023 Update:<br>
    - Add new rumble floor option.<br>
    - This allows calibration for different rumble resistance.<br>
    `,
    0xB001 : // SuperGamepad+
    `10.4.2023 Update:<br>
    - Add new rumble floor option.<br>
    - This allows calibration for different rumble resistance.<br>
    `,
    0xB002 : // UniSNES
    `10.4.2023 Update:<br>
    - Add new rumble floor option.<br>
    - This allows calibration for different rumble resistance.<br>
    `,
}

const FW_UPDATE_URLS = 
{
    0xA001 : "https://github.com/HandHeldLegend/ProGCC-V3-RP2040/raw/main/build/PROGCC_RP2040.uf2", // ProGCC 3
    0xA002 : "google.com",
    0xB001 : "google.com",
    0xB002 : "google.com",
};

function replace_firmware_strings(id)
{
    console.log("Get changelog for " + id);
    var e = document.getElementById("fwChangeLog");
    e.innerHTML = FW_CHANGELOG[id];
    var f = document.getElementById("downloadLink");
    f.setAttribute('href', FW_UPDATE_URLS[id]);
}