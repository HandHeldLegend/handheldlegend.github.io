// Use these to filter devices
const ID_NINTENDO = 0x057E;
const ID_PROCON = 0x2009;

const SUBCMD_SPI_READ = 0x10;
const SUBCMD_DEV_INFO = 0x02;
const INPUT_REPORT_ID_STANDARD = 0x21;

const SPI_READ_ADDR_LOW_IDX = 14;
const SPI_READ_ADDR_HIGH_IDX = 15;
const SPI_READ_DATA_LEN_IDX = 18;
const SPI_READ_DATA_IDX = 19;

const   INPUT_SUBCMD_DATA_IDX       = 14;
const   INPUT_SUBCMD_REPLY_ID_IDX   = 13;

global_packet_number_out = 0;
device = null;

function inc_gpn_out() {
  global_packet_number_out += 1;
  if (global_packet_number_out > 0xF) {
    global_packet_number_out = 0;
  }
}

const dev_filters = [
  {
    vendorId: ID_NINTENDO,
    productId: ID_PROCON
  }
];

// Send a command to read SPI data
async function sendSpiReadCmd(addressUpper, addressLower, length) {
  if (device.opened) {
    console.log("Sending SPI Read Command...");
    inc_gpn_out();
    data = [global_packet_number_out,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      SUBCMD_SPI_READ, addressLower, addressUpper, 0x00, 0x00, length];

    try {
      await device.sendReport(0x01, new Uint8Array(data));
    }
    catch (e) {
      console.error(e.message);
    }
  }
}

// Return function for SPI reading
function spiReadCmdReturn(addressUpper, addressLower, length, full_data) {
  console.log("Got SPI Read Data");
  console.log("Upper: " + addressUpper);
  console.log("lower: " + addressLower);
  console.log(full_data);
}

// Sends command to get device info
async function sendDevInfoCmd()
{
    if (device.opened)
    {
        console.log("Sending device get info Command...");
        inc_gpn_out();
        data = [global_packet_number_out,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            SUBCMD_DEV_INFO, 0];
        try
        {
            await device.sendReport(0x01, new Uint8Array(data));
        }
        catch (e) {
            console.error(e.message);
        }
    }
}

function devInfoCmdReturn(full_data)
{
  console.log(full_data);
}

// CONNECT and DISCONNECT functions
async function doConnect() {

  // Set up disconnect listener
  navigator.hid.addEventListener('disconnect', ({ device }) => {
    onDeviceDisconnect(device);
  });

  await openDevice();
}

function doDisconnect() {
  if (device.opened) {
    device.close();
  }
}

async function openDevice() {
  devices = await navigator.hid.getDevices();
  device = devices.find(d => d.vendorId === ID_PROCON);

  if (!device) {
    devices = await navigator.hid.requestDevice({ filters: dev_filters });

    device = devices[0];
    // Wait for device to open
    if (!device.opened) {
      await device.open();
    }

    device.addEventListener('inputreport', (event) => {
      handleInputReport(event);
    });
  }

  return 1;
}

// HOOK functions/Callback functions

// Handle incoming input reports
function handleInputReport(e) {
  const { data, device, reportId } = e;

  if (reportId == INPUT_REPORT_ID_STANDARD) {
    switch (data.getUint8(INPUT_SUBCMD_REPLY_ID_IDX)) {
      default:
        console.log("No SUBCMD response.");
        console.log(data);
        break;

      case SUBCMD_SPI_READ:
        spiReadCmdReturn(data.getUint8(SPI_READ_ADDR_HIGH_IDX), data.getUint8(SPI_READ_ADDR_LOW_IDX),
          data.getUint8(SPI_READ_DATA_LEN_IDX), data);
        break;

      case SUBCMD_DEV_INFO:
        devInfoCmdReturn(data);
        break;
    }
  }
  else if (reportId == REPORT_MODE_FULL) {
    if (input_mode_set && calibration_loaded) {
      translateInputAnalog(data);
    }
  }
}
