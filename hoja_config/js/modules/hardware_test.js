
function fwtest_reset_checkbox(id) {
    let el = document.getElementById(id);
    el.removeAttribute("checked");
    el.removeAttribute("failed");
}

function fwtest_reset_all_checkboxes() {
    fwtest_reset_checkbox("fwc_data");
    fwtest_reset_checkbox("fwc_latch");
    fwtest_reset_checkbox("fwc_clock");
    fwtest_reset_checkbox("fwc_rgb");
    fwtest_reset_checkbox("fwc_analog");
    fwtest_reset_checkbox("fwc_imu");
    fwtest_reset_checkbox("fwc_bluetooth");
    fwtest_reset_checkbox("fwc_battery");
    fwtest_reset_checkbox("fwc_rumble");
}

function fwtest_set_passed(id, passed) {
    let el = document.getElementById(id);

    if (passed > 0) {
        console.log("Test passed");
        console.log(el);
        el.setAttribute("checked", "true");
        el.removeAttribute("failed"); // Remove 'failed' attribute if previously set
    } else {
        console.log("Test failed");
        console.log(el);
        el.removeAttribute("checked");
        el.setAttribute("failed", "true"); // Add 'failed' attribute
    }
}

var ogText = "Start";

function fwtest_reset_button()
{
    var bel = document.getElementById("start_hwtest_button");
    bel.removeAttribute("disabled");
    bel.innerText = ogText;
}

function fwtest_enable_menu(enable)
{
    fwtest_reset_button();
    enable_dropdown_element("hwtest-collapsible", enable);

    if(!enable)
    {
        fwtest_reset_all_checkboxes();
    }
}

async function fwtest_start()
{
    var dataOut = new Uint8Array([WEBUSB_CMD_HWTEST_GET]);
    await device.transferOut(2, dataOut);

    var bel = document.getElementById("start_hwtest_button");
    bel.setAttribute("disabled", "true");

    ogText = bel.innerText;

    fwtest_reset_all_checkboxes();

    bel.innerText = "Testing...";
}

function fwtest_place_data(data)
{
    // Combine the two bytes into a uint16_t value
    const val = (data.getUint8(2) << 8) | data.getUint8(1);

    // Create a union struct with individual fields
    const hwTest = {
        data_pin:   (val & (1 << 0)),
        latch_pin:  (val & (1 << 1)),
        clock_pin:  (val & (1 << 2)),
        rgb_pin:    (val & (1 << 3)),
        analog:     (val & (1 << 4)),
        imu:        (val & (1 << 5)),
        bluetooth:  (val & (1 << 6)),
        battery:    (val & (1 << 7)),
        rumble:     (val & (1 << 8)),
    };

    console.log(hwTest);

    fwtest_set_passed("fwc_data",    hwTest.data_pin);
    fwtest_set_passed("fwc_latch",   hwTest.latch_pin);
    fwtest_set_passed("fwc_clock",   hwTest.clock_pin);

    fwtest_set_passed("fwc_rgb",     hwTest.rgb_pin);
    fwtest_set_passed("fwc_analog",  hwTest.analog);
    fwtest_set_passed("fwc_imu",     hwTest.imu);
    fwtest_set_passed("fwc_bluetooth", hwTest.bluetooth);
    fwtest_set_passed("fwc_battery", hwTest.battery);

    fwtest_set_passed("fwc_rumble", hwTest.rumble);

    fwtest_reset_button();
    showToast("Got test data OK.");
}