// Use these to filter devices
const vendorId = 0x20D6;
const productId = 0xA714;

x_axis = null;
y_axis = null;
cx_axis = null;
cy_axis = null;

const ubitmask = 0xFF;
const CMD_USB_REPORTID = 0x02;

const CMD_SETTINGS_LEDSET = 3;
const CMD_SETTINGS_GETALL = 2;
const CMD_SETTINGS_SAVEALL = 1;

connected = false;
device = null;
adapter_mode = 0;
brightness = 0;
trigger_mode_1 = 0x00;
trigger_mode_2 = 0x00;
trigger_thresh_l = 0x00;
trigger_thresh_r = 0x00;
magic_num_1 = 0x00;
magic_num_2 = 0x00;

async function ledValueUpdate(brightness)
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
            await device.sendReport(0x02, new Uint8Array(data));
        }
        catch (e) {
            console.error(e.message);
        }
    }
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
}

async function doDefault() {
    
    await (ledValueUpdate(brightness));
    document.getElementById("ledValue").value = brightness;
    document.getElementById("ledTextValue").innerText = String(brightness);
    await doLoad();
}

async function doSave() {
    if (device.opened)
    {
        console.log("Sending Save all command...");
        tmp_bright = document.getElementById("ledValue").value
        trigger_thresh_l = document.getElementById("ltValue").value
        trigger_thresh_r = document.getElementById("rtValue").value

        // Calculate trigger modes
        di_ltm = getTriggerMode("dinput_l0", "dinput_l1", "dinput_l2");
        di_rtm = getTriggerMode("dinput_r0", "dinput_r1", "dinput_r2");

        xi_ltm = getTriggerMode(false, "xinput_l1", "xinput_l2");
        xi_rtm = getTriggerMode(false, "xinput_r1", "xinput_r2");

        ni_ltm = getTriggerMode("ninput_l0", "ninput_l1", "ninput_l2");
        ni_rtm = getTriggerMode("ninput_r0", "ninput_r1", "ninput_r2");

        gi_ltm = getTriggerMode("ginput_l0", "ginput_l1", "ginput_l2");
        gi_rtm = getTriggerMode("ginput_r0", "ginput_r1", "ginput_r2");

        trigger_mode_1 = (ni_ltm << 6) | (ni_rtm << 4) | (gi_ltm << 2) | (gi_rtm);
        trigger_mode_2 = (di_ltm << 6) | (di_rtm << 4) | (xi_ltm << 2) | (xi_rtm);
        console.log(trigger_mode_1);
        console.log(trigger_mode_2);

        const data = [CMD_SETTINGS_SAVEALL, magic_num_1, magic_num_2, adapter_mode, tmp_bright, trigger_mode_2,
                        trigger_mode_1, trigger_thresh_l, trigger_thresh_r];

        try
        {
            await device.sendReport(0x02, new Uint8Array(data));
        }
        catch (e) {
            console.error(e.message);
        }
    }
}

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

function processTriggerMode(v, s1, s2, s3)
{
    if (v == 0x00)
    {
        if (s1 != 0)
        {
            document.getElementById(s1).checked = false;
        }
        document.getElementById(s2).checked = false;
        document.getElementById(s3).checked = false;
    }
    else if (v == 0x01)
    {
        if (s1 != 0)
        {
            document.getElementById(s1).checked = true;
        }
        document.getElementById(s2).checked = false;
        document.getElementById(s3).checked = false;
    }
    else if (v == 0x02)
    {
        if (s1 != 0)
        {
            document.getElementById(s1).checked = false;
        }
        document.getElementById(s2).checked = true;
        document.getElementById(s3).checked = false;
    }
    else if (v == 0x03)
    {
        if (s1 != 0)
        {
            document.getElementById(s1).checked = false;
        }
        document.getElementById(s2).checked = false;
        document.getElementById(s3).checked = true;
    }
}

function getTriggerMode(s1, s2, s3)
{
    v1 = false;
    v2 = false;
    v3 = false;

    if (!s1)
    {
        v1 = false;
    }
    else
    {
        v1 = document.getElementById(s1).checked;
        if (v1)
        {
            return 0x1;
        }
    }

    v2 = document.getElementById(s2).checked;
    v3 = document.getElementById(s3).checked;

    if (v3)
    {
        return 0x3;
    }
    else if (v2)
    {
        return 0x2;
    }
    else 
    {
        return 0x0;
    }

}

function doPlaceSettings(data)
{
    console.log("Got settings from adapter.");
    console.log(data);

    magic_num_1 = data.getUint8(1);
    magic_num_2 = data.getUint8(2);
    adapter_mode = data.getUint8(3);

    // Global settings
    brightness = data.getUint8(4);
    document.getElementById("ledValue").value = data.getUint8(4);
    document.getElementById("ledTextValue").innerText = String(data.getUint8(4));

    document.getElementById("ltValue").value = data.getUint8(7);
    document.getElementById("ltTextValue").innerText = String(data.getUint8(7));
    trigger_thresh_l = data.getUint8(7);

    document.getElementById("rtValue").value = data.getUint8(8);
    document.getElementById("rtTextValue").innerText = String(data.getUint8(8));
    trigger_thresh_r = data.getUint8(8);

    // Parse out trigger mode settings
    ns_full = (data.getUint8(6) & 0xF0) >> 4;
    gc_full = (data.getUint8(6) & 0xF);
    trigger_mode_1 = data.getUint8(5);

    di_full = (data.getUint8(5) & 0xF0) >> 4;
    xi_full = (data.getUint8(5) & 0xF);
    trigger_mode_2 = data.getUint8(6);

    ns_l = (ns_full & 0xC) >> 2;
    ns_r = ns_full & 0x3;
    console.log(ns_l);
    console.log(ns_r);

    gc_l = (gc_full & 0xC) >> 2;
    gc_r = gc_full & 0x3;

    di_l = (di_full & 0xC) >> 2;
    di_r = di_full & 0x3;

    xi_l = (xi_full & 0xC) >> 2;
    xi_r = xi_full & 0x3;

    // Dinput settings
    processTriggerMode(di_l, "dinput_l0", "dinput_l1", "dinput_l2");
    processTriggerMode(di_r, "dinput_r0", "dinput_r1", "dinput_r2");

    // NS settings
    processTriggerMode(ns_l, "ninput_l0", "ninput_l1", "ninput_l2");
    processTriggerMode(ns_r, "ninput_r0", "ninput_r1", "ninput_r2");

    // GC settings
    processTriggerMode(gc_l, "ginput_l0", "ginput_l1", "ginput_l2");
    processTriggerMode(gc_r, "ginput_r0", "ginput_r1", "ginput_r2");

    // Xinput settings
    processTriggerMode(xi_l, 0, "xinput_l1", "xinput_l2");
    processTriggerMode(xi_r, 0, "xinput_r1", "xinput_r2");

    // Enable save button and reset all button
    document.getElementById("save_button").disabled = false;
    document.getElementById("default_button").disabled = false;
}

function onDeviceDisconnect(d) {
    if (d.productId == productId)
    {
        console.log("Adapter disconnected.");
        doDisconnect();
    }
}

async function getOpenedDevice() {
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

async function handleClick() {

    navigator.hid.addEventListener('disconnect', ({device}) => {
        onDeviceDisconnect(device);
    });
    
    const device = await getOpenedDevice();
}

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
            doPlaceSettings(data);
        }

        
    }
    
}

