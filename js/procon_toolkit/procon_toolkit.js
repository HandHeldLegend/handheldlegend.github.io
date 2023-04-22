// Use these to filter devices
const ID_NINTENDO = 0x057E;

const ID_PROCON = 0x2009;
const ID_JOYCON_L = 0x2006;
const ID_JOYCON_R = 0x2007;
const ID_JOYCON_GRIP = 0x200E;
const ID_SNES_JC = 0x2017;
const ID_N64_JC = 0x2019;

const ubitmask = 0xFF;

const   SUBCMD_SPI_READ = 0x10;
const   SUBCMD_SPI_WRITE = 0x11;
const   SUBCMD_REPORT_MODE = 0x03;
const   SUBCMD_SET_LEDS = 0x30;

const   INPUT_REPORT_ID_STANDARD = 0x21;
const   INPUT_SUBCMD_REPLY_ID_IDX   = 13;
const   INPUT_SUBCMD_ACK_IDX    = 12;
const   INPUT_SUBCMD_ACK_MASK   = 0x7F;

// Calibration space changed?
const   SPI_CALIB_UPPER = 0x80;
const   SPI_CALIB_LOWER = 0x10;
const   SPI_CALIB_LEN   = 22

const   SPI_READ_ADDR_LOW_IDX   = 14;
const   SPI_READ_ADDR_HIGH_IDX  = 15;
const   SPI_READ_DATA_LEN_IDX   = 18;
const   SPI_READ_DATA_IDX       = 19;

const   SPI_COLOR_UPPER = 0x60;
const   SPI_COLOR_LOWER = 0x50;
const   SPI_COLOR_LEN   = 12;

const   LED_BYTE_MASK   = 0x1;

const   REPORT_MODE_INIT    = 0x00;
const   REPORT_MODE_FULL    = 0x30;

global_packet_number_out = 0;

x_high = 0;
x_low = 0;
x_center = 0;

y_high = 0;
y_low = 0;
y_center = 0;

cx_high = 0;
cx_low = 0;
cx_center = 0;

cy_high = 0;
cy_low = 0;
cy_center = 0;

const AXIS_CENTER = 128;
const AXIS_MAX  = 255;
const AXIS_MIN  = 0;

const O_AXIS_MAX    = 4095;
const O_AXIS_CENTER = 2048;

x_high_future = 0;
x_low_future = 0;
x_center_future = O_AXIS_CENTER;

y_high_future = 0;
y_low_future = 0;
y_center_future = O_AXIS_CENTER;

cx_high_future = 0;
cx_low_future = 0;
cx_center_future = O_AXIS_CENTER;

cy_high_future = 0;
cy_low_future = 0;
cy_center_future = O_AXIS_CENTER;

x_axis_element = null;
y_axis_element = null;
cx_axis_element = null;
cy_axis_element = null;

body_color_element = null;
body_color_mask = null;

button_color_element = null;
button_color_mask = null

grip_l_color_element = null;
grip_l_color_mask = null;

grip_r_color_element = null;
grip_r_color_mask = null;

body_color = [0, 0, 0];
buttons_color = [0, 0, 0];
grip_l_color = [0, 0, 0];
grip_r_color = [0, 0, 0];

connected = false;
calibration_loaded = false;
color_loaded = false;
input_mode_set = false;
device = null;
loaded_data = null;

function inc_gpn_out()
{
    global_packet_number_out += 1;
    if (global_packet_number_out > 0xF)
    {
        global_packet_number_out = 0;
    }
}

const dev_filters = [
    {
        vendorId: ID_NINTENDO,
        productId: ID_PROCON
    },
    {
        vendorId: ID_NINTENDO,
        productId: ID_JOYCON_L
    },
    {
        vendorId: ID_NINTENDO,
        productId: ID_JOYCON_R
    },
];

