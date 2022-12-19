// Use these to filter devices
const vendorId = 0x20D6;
const productId = 0xA714;

const currentVersion = 0x08A5;

x_axis = null;
y_axis = null;
cx_axis = null;
cy_axis = null;

const ubitmask = 0xFF;
const CMD_USB_REPORTID = 0x02;

const CMD_SETTINGS_SAVEALL = 1;
const CMD_SETTINGS_GETALL = 2;
const CMD_SETTINGS_LEDSET = 3;
const CMD_SETTINGS_TRIGGERMODE = 4;
const CMD_SETTINGS_TRIGGERSENSITIVITY = 5;

const   USB_MODE_DINPUT  = 0x00;
const   USB_MODE_NS       = 0x01;
const   USB_MODE_XINPUT   = 0x02;
const   USB_MODE_GC       = 0x03;

connected = false;
device = null;
loaded_data = null;

// CONNECT and DISCONNECT functions
async function doConnect() {

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

    document.getElementById("connect_button").disabled = false;
    document.getElementById("disconnect_button").disabled = true;
    document.getElementById("save_button").disabled = true;
    document.getElementById("default_button").disabled = true;
    x_axis.textContent = "0";
    y_axis.textContent = "0";
    cx_axis.textContent = "0";
    cy_axis.textContent = "0";

    enableAllSettings(false);
}

async function openDevice() {
    const devices = await navigator.hid.getDevices();
    device = devices.find(d => d.vendorId === vendorId && d.productId === productId);

    x_axis = document.getElementById("x_axis");
    y_axis = document.getElementById("y_axis");
    cx_axis = document.getElementById("cx_axis");
    cy_axis = document.getElementById("cy_axis");

    if (!device) {
      devices = await navigator.hid.requestDevice({
        filters: [{ vendorId, productId }],
      });

      device = devices[0];
    }
    
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

    if (out = "false")
    {
        document.getElementById("system-collapsible").checked = false;
        document.getElementById("dinput-collapsible").checked = false;
        document.getElementById("ninput-collapsible").checked = false;
        document.getElementById("ginput-collapsible").checked = false;
        document.getElementById("xinput-collapsible").checked = false;
    }

    // Enable save button and reset all button
    document.getElementById("save_button").disabled = !set;
    document.getElementById("default_button").disabled = !set;
}

function placeSettingData(data)
{
    console.log("Got settings from adapter.");
    console.log(data);

    adapter_mode = data.getUint8(3);

    // Global settings

    // LED value
    brightness = data.getUint8(4);
    document.getElementById("ledValue").value = data.getUint8(4);
    document.getElementById("ledTextValue").innerText = String(data.getUint8(4));

    // LT Threshold
    trigger_thresh_l = data.getUint8(7);
    document.getElementById("ltValue").value = data.getUint8(7);
    document.getElementById("ltTextValue").innerText = String(data.getUint8(7));

    // RT Threshold
    trigger_thresh_r = data.getUint8(8);
    document.getElementById("rtValue").value = data.getUint8(8);
    document.getElementById("rtTextValue").innerText = String(data.getUint8(8));
    
    // Parse out trigger mode settings
    gc_full = (data.getUint8(5) & 0xF0) >> 4;
    ns_full = (data.getUint8(5) & 0xF);
    trigger_mode_1 = data.getUint8(5);

    xi_full = (data.getUint8(6) & 0xF0) >> 4;
    di_full = (data.getUint8(6) & 0xF);
    trigger_mode_2 = data.getUint8(6);

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

function isOutOfDate(v_upper, v_lower)
{
    combined = (v_upper << 8) | v_lower;
    show = (combined == currentVersion);
    console.log(combined);
    if (show)
    {
        console.log("Up to date firmware.");
        document.getElementById(id="ood").setAttribute("disabled", "true");
        return false;
    }
    else
    {
        console.log("Out of date firmware.");
        document.getElementById(id="ood").setAttribute("disabled", "false");
        return true;
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
// --------------------- //
// --------------------- //


// HOOK functions/Callback functions

// Handle incoming input reports
function handleInputReport(e) {
    const {data, device, reportId} = e;

    if (reportId == 0x01)
    {
        x_axis.textContent = data.getUint8(3).toString();
        y_axis.textContent = data.getUint8(4).toString();
        cx_axis.textContent = data.getUint8(5).toString();
        cy_axis.textContent = data.getUint8(6).toString();
    }
    else if (reportId == 0x02)
    {
        if (data.getUint8(0) == CMD_SETTINGS_GETALL)
        {
            loaded_data = data;
            magic_num_1 = data.getUint8(1);
            magic_num_2 = data.getUint8(2);

            if (isOutOfDate(magic_num_2, magic_num_1))
            {
                console.log("Out of date adapter.");
                return;
            }
            enableAllSettings(true);
            placeSettingData(data);
        }

        
    }
    
}

function onDeviceDisconnect(d) {
    if (d.productId == productId)
    {
        console.log("Adapter disconnected.");
        doDisconnect();
    }
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
