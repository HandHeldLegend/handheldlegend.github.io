const CONFIG_DEVICES = 
{
    0xA001 : 0x0A13, // ProGCC 3
};

const FW_CHANGELOG = 
{
    0xA001 : // ProGCC 3
    `10.2.2023 Update:<br>
    - Adds dual Z map option<br>
    - Adjust rumble sensitivity parameters<br>
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