import HojaGamepad from './gamepad/gamepad.js';

let gamepad = HojaGamepad.getInstance();

const connectBtn = document.getElementById('connect');
const disconnectBtn = document.getElementById('disconnect');
const sendCommandBtn = document.getElementById('sendCommand');
const commandInput = document.getElementById('command');
const payloadInput = document.getElementById('payload');
const logDiv = document.getElementById('log');

function log(message) {
    const timestamp = new Date().toLocaleTimeString();
    logDiv.innerHTML += `<div>[${timestamp}] ${message}</div>`;
    logDiv.scrollTop = logDiv.scrollHeight;
}

connectBtn.addEventListener('click', async () => {
    try {
        await gamepad.connect();
        log('Connected to gamepad.');
    } catch (error) {
        log(`Connection failed: ${error.message}`);
    }
});

disconnectBtn.addEventListener('click', async () => {
    try {
        await gamepad.disconnect();
        log('Disconnected from gamepad.');
    } catch (error) {
        log(`Disconnection failed: ${error.message}`);
    }
});

sendCommandBtn.addEventListener('click', async () => {
    const commandHex = commandInput.value.trim();
    const payloadHex = payloadInput.value.trim();

    try {
        if (!commandHex) {
            log('Command is required.');
            return;
        }

        const command = parseInt(commandHex, 16);
        if (isNaN(command)) {
            log('Invalid command.');
            return;
        }

        const payload = payloadHex
            .split(/\s+/)
            .filter(Boolean)
            .map(value => parseInt(value, 16));

        if (payload.some(isNaN)) {
            log('Invalid payload. Ensure all values are valid hex.');
            return;
        }

        await gamepad.sendCommand(command, new Uint8Array(payload));
        log(`Command 0x${command.toString(16)} sent with payload: ${payload.map(b => `0x${b.toString(16)}`).join(' ')}`);
    } catch (error) {
        log(`Failed to send command: ${error.message}`);
    }
});

gamepad.on('connect', () => log('Event: Gamepad connected.'));
gamepad.on('disconnect', () => log('Event: Gamepad disconnected.'));
gamepad.on('report', data => log(`Event: Report received - ${Array.from(data).map(b => `0x${b.toString(16)}`).join(' ')}`));