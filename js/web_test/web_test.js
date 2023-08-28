// Use these to filter devices
const ID_NINTENDO = 0x057E;
const ID_PROCON = 0x2009;

const SUBCMD_SPI_READ = 0x10;
const SUBCMD_DEV_INFO = 0x02;
const INPUT_REPORT_ID_STANDARD = 0x21;

const SUBCMD_22 = 0x22;

const SPI_READ_ADDR_LOW_IDX = 14;
const SPI_READ_ADDR_HIGH_IDX = 15;
const SPI_READ_DATA_LEN_IDX = 18;
const SPI_READ_DATA_IDX = 19;

const   SUBCMD_REPORT_MODE = 0x03;
const   REPORT_MODE_FULL    = 0x30;
const   SUBCMD_READ_IMU_REG = 0x43;

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

function bytesToSignedIntLE(byte1, byte2) {
  // Concatenate the two bytes to form a 16-bit integer in little-endian order
  const unsignedInt16 = (byte2 << 8) | byte1;

  // Check if the most significant bit (MSB) is set
  const isNegative = (unsignedInt16 & 0x8000) !== 0;

  // Convert to signed 16-bit integer if negative
  if (isNegative) {
    // Subtract 2^16 to get the appropriate negative value
    return unsignedInt16 - Math.pow(2, 16);
  } else {
    return unsignedInt16; // Positive value, no change needed
  }
}

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

      case SUBCMD_22:
        devInfoCmdReturn(data);
        break;

      case SUBCMD_READ_IMU_REG:
        devInfoCmdReturn(data);
        reg_dat = data.getUint8(INPUT_SUBCMD_REPLY_ID_IDX+3);
        document.getElementById("register_out").value = reg_dat;
    }
  }
  else if (reportId == REPORT_MODE_FULL) {
    log_analog_data(data);
  }
}

var regToRead = 0;

// Sends command to change input mode to desired
async function sendInputModeChange()
{
    if (device.opened)
    {
        console.log("Sending Input Mode Change Command...");
        inc_gpn_out();
        data = [global_packet_number_out,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            SUBCMD_REPORT_MODE, REPORT_MODE_FULL];
        try
        {
            await device.sendReport(0x01, new Uint8Array(data));
        }
        catch (e) {
            console.error(e.message);
        }
    }
}

// Sends command to see what returns
async function sendCommand(command, data)
{
    if (device.opened)
    {
        console.log("Sending Input Mode Change Command...");
        inc_gpn_out();
        data = [global_packet_number_out,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            command, data];
        try
        {
            await device.sendReport(0x01, new Uint8Array(data));
        }
        catch (e) {
            console.error(e.message);
        }
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

    await sendInputModeChange();

    console.log("Connected.");
  }

  //return 1;
}

var log_x = "2048\n";
var log_y = "2048\n";
var log_count = 1000;

function log_analog_data(data)
{
    if(!log_count) return;

    log_count--;
    
    var l0 = data.getUint8(5);
    var l1 = data.getUint8(6);
    var l2 = data.getUint8(7);

    var r0 = data.getUint8(8);
    var r1 = data.getUint8(9);
    var r2 = data.getUint8(10);

    var x = l0 | ((l1 & 0xF) << 8);
    var y = (l1 >> 4) | (l2 << 4);

    var cx = r0 | ((r1 & 0xF) << 8);
    var cy = (r1 >> 4) | (r2 << 4);

    if(log_count == 0)
    {
        console.log("Done logging.");
        console.log("OUTPUT X:\n");
        console.log(log_x);
        console.log("OUTPUT Y:\n");
        console.log(log_y);
    }
    else
    {
        log_x += x.toString() + "\n";
        log_y += y.toString() + "\n";
    }

}
