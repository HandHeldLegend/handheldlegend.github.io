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

function version_init_enable(value)
{
    // Perform check based on the 'init' value
    switch (value) {
        case 'gcpplus':
            console.log('Init value is gcpplus');
            document.getElementById('rp2040-initialize-board-box').setAttribute('disabled', 'false');
            break;

        case 'gcp':
            console.log('Init value is gcp');
            document.getElementById('esp32-initialize-board-box').setAttribute('disabled', 'false');
            break;
        default:
            console.log('Unknown init value:', initValue);
            break;
    }
}

function version_initialization()
{
    // Get the current URL
    const url = new URL(window.location.href);

    // Try to get the 'init' parameter value
    const initValue = url.searchParams.get('init');

    if (initValue) {
        version_init_enable(initValue);
    } else {
        console.log('No init parameter found.');
    }
}

function replace_firmware_strings(id)
{
    console.log("Get changelog for " + id);
    var e = document.getElementById("fwChangeLog");
    e.innerHTML = FW_CHANGELOG[id];
}

version_initialization();