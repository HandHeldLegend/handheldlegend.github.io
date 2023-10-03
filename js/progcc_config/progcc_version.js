const CONFIG_DEVICES = 
{
    0xA001 : 0x0A15, // ProGCC 3
};

const FW_CHANGELOG = 
{
    0xA001 : // ProGCC 3
    `10.2.2023r2 Update:<br>
    - Adds dual Z map option<br>
    - Adjust rumble sensitivity parameters<br>
    - Test fix for rumble disabling mid-play<br>
    - Forcing rumble fix update<br>
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