const debug = false;

// Use these to filter devices
const GC_VID = 0x20D6;
const GC_PID = 0xA714;

const currentFwVersion = 0x0900;
const currentSettingVersion = 0x08AA;

x_axis = null;
y_axis = null;
cx_axis = null;
cy_axis = null;

tl_axis = null;
tr_axis = null;
tl_button = null;
tr_button = null;

snapback_axis = 0;

const ubitmask = 0xFF;
const CMD_USB_REPORTID = 0x02;

const CMD_SETTINGS_SAVEALL = 1;
const CMD_SETTINGS_GETALL = 2;
const CMD_SETTINGS_LEDSET = 3;
const CMD_SETTINGS_TRIGGERMODE = 4;
const CMD_SETTINGS_TRIGGERSENSITIVITY = 5;
const CMD_SETTINGS_ZJUMP = 6;
const CMD_SETTINGS_SETTINGVERSION = 7;
const CMD_SETTINGS_FWVERSION = 8;
const CMD_SETTINGS_ANALOGSENSITIVITY = 9;

const   USB_MODE_DINPUT     = 0x02;
const   USB_MODE_NS         = 0x00;
const   USB_MODE_XINPUT     = 0x03;
const   USB_MODE_GC         = 0x01;

const ANALOG_SENS_LOW = 127;
const ANALOG_SENS_MID = 137;
const ANALOG_SENS_HIGH = 147;

const dev_filters = [
    {
        vendorId: GC_VID,
        productId: GC_PID,
    },
];

connected = false;
device = null;
loaded_data = null;

// CONNECT and DISCONNECT functions
async function doConnect() {

    if (debug)
    {
        enableAllSettings(true);
    }
    else
    {
        console.log("Connecting...");
        // Set up disconnect listener
        navigator.hid.addEventListener('disconnect', ({device}) => {
            onDeviceDisconnect(device);
        });

        await openDevice();
    }
}

async function openDevice() {

    devices = await navigator.hid.requestDevice({
        filters: dev_filters,
    });

    //devices = await navigator.hid.getDevices();
    device = devices.find(d => d.vendorId === GC_VID && d.productId === GC_PID);

    x_axis = document.getElementById("x_axis");
    y_axis = document.getElementById("y_axis");
    cx_axis = document.getElementById("cx_axis");
    cy_axis = document.getElementById("cy_axis");

    tl_axis     = document.getElementById("tl_axis");;
    tr_axis     = document.getElementById("tr_axis");;
    tl_button   = document.getElementById("tl_button");;
    tr_button   = document.getElementById("tr_button");;

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

    await doLoad();

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
    }

    document.getElementById("acceleration-collapsible").disabled = !set;
    document.getElementById("acceleration-collapsible-toggle").setAttribute("disabled", out);

    document.getElementById("dinput-collapsible").disabled = !set;
    document.getElementById("dinput-collapsible-toggle").setAttribute("disabled", out);

    document.getElementById("ninput-collapsible").disabled = !set;
    document.getElementById("ninput-collapsible-toggle").setAttribute("disabled", out);

    document.getElementById("ginput-collapsible").disabled = !set;
    document.getElementById("ginput-collapsible-toggle").setAttribute("disabled", out);

    document.getElementById("xinput-collapsible").disabled = !set;
    document.getElementById("xinput-collapsible-toggle").setAttribute("disabled", out);

    document.getElementById("system-collapsible").disabled = !set;
    document.getElementById("system-collapsible-toggle").setAttribute("disabled", out);

    document.getElementById("snapback-collapsible").disabled = !set;
    document.getElementById("snapback-collapsible-toggle").setAttribute("disabled", out);

    if (out = "false")
    {
        document.getElementById("acceleration-collapsible").checked = false;
        document.getElementById("system-collapsible").checked = false;
        document.getElementById("dinput-collapsible").checked = false;
        document.getElementById("ninput-collapsible").checked = false;
        document.getElementById("ginput-collapsible").checked = false;
        document.getElementById("xinput-collapsible").checked = false;
        document.getElementById("snapback-collapsible").checked = false;
    }

    // Enable save button and reset all button
    document.getElementById("save_button").disabled = !set;
    //document.getElementById("default_button").disabled = !set;
}

function placeLedSetting(data)
{
    console.log("Got LED brightness setting.");
    // LED value
    brightness = data.getUint8(1);
    document.getElementById("ledValue").value = brightness;
    document.getElementById("ledTextValue").innerText = String(brightness);
}

