import HojaGamepad from '../js/gamepad.js';

import TextEntry from '../components/text-entry.js';

import { enableTooltips } from '../js/tooltips.js';

/** @type {HojaGamepad} */
let gamepad = HojaGamepad.getInstance();
const userCfgBlockNumber = 7;

async function writeUserMemBlock() {
    await gamepad.sendBlock(userCfgBlockNumber);
}

function encodeText(text, maxLength = 24) {
    // If maxLength is provided, truncate the text
    if (maxLength !== null) {
        text = text.slice(0, maxLength);
    }
    
    // Create encoder
    const encoder = new TextEncoder();
    
    // Encode the text
    const buffer = encoder.encode(text);
    
    // If maxLength was specified, ensure the buffer is exactly that length
    if (maxLength !== null) {
        // Create a new buffer of exact length
        const paddedBuffer = new Uint8Array(maxLength);
        // Fill with zeros
        paddedBuffer.fill(0);
        // Copy encoded text into padded buffer
        paddedBuffer.set(buffer.slice(0, maxLength));
        return paddedBuffer;
    }
    
    return buffer;
}

function decodeText(buffer) {
    const decoder = new TextDecoder('utf-8');
    const str = decoder.decode(buffer);
    
    // Remove any null characters (0x00) from the string
    return str.replace(/\x00/g, '');
}

export function render(container) {

    let userNameHTML = ``;

    let userNameDecoded = decodeText(gamepad.user_cfg.user_name.buffer);

    if(userNameDecoded == "")
    {
        userNameHTML = `
        <text-entry id="username-entry" placeholder="Enter username..." maxlength="24"></text-entry>
        `;
    }
    else
    {
        userNameHTML = `
        <text-entry id="username-entry" value="${userNameDecoded}"></text-entry>
        `
    }

    container.innerHTML = `
            <h2>Username</h2>
            ${userNameHTML}
    `;

    
    /** @type {TextEntry} */
    const usernameEntryBox = container.querySelector('text-entry[id="username-entry"]');
    usernameEntryBox.addEventListener('change', async (e) => {
        console.log("Username updated.");
        gamepad.user_cfg.user_name = encodeText(e.detail.value);
        await writeUserMemBlock();
    });
}