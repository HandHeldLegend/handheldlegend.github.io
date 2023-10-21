const CONFIG_DEVICES = 
{
    0xA000 : 0x0A00, // GCPocket (ESP32-S3)
    0xA001 : 0x0A00, // GCPocket+ (RP2040)
};

const FW_CHANGELOG = 
{
    0xA000 : // GCPocket (ESP32-S3)
    `10.3.2023 Update:<br>
    - No changes
    `,

    0xA001 : // GCPocket+ (RP2040)
    `10.3.2023 Update:<br>
    - No changes
    `
}

const FW_UPDATE_URLS = 
{
    0xA000 : "google.com",
    0xA001 : "google.com",
};

function replace_firmware_strings(id)
{
    console.log("Get changelog for " + id);
    var e = document.getElementById("fwChangeLog");
    e.innerHTML = FW_CHANGELOG[id];
}