function placeTriggerModeSetting(data)
{
    console.log("Got trigger mode setting data.");
    // Parse out trigger mode settings
    gc_full = (data.getUint8(1) & 0xF0) >> 4;
    ns_full = (data.getUint8(1) & 0xF);
    trigger_mode_1 = data.getUint8(1);

    xi_full = (data.getUint8(2) & 0xF0) >> 4;
    di_full = (data.getUint8(2) & 0xF);
    trigger_mode_2 = data.getUint8(2);

    ns_r = (ns_full & 0xC) >> 2;
    ns_l = ns_full & 0x3;

    gc_r = (gc_full & 0xC) >> 2;
    gc_l = gc_full & 0x3;

    di_r = (di_full & 0xC) >> 2;
    di_l = di_full & 0x3;

    xi_r = (xi_full & 0xC) >> 2;
    xi_l = xi_full & 0x3;

    // Place trigger mode settings
    placeTriggerData("dinput_lx", "dinput_l0", "dinput_l1", "dinput_l2", di_l);
    placeTriggerData("dinput_rx", "dinput_r0", "dinput_r1", "dinput_r2", di_r);

    placeTriggerData("xinput_lx", false, "xinput_l1", "xinput_l2", xi_l);
    placeTriggerData("xinput_rx", false, "xinput_r1", "xinput_r2", xi_r);

    placeTriggerData("ninput_rx", "ninput_r0", "ninput_r1", "ninput_r2", ns_r);
    placeTriggerData("ninput_lx", "ninput_l0", "ninput_l1", "ninput_l2", ns_l);

    placeTriggerData("ginput_lx", "ginput_l0", "ginput_l1", "ginput_l2", gc_l);
    placeTriggerData("ginput_rx", "ginput_r0", "ginput_r1", "ginput_r2", gc_r);
}

function placeTriggerSensitivitySetting(data)
{
    console.log("Got trigger sensitivity data.");
    // LT Threshold
    trigger_thresh_l = data.getUint8(1);
    document.getElementById("ltValue").value = trigger_thresh_l;
    document.getElementById("ltTextValue").innerText = String(trigger_thresh_l);

    // RT Threshold
    trigger_thresh_r = data.getUint8(2);
    document.getElementById("rtValue").value = trigger_thresh_r;
    document.getElementById("rtTextValue").innerText = String(trigger_thresh_r);
}

function placeZJumpSetting(data)
{
    z_jump = data.getUint8(1);
    ns_zjump = z_jump & 0x3;
    gc_zjump = (z_jump >> 2) & 0x3;
    di_zjump = (z_jump >> 4) & 0x3;
    xi_zjump = (z_jump >> 6) & 0x3;
    console.log("Z Jump data loaded.");

    placeZJumpData("dinput_zjump_off", "dinput_zjump_x", "dinput_zjump_y", di_zjump);
    placeZJumpData("xinput_zjump_off", "xinput_zjump_x", "xinput_zjump_y", xi_zjump);
    placeZJumpData("ginput_zjump_off", "ginput_zjump_x", "ginput_zjump_y", gc_zjump);
    placeZJumpData("ninput_zjump_off", "ninput_zjump_x", "ninput_zjump_y", ns_zjump);
}

function placeAnalogAccelSetting(data)
{
    console.log("Got analog acceleration data.");
    value0 = 150-data.getUint8(1);
    value1 = 150-data.getUint8(2);
    value2 = 150-data.getUint8(3);
    value3 = 150-data.getUint8(4);
    console.log("LX: " + String(value0));
    console.log("LY: " + String(value1));
    console.log("RX: " + String(value2));
    console.log("RY: " + String(value3));

    document.getElementById("lx_accel_id").value = value0;
    document.getElementById("lx_accel_value").innerText = String(value0-50);

    document.getElementById("ly_accel_id").value = value1;
    document.getElementById("ly_accel_value").innerText = String(value1-50);

    document.getElementById("rx_accel_id").value = value2;
    document.getElementById("rx_accel_value").innerText = String(value2-50);

    document.getElementById("ry_accel_id").value = value3;
    document.getElementById("ry_accel_value").innerText = String(value3-50);
}

function checkSettingVersion(data)
{
    settingVersion = data.getUint8(1) | (data.getUint8(2)<<8);
    if (settingVersion != currentSettingVersion)
    {
        console.log("Setting version out of date!");
    }
    else
    {
        console.log("Setting version OK.");

    }
}

