let ch341Device;

function log(message) {
    const output = document.getElementById('output');
    output.innerHTML += message + '<br>';
}

document.getElementById('initDevice').addEventListener('click', async () => {
    try {
        ch341Device = await CH341SER.create();
        log('Device initialized successfully');
    } catch (error) {
        log('Failed to initialize device: ' + error.message);
    }
});

document.getElementById('configure').addEventListener('click', async () => {
    if (!ch341Device) {
        log('Please initialize the device first');
        return;
    }
    const result = await ch341Device.configure();
    log('Configuration result: ' + result);
});

document.getElementById('setDtrRts').addEventListener('click', async () => {
    if (!ch341Device) {
        log('Please initialize the device first');
        return;
    }
    await ch341Device.setDtrRts(true);
    log('DTR/RTS set');
});

document.getElementById('getStatus').addEventListener('click', async () => {
    if (!ch341Device) {
        log('Please initialize the device first');
        return;
    }
    const status = await ch341Device.getStatus();
    log('Device status: ' + status);
});

document.getElementById('readData').addEventListener('click', async () => {
    if (!ch341Device) {
        log('Please initialize the device first');
        return;
    }
    const data = await ch341Device.read(64);  // Read 64 bytes
    log('Read data: ' + new TextDecoder().decode(data));
});

document.getElementById('writeData').addEventListener('click', async () => {
    if (!ch341Device) {
        log('Please initialize the device first');
        return;
    }
    const data = new TextEncoder().encode('Hello, CH341!');
    const bytesWritten = await ch341Device.write(data);
    log('Bytes written: ' + bytesWritten);
});