// CONNECT and DISCONNECT functions
async function doConnect() {

    x_axis_element = document.getElementById("x_axis");
    y_axis_element = document.getElementById("y_axis");
    cx_axis_element = document.getElementById("cx_axis");
    cy_axis_element = document.getElementById("cy_axis");

    body_color_element = document.getElementById("pc_body");
    body_color_mask = document.getElementById("body-mask");

    button_color_element = document.getElementById("pc_buttons");
    button_color_mask = document.getElementById("buttons-mask")

    grip_l_color_element = document.getElementById("pc_grip_l");
    grip_l_color_mask = document.getElementById("l-grip-mask");

    grip_r_color_element = document.getElementById("pc_grip_r");
    grip_r_color_mask = document.getElementById("r-grip-mask");

    // Set up disconnect listener
    navigator.hid.addEventListener('disconnect', ({device}) => {
        onDeviceDisconnect(device);
    });
    
    await openDevice();
}

function doDisconnect() {
    if (device.opened)
    {
        device.close();
    }

    x_axis_element.textContent = "0";
    y_axis_element.textContent = "0";
    cx_axis_element.textContent = "0";
    cy_axis_element.textContent = "0";
    document.getElementById("connect_button").disabled = false;
    document.getElementById("disconnect_button").disabled = true;
    document.getElementById("save_button").disabled = true;

    enableAllSettings(false);
}

async function openDevice() {
    devices = await navigator.hid.getDevices();
    device = devices.find(d => d.vendorId === ID_PROCON || d.productId === ID_JOYCON_L || d.productId === ID_JOYCON_L);

    if (!device) {
        devices = await navigator.hid.requestDevice({filters: dev_filters});

        device = devices[0];
        // Wait for device to open
        if (!device.opened) {
            await device.open();
        }

        document.getElementById("connect_button").disabled = true;

        device.addEventListener('inputreport', (event) => {
            handleInputReport(event);
        });

        document.getElementById("disconnect_button").disabled = false;

        await sendInputModeChange();
    }

  return 1;
}
// --------------------- //
// --------------------- //


// HTML modification functions
// these adjust the appearance of the page
// based on current state.

// Enables/Disabled settings dropdown menus.
function enableAllSettings(set)
{
  out = "false";
  if (!set)
  {
      out = "true";
      document.getElementById("color-collapsible").checked = false;
  }

  document.getElementById("color-collapsible").disabled = !set;
  document.getElementById("color-collapsible-toggle").setAttribute("disabled", out);

  // Enable save button and reset all button
  document.getElementById("save_button").disabled = !set;
}

function placeSettingData(data)
{
    console.log("Not implemented placeSettingData");
}

function placeCalibrationData(lx_min, lx_center, lx_max, ly_min, ly_center, ly_max, 
                              rx_min, rx_center, rx_max, ry_min, ry_center, ry_max)
{
    document.getElementById("lx_max").textContent       = lx_max.toString();
    document.getElementById("ly_max").textContent       = ly_max.toString();

    document.getElementById("lx_center").textContent    = lx_center.toString();
    document.getElementById("ly_center").textContent    = ly_center.toString();

    document.getElementById("lx_min").textContent = lx_min.toString();
    document.getElementById("ly_min").textContent = ly_min.toString();

    document.getElementById("rx_max").textContent = rx_max.toString();
    document.getElementById("ry_max").textContent = ry_max.toString();

    document.getElementById("rx_center").textContent = rx_center.toString();
    document.getElementById("ry_center").textContent = ry_center.toString();

    document.getElementById("rx_min").textContent = rx_min.toString();
    document.getElementById("ry_min").textContent = ry_min.toString();
}
// --------------------- //
// --------------------- //


// HOOK functions/Callback functions

// Handle incoming input reports
function handleInputReport(e) {
  const {data, device, reportId} = e;

  if (reportId == INPUT_REPORT_ID_STANDARD)
  {
        switch (data.getUint8(INPUT_SUBCMD_REPLY_ID_IDX))
        {
            default:
                console.log("No SUBCMD response.");
                console.log(data);
                break;

            case SUBCMD_SPI_READ:
                spiReadCmdReturn(data.getUint8(SPI_READ_ADDR_HIGH_IDX), data.getUint8(SPI_READ_ADDR_LOW_IDX), 
                data.getUint8(SPI_READ_DATA_LEN_IDX), data);
                break;

            case SUBCMD_SPI_WRITE:
                if ( !(data.getUint8(INPUT_SUBCMD_ACK_IDX) & INPUT_SUBCMD_ACK_MASK) )
                {
                    console.log("SPI Write OK response received.");
                    // Reload all settings
                    doLoadSettings();
                }
                else
                {
                    console.log("SPI Write Protected response received.");
                }
                break;
            
            case SUBCMD_REPORT_MODE:
                console.log("Got input mode write response.");
                input_mode_set = true;
                doLoadSettings();
                break;
            
            case SUBCMD_SET_LEDS:
                console.log("Got led write response.");
                break;
        }
  }
  else if (reportId == REPORT_MODE_FULL)
  {
    if (input_mode_set && calibration_loaded)
    {
        translateInputAnalog(data);
    }
  }
}

