const { ESPLoader, FlashOptions, LoaderOptions, Transport } = require('esptool-js');
const { serial } = require('web-serial-polyfill');

// Always set our navigator serial to equal our polyfill serial
navigator.serial = serial;

const terminal = document.getElementById('terminal');

function logToTerminal(message) {
  if (terminal.textContent == '') {
    terminal.textContent = message + '\n';
    return;
  }
  terminal.textContent += message + '\n';
  terminal.scrollTop = terminal.scrollHeight;
}

const filters = [{ usbVendorId: 0x1A86, usbProductId: 0x7522 }];

const bootloaderUrl = "https:\/\/raw.githubusercontent.com\/HandHeldLegend\/HOJA-ESP32-Baseband\/master\/build\/bootloader\/bootloader.bin";
const partitionTableURL = "https:\/\/raw.githubusercontent.com\/HandHeldLegend\/HOJA-ESP32-Baseband\/master\/build\/partition_table\/partition-table.bin";
const firmwareURL = "https:\/\/raw.githubusercontent.com\/HandHeldLegend\/HOJA-ESP32-Baseband\/master\/build\/ESP32.bin";
const bootloaderOffset = 4096;
const partitionTableOffset = 32768;
const firmwareOffset = 65536;

var globalBaudInt = 460800;

var bootloader = null;
var partitionTable = null;
var firmware = null;

var connected = false;
let device = null;
let transport = null;
let chip = null;
var esploader = null;

const espLoaderTerminal = {
  clean() {
    // Do nothing
  },
  writeLine(data) {
    logToTerminal(data);
  },
  write(data) {
    logToTerminal(data);
  },
};

const connectBtn = document.getElementById('connectBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const eraseBtn = document.getElementById('eraseBtn');
const flashBtn = document.getElementById('flashBtn');

function disableBtn(element) {
  element.setAttribute('disabled', 'true');
  element.delete
}

function enableBtn(element) {
  try {
    element.removeAttribute('disabled');
  } catch (error) {

  }
}

let hasRun = false;
document.addEventListener('DOMContentLoaded', (event) => {
  
  if (!hasRun) {
    hasRun = true;
    // Get baud if we want to change it
    // Check if 'baud' parameter is set to 'true'
    // Create a new URL object from the current page's URL
    const urlParams = new URLSearchParams(window.location.search);

    // Get the value of the 'debug' parameter
    var debug = urlParams.has('baud');
    if (debug) {
        console.log("Has custom baud: ");
        globalBaudInt = urlParams.get('baud');
        console.log(globalBaudInt);
    }
    else
    {
        console.log("No custom baud setting.");
    }

    // Add event listeners for buttons
    connectBtn.addEventListener('click', async () => {
      logToTerminal('Connecting...');
      // Add connect logic here

      try {
        if (device == null) {

          device = await navigator.serial.requestPort({ filters });
          transport = new Transport(device, true);
        }

        const flashOptions = {
          transport,
          baudrate: globalBaudInt,
          terminal: espLoaderTerminal,
        };

        esploader = new ESPLoader(flashOptions);
        chip = await esploader.main();

        // Temporarily broken
        // await esploader.flashId();

        console.log("Settings done for :" + chip);

        disableBtn(connectBtn);
        enableBtn(flashBtn);
        enableBtn(eraseBtn);
        enableBtn(disconnectBtn);

      } catch (e) {
        console.error(e);
        logToTerminal(`Error: ${e.message}`);
      }


    });

    disconnectBtn.addEventListener('click', () => {
      logToTerminal('Disconnecting does nothing. Reload the page.');
      // Add disconnect logic here
    });

    eraseBtn.addEventListener('click', async () => {
      logToTerminal('Erasing...');

      disableBtn(connectBtn);
      disableBtn(flashBtn);
      disableBtn(eraseBtn);
      disableBtn(disconnectBtn);
      // Add erase logic here

      try {
        await esploader.eraseFlash();
      } catch (e) {
        console.error(e);
        logToTerminal(`Error: ${e.message}`);
      } finally {
        disableBtn(connectBtn);
        enableBtn(flashBtn);
        enableBtn(eraseBtn);
        enableBtn(disconnectBtn);
      }
    });

    flashBtn.addEventListener('click', async () => {
      logToTerminal('Flashing...');
      // Add flash logic here

      disableBtn(connectBtn);
      disableBtn(flashBtn);
      disableBtn(eraseBtn);
      disableBtn(disconnectBtn);

      await fetchBinFileAsString(bootloaderUrl).then(data => {
        if (data) {
          logToTerminal('Got bootloader OK');
          bootloader = data;
        } else {
          logToTerminal('Failed to fetch bootloader.');
          return;
        }
      });

      await fetchBinFileAsString(partitionTableURL).then(data => {
        if (data) {
          logToTerminal('Got partition table OK');
          partitionTable = data;
        } else {
          logToTerminal('Failed to fetch partition table.');
          return;
        }
      });

      await fetchBinFileAsString(firmwareURL).then(data => {
        if (data) {
          logToTerminal('Got firmware OK');
          firmware = data;
        } else {
          logToTerminal('Failed to fetch firmware.');
          return;
        }
      });

      var fileArray = [];

      fileArray.push({ data: bootloader, address: bootloaderOffset });
      fileArray.push({ data: partitionTable, address: partitionTableOffset });
      fileArray.push({ data: firmware, address: firmwareOffset });

      try {
        const flashOptions = {
          fileArray: fileArray,
          flashSize: "keep",
          eraseAll: false,
          compress: true,
          reportProgress: (fileIndex, written, total) => {
            logToTerminal(String((written / total) * 100));
            //progressBars[fileIndex].value = 
          },
        };
        await esploader.writeFlash(flashOptions);
      } catch (e) {
        console.error(e);
        logToTerminal(`Error: ${e.message}`);
      } finally {
        // Hide progress bars and show erase buttons
        //for (let index = 1; index < table.rows.length; index++) {
        //  table.rows[index].cells[2].style.display = "none";
        //  table.rows[index].cells[3].style.display = "initial";
        //}
        logToTerminal(`Flashing is complete.\nPlease unplug your controller to finish the update.`);

        disableBtn(connectBtn);
        enableBtn(flashBtn);
        enableBtn(eraseBtn);
        enableBtn(disconnectBtn);
      }
    });

    hasRun = true;
  }
});

async function fetchBinFileAsString(url) {
  try {
    // Fetch the binary data from the URL
    const response = await fetch(url);

    // Check if the response is ok (status code 200-299)
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    // Read the response as an ArrayBuffer
    const arrayBuffer = await response.arrayBuffer();

    // Convert ArrayBuffer to BinaryString
    const binaryString = Array.from(new Uint8Array(arrayBuffer))
      .map(byte => String.fromCharCode(byte))
      .join('');

    return binaryString;
  } catch (error) {
    console.error('Error fetching the .bin file:', error);
    throw error; // Re-throw the error for the caller to handle
  }
}


