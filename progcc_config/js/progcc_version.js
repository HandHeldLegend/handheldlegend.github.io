const CONFIG_DEVICES = 
{
    0xA001 : 0x0A16, // ProGCC 3
};

const FW_CHANGELOG = 
{
    0xA001 : // ProGCC 3
    `10.4.2023 Update:<br>
    - Add new rumble floor option.<br>
    - This allows calibration for different rumble resistance.<br>
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