function onDeviceDisconnect(d) {
    enableAllSettings(false);
    console.log("Adapter disconnected.");
    doDisconnect();
}
// --------------------- //
// --------------------- //

// PRO CONTROLLER INPUT TRANSLATION FUNCTIONS

// Scale analog input according to calibration data
function scaleAxis(input, low, center, high)
{
    if (input < center-16)
    {
        // Get distance from center point
        distance = center - input;
        scaler = distance/low;

        // Use scaler to determine value with new range of 255
        res = AXIS_CENTER - (AXIS_CENTER*scaler);
        if (res < AXIS_MIN)
        {
            res = AXIS_MIN;
        }
        return Math.round(res);
    }
    else if (input > center + 16)
    {
        // Get distance from center point
        distance = input - center;
        // Get percentage of distance in range of 0.00 to 1.00
        scaler = distance/high;

        // Use scaler to determine value with new range of 255
        res = AXIS_CENTER + ((AXIS_CENTER-1)*scaler);
        if (res > AXIS_MAX)
        {
            res = AXIS_MAX;
        }
        return Math.round(res);
    }
    else
    {
        return AXIS_CENTER;
    }
}

// Translate analog stick input and place on page
function translateInputAnalog(full_data)
{
    l0 = full_data.getUint8(5);
    l1 = full_data.getUint8(6);
    l2 = full_data.getUint8(7);

    r0 = full_data.getUint8(8);
    r1 = full_data.getUint8(9);
    r2 = full_data.getUint8(10);

    x = l0 | ((l1 & 0xF) << 8);
    y = (l1 >> 4) | (l2 << 4);

    cx = r0 | ((r1 & 0xF) << 8);
    cy = (r1 >> 4) | (r2 << 4);

    setFutureAnalog(x, y, cx, cy);

    x_axis_element.textContent = scaleAxis(x, x_low, x_center, x_high).toString();
    y_axis_element.textContent = scaleAxis(y, y_low, y_center, y_high).toString();
    cx_axis_element.textContent = scaleAxis(cx, cx_low, cx_center, cx_high).toString();
    cy_axis_element.textContent = scaleAxis(cy, cy_low, cy_center, cy_high).toString();
}

// Set future calibration data
function setFutureAnalog(x, y, cx, cy)
{
    // X Axis
    if ((O_AXIS_CENTER - x) > x_low_future)
    {
        x_low_future = O_AXIS_CENTER - x;
    }

    if ((x - O_AXIS_CENTER) > x_high_future)
    {
        x_high_future = x - O_AXIS_CENTER;
    }

    x_center_future = x;

    // Y axis
    if ((O_AXIS_CENTER - y) > y_low_future)
    {
        y_low_future = O_AXIS_CENTER - y;
    }

    if ((y - O_AXIS_CENTER) > y_high_future)
    {
        y_high_future = y - O_AXIS_CENTER;
    }

    y_center_future = y;

    // CX Axis
    if ((O_AXIS_CENTER - cx) > cx_low_future)
    {
        cx_low_future = O_AXIS_CENTER - cx;
    }

    if ((cx - O_AXIS_CENTER) > cx_high_future)
    {
        cx_high_future = cx - O_AXIS_CENTER;
    }

    cx_center_future = cx;

    // CY Axis
    if ((O_AXIS_CENTER - cy) > cy_low_future)
    {
        cy_low_future = O_AXIS_CENTER - cy;
    }

    if ((cy - O_AXIS_CENTER) > cy_high_future)
    {
        cy_high_future = cy - O_AXIS_CENTER;
    }

    cy_center_future = cy;
}

// PRO CONTROLLER SETTING LOAD FUNCTIONS