function checkFwVersion(data)
{
    fwVersion = data.getUint8(1) | (data.getUint8(2)<<8);
    console.log(fwVersion);
    if (fwVersion != currentFwVersion)
    {
        console.log("FW version out of date!");
        document.getElementById(id="ood").setAttribute("disabled", "false");
    }
    else
    {
        console.log("FW version OK.");
        document.getElementById(id="ood").setAttribute("disabled", "true");
    }
}

// Place trigger data into proper locations
function placeTriggerData(r0, r1, r2, r3, value)
{
    if (value == 0)
    {
        document.getElementById(r0).checked = (value == 0);
    }
    else if (value == 1)
    {
        if (r1 != false)
        {
            document.getElementById(r1).checked = (value == 1);
        }
    }
    else if (value == 2)
    {
        document.getElementById(r2).checked = (value == 2);
    }
    else if (value == 3)
    {
        document.getElementById(r3).checked = (value == 3);
    }
}

function placeZJumpData(r0, r1, r2, value)
{
    document.getElementById(r0).checked = (value == 0);
    document.getElementById(r1).checked = (value == 1);
    document.getElementById(r2).checked = (value == 2);
}
// --------------------- //
// --------------------- //


// HOOK functions/Callback functions

// Handle incoming input reports
function handleInputReport(e) {
    const {data, device, reportId} = e;

    // Input report
    if (reportId == 0x01)
    {
        tl_button.textContent = (data.getUint8(0) & 0x40) ? "1" : "0";
        tr_button.textContent = (data.getUint8(0) & 0x80) ? "1" : "0";

        x_axis.textContent = data.getUint8(3).toString();
        y_axis.textContent = data.getUint8(4).toString();
        cx_axis.textContent = data.getUint8(5).toString();
        cy_axis.textContent = data.getUint8(6).toString();

        tl_axis.textContent = data.getUint8(7).toString();
        tr_axis.textContent = data.getUint8(8).toString();

        output = data.getUint8(3);
        switch(snapback_axis)
        {
            default:
            case 0:
                break;
            case 1:
                output = data.getUint8(4);
                break;
            case 2:
                output = data.getUint8(5);
                break;
            case 3:
                output = data.getUint8(6);
                break;
        }
        updateSnapbackGraph(output);
        updateStickGraph(data.getUint8(3), data.getUint8(4),
                         data.getUint8(5), data.getUint8(6));
    }
    // This is for handling configuration data input reports
    else if (reportId == 0x02)
    {
        switch(data.getUint8(0))
        {
            case CMD_SETTINGS_FWVERSION:
                checkFwVersion(data);
                break;

            case CMD_SETTINGS_LEDSET:
                placeLedSetting(data);
                enableAllSettings(true);
                break;

            case CMD_SETTINGS_SETTINGVERSION:
                checkSettingVersion(data);
                break;

            case CMD_SETTINGS_TRIGGERMODE:
                placeTriggerModeSetting(data);
                break;

            case CMD_SETTINGS_TRIGGERSENSITIVITY:
                placeTriggerSensitivitySetting(data);
                break;

            case CMD_SETTINGS_ZJUMP:
                placeZJumpSetting(data);
                break;

            case CMD_SETTINGS_ANALOGSENSITIVITY:
                placeAnalogAccelSetting(data);
                break;

            default:
                console.log("Unknown settings data.");
                console.log(data);
                break;
        }
    }
}

function onDeviceDisconnect(d) {
    doDeviceDisconnect();
}

function doDeviceDisconnect()
{
    if (device.opened)
    {
        device.close();
    }

    device = null;

    document.getElementById("connect_button").disabled = false;
    document.getElementById("disconnect_button").disabled = true;
    document.getElementById("save_button").disabled = true;
    //document.getElementById("default_button").disabled = true;
    x_axis.textContent = "0";
    y_axis.textContent = "0";
    cx_axis.textContent = "0";
    cy_axis.textContent = "0";

    tl_axis     = "0";
    tr_axis     = "0";
    tl_button   = "0";
    tr_button   = "0";

    enableAllSettings(false);
}
// --------------------- //
// --------------------- //


// COMMAND FUNCTIONS TO SEND DATA TO ADAPTER

// 0 is left trigger. 1 is right trigger.
// mode is USB_ADAPTER_MODE
// USB_MODE_GENERIC  = 0x00,
// USB_MODE_NS       = 0x01,
// USB_MODE_XINPUT   = 0x02,
// USB_MODE_GC       = 0x03,
async function cmdTriggerUpdate(mode, trigger, value)
{
    if (device.opened)
    {
        console.log("Sending trigger update...");
        const data = [CMD_SETTINGS_TRIGGERMODE, mode, trigger, value];

        try
        {
            await device.sendReport(CMD_USB_REPORTID, new Uint8Array(data));
        }
        catch (e) {
            console.error(e.message);
        }
    }
}

