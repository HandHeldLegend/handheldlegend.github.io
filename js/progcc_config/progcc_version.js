const CONFIG_DEVICES = 
{
    0xA001 : 0x0A12, // ProGCC 3
};

const FW_CHANGELOG = 
{
    0xA001 : // ProGCC 3
    `9.22.2023 Update:<br>
    - Fixes USB issue with Slippi<br>
    - Adds light trigger adjustment<br>
    - Add SNES/NES Classic mode<br>
    - Add training mode reset SP option for GC Input<br>
    `
}

const FW_UPDATE_URLS = 
{
    0xA001 : "google.com",
};

function replace_firmware_strings(id)
{
    console.log("Get changelog for " + id);
    var e = document.getElementById("fwChangeLog");
    e.innerHTML = FW_CHANGELOG[id];
}