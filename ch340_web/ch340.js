let device;
let terminal = document.getElementById('terminal');
let connectButton = document.getElementById('connectButton');
let disconnectButton = document.getElementById('disconnectButton');
let baudRateSelect = document.getElementById('baudRate');
let confirmBaudRateButton = document.getElementById('confirmBaudRate');
let textInput = document.getElementById('textInput');
let sendTextButton = document.getElementById('sendTextButton');
let sendHexButton = document.getElementById('sendHexButton');

let interfaceNumber = null;
let inEndpointNumber = null;
let outEndpointNumber = null;

connectButton.addEventListener('click', async () => {
    try {
        device = await navigator.usb.requestDevice({ filters: [{ vendorId: 0x1A86 }] });
        await device.open();

        // Automatically select the first interface with both IN and OUT endpoints
        const configuration = device.configuration || await device.selectConfiguration(1);
        for (const iface of configuration.interfaces) {
            for (const endpoint of iface.alternate.endpoints) {
                if (endpoint.direction === 'in') {
                    inEndpointNumber = endpoint.endpointNumber;
                } else if (endpoint.direction === 'out') {
                    outEndpointNumber = endpoint.endpointNumber;
                }
            }
            if (inEndpointNumber !== null && outEndpointNumber !== null) {
                interfaceNumber = iface.interfaceNumber;
                break;
            }
        }

        if (interfaceNumber === null || inEndpointNumber === null || outEndpointNumber === null) {
            throw new Error('No suitable interface found');
        }

        await device.claimInterface(interfaceNumber);

        terminal.textContent += 'Connected to CH340K\n';
        connectButton.disabled = true;
        disconnectButton.disabled = false;
        confirmBaudRateButton.disabled = false;
        sendTextButton.disabled = false;
        sendHexButton.disabled = false;

        readLoop(); // Start reading data
    } catch (error) {
        console.error(error);
        terminal.textContent += 'Error: ' + error.message + '\n';
    }
});

disconnectButton.addEventListener('click', async () => {
    if (device) {
        await device.close();
        terminal.textContent += 'Disconnected\n';
        connectButton.disabled = false;
        disconnectButton.disabled = true;
        confirmBaudRateButton.disabled = true;
        sendTextButton.disabled = true;
        sendHexButton.disabled = true;
    }
});

confirmBaudRateButton.addEventListener('click', async () => {
    let baudRate = baudRateSelect.value;
    if (device) {
        try {
            // Command to set baud rate would be sent here
            terminal.textContent += `Baud rate set to ${baudRate}\n`;
        } catch (error) {
            console.error(error);
            terminal.textContent += 'Error: ' + error.message + '\n';
        }
    }
});

sendTextButton.addEventListener('click', async () => {
    let text = textInput.value;
    if (device && text) {
        try {
            let encoder = new TextEncoder();
            let data = encoder.encode(text);
            await device.transferOut(outEndpointNumber, data);
            terminal.textContent += `Sent: ${text}\n`;
        } catch (error) {
            console.error(error);
            terminal.textContent += 'Error: ' + error.message + '\n';
        }
    }
});

sendHexButton.addEventListener('click', async () => {
    let hexString = textInput.value.replace(/ /g, ''); // Remove spaces
    if (device && hexString) {
        try {
            let bytes = hexString.match(/.{1,2}/g).map(byte => parseInt(byte, 16));
            let data = new Uint8Array(bytes);
            await device.transferOut(outEndpointNumber, data);
            terminal.textContent += `Sent (Hex): ${hexString}\n`;
        } catch (error) {
            console.error(error);
            terminal.textContent += 'Error: ' + error.message + '\n';
        }
    }
});

async function readLoop() {
    while (device && device.opened) {
        try {
            const result = await device.transferIn(inEndpointNumber, 64);
            let decoder = new TextDecoder();
            let data = decoder.decode(result.data);
            terminal.textContent += data;
            terminal.scrollTop = terminal.scrollHeight;
        } catch (error) {
            console.error(error);
            terminal.textContent += 'Error: ' + error.message + '\n';
            break;
        }
    }
}