async function cmdZJumpUpdate(mode, value)
{
    if (device.opened)
    {
        console.log("Sending z jump update...");
        const data = [CMD_SETTINGS_ZJUMP, mode, value];

        try
        {
            await device.sendReport(CMD_USB_REPORTID, new Uint8Array(data));
        }
        catch (e) {
            console.error(e.message);
        }
    }
}

async function cmdLedUpdate(brightness)
{
    // Sanitize data
    tmp = brightness & ubitmask;
    console.log(brightness.toString());
    console.log(device.productId.toString());

    if (device.opened)
    {
        console.log("Sending LED command...");
        const data = [CMD_SETTINGS_LEDSET, tmp];

        try
        {
            await device.sendReport(CMD_USB_REPORTID, new Uint8Array(data));
        }
        catch (e) {
            console.error(e.message);
        }
    }
}

// 0 is left trigger. 1 is right trigger.
async function cmdTriggerThreshUpdate(trigger, value)
{
    if (device.opened)
    {
        console.log("Sending trigger threshold update...");
        const data = [CMD_SETTINGS_TRIGGERSENSITIVITY, trigger, value];

        try
        {
            await device.sendReport(CMD_USB_REPORTID, new Uint8Array(data));
        }
        catch (e) {
            console.error(e.message);
        }
    }
}

// Send update to device for acceleration curve update
async function cmdAccelUpdate(axis, value)
{
    newval = 150-value;
    if (device.opened)
    {
        console.log("Sending analog acceleration update: " + String(newval));
        const data = [CMD_SETTINGS_ANALOGSENSITIVITY, axis, newval];

        try
        {
            await device.sendReport(CMD_USB_REPORTID, new Uint8Array(data));
        }
        catch (e) {
            console.error(e.message);
        }
    }
}

// Tell adapter to save all settings
async function doSave() {
    if (device.opened)
    {
        console.log("Sending Save all command...");
        try
        {
            data = [CMD_SETTINGS_SAVEALL];
            await device.sendReport(CMD_USB_REPORTID, new Uint8Array(data));
        }
        catch (e) {
            console.error(e.message);
        }
    }
}

// Tell adapter to send current saved settings
async function doLoad() {
    if (device.opened)
    {
        console.log("Sending Get All command...");
        const data = [CMD_SETTINGS_GETALL];

        try
        {
            await device.sendReport(0x02, new Uint8Array(data));
        }
        catch (e) {
            console.error(e.message);
        }
    }
}

// Tell adapter to set all to default
async function doDefault() {

}
// --------------------- //
// --------------------- //

// DRAW STICK OUTPUT STUFF
stick_out_init = false;
ls_center_x = 300*0.25;
ls_center_y = 120/2;

rs_center_x = 300*0.75;
rs_center_y = 120/2;

stick_scaler = 100/228;

stick_canvas = null;
stick_ctx = null;

function updateStickGraph(lx, ly, rx, ry)
{
    if (!stick_out_init)
    {
        stick_canvas = document.getElementById("analog_canvas");
        stick_ctx = stick_canvas.getContext("2d");
        stick_out_init = true;
    }

    // Clear canvas
    stick_ctx.clearRect(0, 0, 300, 150);

    // Draw main circle
    stick_ctx.beginPath();
    stick_ctx.arc(ls_center_x, ls_center_y, 50, 0, 2 * Math.PI, false);
    stick_ctx.fillStyle = '#8ad2ff';
    stick_ctx.fill();
    stick_ctx.lineWidth = 2;
    stick_ctx.strokeStyle = '#3e6680';
    stick_ctx.stroke();

    // Draw main circle
    stick_ctx.beginPath();
    stick_ctx.arc(rs_center_x, rs_center_y, 50, 0, 2 * Math.PI, false);
    stick_ctx.fillStyle = '#e8d368';
    stick_ctx.fill();
    stick_ctx.lineWidth = 2;
    stick_ctx.strokeStyle = '#80753e';
    stick_ctx.stroke();

    a_lx = (lx-128)*stick_scaler;
    a_ly = (ly-128)*stick_scaler;
    a_rx = (rx-128)*stick_scaler;
    a_ry = (ry-128)*stick_scaler;

    // Draw the left stick
    stick_ctx.beginPath();
    stick_ctx.arc(ls_center_x+a_lx, ls_center_y+a_ly, 4, 0, 2 * Math.PI, false);
    stick_ctx.fillStyle = '#e86868';
    stick_ctx.fill();
    stick_ctx.lineWidth = 1;
    stick_ctx.strokeStyle = '#612a2a';
    stick_ctx.stroke();

    // Draw the right stick
    stick_ctx.beginPath();
    stick_ctx.arc(rs_center_x+a_rx, rs_center_y-a_ry, 4, 0, 2 * Math.PI, false);
    stick_ctx.fillStyle = '#e86868';
    stick_ctx.fill();
    stick_ctx.lineWidth = 1;
    stick_ctx.strokeStyle = '#612a2a';
    stick_ctx.stroke();
}