// Send a command to read SPI data
async function sendSpiReadCmd(addressUpper, addressLower, length)
{
    if (device.opened)
    {
        console.log("Sending SPI Read Command...");
        inc_gpn_out();
        data = [global_packet_number_out, 
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            SUBCMD_SPI_READ, addressLower, addressUpper, 0x00, 0x00, length];

        try
        {
            await device.sendReport(0x01, new Uint8Array(data));
        }
        catch (e) {
            console.error(e.message);
        }
    }
}

// Return function for SPI reading
function spiReadCmdReturn(addressUpper, addressLower, length, full_data)
{
    console.log("Got SPI Read Data");
    console.log(full_data);
    if ( (addressUpper == SPI_CALIB_UPPER) && (addressLower == SPI_CALIB_LOWER) )
    {
        console.log("Got Calibration Data.");
        loadStickCalibration(full_data);
    }
    else if ( (addressUpper == SPI_COLOR_UPPER) && (addressLower == SPI_COLOR_LOWER) )
    {
        console.log("Got Color Data.");
        loadColorData(full_data);
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

// doLoadSettings
function doLoadSettings()
{
    // Reset futures
    x_high_future = 0;
    x_low_future = 0;
    x_center_future = O_AXIS_CENTER;

    y_high_future = 0;
    y_low_future = 0;
    y_center_future = O_AXIS_CENTER;

    cx_high_future = 0;
    cx_low_future = 0;
    cx_center_future = O_AXIS_CENTER;

    cy_high_future = 0;
    cy_low_future = 0;
    cy_center_future = O_AXIS_CENTER;
    
    sendSpiReadCmd(SPI_CALIB_UPPER, SPI_CALIB_LOWER, SPI_CALIB_LEN)
    .then(console.log("Sent SPI Read for Stick Calibration."))
    .catch(err=>console.log(err));

    sendSpiReadCmd(SPI_COLOR_UPPER, SPI_COLOR_LOWER, SPI_COLOR_LEN)
    .then(console.log("Sent SPI Read for Color data."))
    .catch(err=>console.log(err));
}

// Interprets the stick calibration and uses
// this information to show accurate stick
// output.
function loadStickCalibration(full_data)
{
    magic_l_upper = full_data.getUint8(SPI_READ_DATA_IDX + 0);
    magic_l_lower = full_data.getUint8(SPI_READ_DATA_IDX + 1);

    l_0 = full_data.getUint8(SPI_READ_DATA_IDX + 2);
    l_1 = full_data.getUint8(SPI_READ_DATA_IDX + 3); 
    l_2 = full_data.getUint8(SPI_READ_DATA_IDX + 4);
    l_3 = full_data.getUint8(SPI_READ_DATA_IDX + 5);
    l_4 = full_data.getUint8(SPI_READ_DATA_IDX + 6);
    l_5 = full_data.getUint8(SPI_READ_DATA_IDX + 7);
    l_6 = full_data.getUint8(SPI_READ_DATA_IDX + 8);
    l_7 = full_data.getUint8(SPI_READ_DATA_IDX + 9);
    l_8 = full_data.getUint8(SPI_READ_DATA_IDX + 10);

    magic_r_upper = full_data.getUint8(SPI_READ_DATA_IDX + 11);
    magic_r_lower = full_data.getUint8(SPI_READ_DATA_IDX + 12);

    r_0 = full_data.getUint8(SPI_READ_DATA_IDX + 13);
    r_1 = full_data.getUint8(SPI_READ_DATA_IDX + 14);
    r_2 = full_data.getUint8(SPI_READ_DATA_IDX + 15);
    r_3 = full_data.getUint8(SPI_READ_DATA_IDX + 16);
    r_4 = full_data.getUint8(SPI_READ_DATA_IDX + 17);
    r_5 = full_data.getUint8(SPI_READ_DATA_IDX + 18);
    r_6 = full_data.getUint8(SPI_READ_DATA_IDX + 19);
    r_7 = full_data.getUint8(SPI_READ_DATA_IDX + 20);
    r_8 = full_data.getUint8(SPI_READ_DATA_IDX + 21);

    x_high = (l_1 << 8) & 0xF00 | l_0;
    console.log("X Axis High: ");
    console.log(x_high);

    y_high = (l_2 << 4) | (l_1 >> 4);
    console.log("Y Axis High: ");
    console.log(y_high);

    x_center = (l_4 << 8) & 0xF00 | l_3;
    console.log("X Axis Center: ");
    console.log(x_center);
    

    y_center = (l_5 << 4) | (l_4 >> 4);
    console.log("Y Axis Center: ");
    console.log(y_center);
    

    x_low = (l_7 << 8) & 0xF00 | l_6;
    console.log("X Axis Low: ");
    console.log(x_low);
    

    y_low = (l_8 << 4) | (l_1 >> 7);
    console.log("Y Axis Low: ");
    console.log(y_low);

    cx_high = (r_1 << 8) & 0xF00 | r_0;
    cy_high = (r_2 << 4) | (r_1 >> 4);
    cx_center = (r_4 << 8) & 0xF00 | r_3;
    cy_center = (r_5 << 4) | (r_4 >> 4);
    cx_low = (r_7 << 8) & 0xF00 | r_6;
    cy_low = (r_8 << 4) | (r_1 >> 7);

    placeCalibrationData(x_low, x_center, x_high, y_low, y_center, y_high, 
                         cx_low, cx_center, cx_high, cy_low, cy_center, cy_high);

    calibration_loaded = true;
    enableAllSettings(true);
}

// Interprets color data and shows this on the
// page.
function loadColorData(full_data)
{
    tag = "#";

    body_color[0] = full_data.getUint8(SPI_READ_DATA_IDX + 0);
    body_color[1] = full_data.getUint8(SPI_READ_DATA_IDX + 1);
    body_color[2] = full_data.getUint8(SPI_READ_DATA_IDX + 2);

    text_body_color = tag.concat(body_color[0].toString(16).padStart(2, "0"), 
                            body_color[1].toString(16).padStart(2, "0"), body_color[2].toString(16).padStart(2, "0"));

    buttons_color[0] = full_data.getUint8(SPI_READ_DATA_IDX + 3);
    buttons_color[1] = full_data.getUint8(SPI_READ_DATA_IDX + 4);
    buttons_color[2] = full_data.getUint8(SPI_READ_DATA_IDX + 5);

    text_buttons_color = tag.concat(buttons_color[0].toString(16).padStart(2, "0"), 
                        buttons_color[1].toString(16).padStart(2, "0"), buttons_color[2].toString(16).padStart(2, "0"));
    console.log(text_buttons_color);

    grip_l_color[0] = full_data.getUint8(SPI_READ_DATA_IDX + 6);
    grip_l_color[1] = full_data.getUint8(SPI_READ_DATA_IDX + 7);
    grip_l_color[2] = full_data.getUint8(SPI_READ_DATA_IDX + 8);

    text_grip_l_color = tag.concat(grip_l_color[0].toString(16).padStart(2, "0"), 
                        grip_l_color[1].toString(16).padStart(2, "0"), grip_l_color[2].toString(16).padStart(2, "0"));

    grip_r_color[0] = full_data.getUint8(SPI_READ_DATA_IDX + 9);
    grip_r_color[1] = full_data.getUint8(SPI_READ_DATA_IDX + 10);
    grip_r_color[2] = full_data.getUint8(SPI_READ_DATA_IDX + 11);

    text_grip_r_color = tag.concat(grip_r_color[0].toString(16).padStart(2, "0"), 
                        grip_r_color[1].toString(16).padStart(2, "0"), grip_r_color[2].toString(16).padStart(2, "0"));

    body_color_mask.style["background-color"] = text_body_color;
    body_color_element.value = text_body_color;

    button_color_mask.style["background-color"] = text_buttons_color;
    button_color_element.value = text_buttons_color;

    grip_l_color_mask.style["background-color"] = text_grip_l_color;
    grip_l_color_element.value = text_grip_l_color;

    grip_r_color_mask.style["background-color"] = text_grip_r_color;
    grip_r_color_element.value = text_grip_r_color;

    color_loaded = true;

    enableAllSettings(true);

}

// Exchanges hex color string for byte array
function convertColorData(colorStringHex)
{
    console.log("Setting color...");
    console.log(colorStringHex);
    body = colorStringHex.slice(1, 7);

    r = body.slice(0, 2);
    rOut = "0x".concat(r);

    g = body.slice(2, 4);
    gOut = "0x".concat(g);

    b = body.slice(4, 6);
    bOut = "0x".concat(b);
    console.log(bOut);

    r = Number(rOut);
    g = Number(gOut);
    b = Number(bOut);

    vals = [r, g, b];
    return vals;
}

// Sets appropriate color data on change
function setColorData(code, color_text)
{
    switch(code)
    {   
        // Body
        case 0:
            body_color = convertColorData(color_text);
            body_color_mask.style["background-color"] = color_text;
            break;

        case 1:
            buttons_color = convertColorData(color_text);
            button_color_mask.style["background-color"] = color_text;
            break;

        case 2:
            grip_l_color = convertColorData(color_text);
            grip_l_color_mask.style["background-color"] = color_text;
            break;

        case 3:
            grip_r_color = convertColorData(color_text);
            grip_r_color_mask.style["background-color"] = color_text;
            break;

        default:
            console.log("Not a valid code.");
            break;
    }
}

// Send data to be written to the SPI
async function sendSpiWriteCmd(addressUpper, addressLower, data_out, length)
{
    if (length > 0x1D)
    {
        console.log("CAN'T WRITE THIS MUCH DATA!");
        return;
    }

    if (device.opened)
    {
        inc_gpn_out();
        data_main = [global_packet_number_out, 
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            SUBCMD_SPI_WRITE, addressLower, addressUpper, 0x00, 0x00, length];

        data = data_main.concat(data_out);

        try
        {
            await device.sendReport(0x01, new Uint8Array(data));
        }
        catch (e) {
            console.error(e.message);
        }
    }
}

async function doWipeCalibrationSettings()
{

}

// Save the stick calibration data
async function doSaveStickSettings()
{
    magic_upper = 0xB2;
    magic_lower = 0xA1;

    l_0 = x_high_future & 0xFF;
    l_1 = ( (x_high_future >> 8) ) | ( (y_high_future & 0xF) << 4 );
    l_2 = ( y_high_future & 0xFF0 ) >> 4;

    l_3 = x_center_future & 0xFF;
    l_4 = ( (x_center_future >> 8) ) | ( (y_center_future & 0xF) << 4 );
    l_5 = ( y_center_future & 0xFF0 ) >> 4;

    l_6 = x_low_future & 0xFF;
    l_7 = ( (x_low_future >> 8) ) | ( (y_low_future & 0xF) << 4 );
    l_8 = ( y_low_future & 0xFF0 ) >> 4;


    r_0 = cx_high_future & 0xFF;
    r_1 = ( (cx_high_future >> 8) ) | ( (cy_high_future & 0xF) << 4 );
    r_2 = ( cy_high_future & 0xFF0 ) >> 4;
    r_3 = cx_center_future & 0xFF;
    r_4 = ( (cx_center_future >> 8) ) | ( (cy_center_future & 0xF) << 4 );
    r_5 = ( cy_center_future & 0xFF0 ) >> 4;
    r_6 = cx_low_future & 0xFF;
    r_7 = ( (cx_low_future >> 8) ) | ( (cy_low_future & 0xF) << 4 );
    r_8 = ( cy_low_future & 0xFF0 ) >> 4;

    data_out = [magic_upper, magic_lower,
                l_0, l_1, l_2, l_3, l_4, l_5, l_6, l_7, l_8,
                magic_upper, magic_lower,
                r_0, r_1, r_2, r_3, r_4, r_5, r_6, r_7, r_8];
    
    await sendSpiWriteCmd(SPI_CALIB_UPPER, SPI_CALIB_LOWER, data_out, SPI_CALIB_LEN);
}

// Save the controller color data
async function doSaveColor()
{
    data_out = [body_color[0], body_color[1], body_color[2],
                buttons_color[0], buttons_color[1], buttons_color[2],
                grip_l_color[0], grip_l_color[1], grip_l_color[2],
                grip_r_color[0], grip_r_color[1], grip_r_color[2]];

    await sendSpiWriteCmd(SPI_COLOR_UPPER, SPI_COLOR_LOWER, data_out, SPI_COLOR_LEN);
}


// --------------------- //
// --------------------- //
