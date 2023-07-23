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

var inputLogging = true;

function toggleLogging()
{
  inputLogging = !inputLogging;
}

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

function logGyro(data)
{
  // x is tilting left and right
  // y is forward/backward tilting
  // Z is turning left/right

  var idx = 18;
  var zo = bytesToSignedIntLE(data.getUint8(idx+1), data.getUint8(idx));
  var zo1 = bytesToSignedIntLE(data.getUint8(idx+12), data.getUint8(idx+12+1));
  var zo2 = bytesToSignedIntLE(data.getUint8(idx+24), data.getUint8(idx+24+1));
  var za = Math.round((zo+zo1+zo2)/3);

  console.log(data.getUint8(idx) + " | " + data.getUint8(idx+1));
}

// Handle incoming input reports
function handleInputReport(e) {
  const { data, device, reportId } = e;
  if (reportId == INPUT_REPORT_ID_STANDARD) {
    switch (data.getUint8(INPUT_SUBCMD_REPLY_ID_IDX)) {
      default:
        //console.log("No SUBCMD response.");
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
    if(inputLogging)
    {
      console.log(data);
      //logGyro(data);
    }
  }
}

var regToRead = 0;

// Sends command to change input mode to desired
async function enableIMU(arg)
{
    if (device.opened)
    {
        console.log("Sending IMU Enable...");
        inc_gpn_out();
        data = [global_packet_number_out,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x40, arg];
        try
        {
            await device.sendReport(0x01, new Uint8Array(data));
        }
        catch (e) {
            console.error(e.message);
        }
    }
}

// Sends command to change input mode to desired
async function sendRegisterReadIMU(register)
{
    if (device.opened)
    {
        console.log("Sending IMU Register Read Command...");
        console.log(register);
        inc_gpn_out();
        data = [global_packet_number_out,
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            SUBCMD_READ_IMU_REG, register, 1];
        try
        {
            await device.sendReport(0x01, new Uint8Array(data));
        }
        catch (e) {
            console.error(e.message);
        }
    }
}

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

// HOOK functions/Callback functions