//SNAPBACK STUFF
width = 0;
height = 0;
canvas = null;
ctx = null;
initialized = false;

const GC_CENTER = 128;
const GC_MAX = 228;
const GC_MIN = 27;
const GC_SNAPTHRESH = 23;

const TOGGLE_EN_HIGH = 200;
const TOGGLE_EN_LOW = 56;
scaleH = 0;
scaleCenter = null;
scaleTopSb = null;
scaleLowSb = null;
vals = null;
count = null;

snapUp = false;
snapDown = false;
rebound = false;
COUNT_RESET = 60;
countToComplete = COUNT_RESET;
snapComplete = false;

// Change snapback viewer axis
function updateSnapbackAxis(axis)
{
    snapback_axis = axis;
}

// Draws an update frame to the snapback graph
function updateSnapbackGraph(value)
{
    if (!initialized)
    {
        canvas = document.getElementById("snapback_canvas");
        width = canvas.width;
        height = canvas.height;

        // Calculate scale units
        scaleH = height/256;
        scaleCenter = GC_CENTER*scaleH;
        scaleTopSb = scaleCenter - (GC_SNAPTHRESH*scaleH);
        scaleLowSb = scaleCenter + (GC_SNAPTHRESH*scaleH);
        COUNT_RESET = width/2;
        ctx = canvas.getContext("2d");
        vals = [];
        count = 0;

        // Draw center line and snapback lines
        ctx.beginPath();
        ctx.moveTo(0, scaleCenter);
        ctx.lineTo(width, scaleCenter);
        ctx.strokeStyle = '#00000080';
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, scaleTopSb);
        ctx.lineTo(width, scaleTopSb);
        ctx.strokeStyle = '#de1b1f80';
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, scaleLowSb);
        ctx.lineTo(width, scaleLowSb);
        ctx.strokeStyle = '#de1b1f80';
        ctx.stroke();

        initialized=true;
    }

    if (value >= TOGGLE_EN_HIGH && !snapDown)
    {
        snapDown = true;
        snapUp = false;
        rebound = false;
    }
    else if (value <= TOGGLE_EN_LOW && !snapUp)
    {
        snapDown = false;
        snapUp = true;
        rebound = false;
    }

    if (snapDown && !rebound && value <= GC_CENTER)
    {
        countToComplete = COUNT_RESET;
        rebound = true;
    }
    else if (snapUp && !rebound && value >= GC_CENTER)
    {
        countToComplete = COUNT_RESET;
        rebound = true;
    }

    if (rebound && countToComplete > 0)
    {
        countToComplete -= 1;
    }
    else if (rebound && countToComplete < 1)
    {
        countToComplete = COUNT_RESET;
        rebound = false;
        snapUp = false;
        snapDown = false;
        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Draw center line and snapback lines
        ctx.beginPath();
        ctx.moveTo(0, scaleCenter);
        ctx.lineTo(width, scaleCenter);
        ctx.strokeStyle = '#00000080';
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, scaleTopSb);
        ctx.lineTo(width, scaleTopSb);
        ctx.strokeStyle = '#de1b1f80';
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, scaleLowSb);
        ctx.lineTo(width, scaleLowSb);
        ctx.strokeStyle = '#de1b1f80';
        ctx.stroke();

        if (vals.length > 1)
        {

            // Draw input line
            ctx.beginPath();
            ctx.moveTo(width, height-(value*scaleH));
            for (var i = 0; i < count; i++)
            {
                ctx.lineTo(width-i, height-(vals[vals.length-1-i]*scaleH));
            }
        }
        ctx.strokeStyle = '#0F0F00FF';
        ctx.stroke();
    }

    // Add point to line
    vals.push(value);

    if (count >= width)
    {
        vals.shift();
    }
    else
    {
        count += 1;
    }

}
