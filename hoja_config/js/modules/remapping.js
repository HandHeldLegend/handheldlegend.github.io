const MAPCODE_DUP = 0;
const MAPCODE_DDOWN = 1;
const MAPCODE_DLEFT = 2;
const MAPCODE_DRIGHT = 3;

const MAPCODE_B_A = 4;
const MAPCODE_B_B = 5;
const MAPCODE_B_X = 6;
const MAPCODE_B_Y = 7;

const MAPCODE_T_L = 8;
const MAPCODE_T_ZL = 9;
const MAPCODE_T_R = 10;
const MAPCODE_T_ZR = 11;

const MAPCODE_B_PLUS = 12;
const MAPCODE_B_MINUS = 13;
const MAPCODE_B_STICKL = 14;
const MAPCODE_B_STICKR = 15;

let gc0 = document.getElementById("gc_sp_0");
let gc1 = document.getElementById("gc_sp_1");
let gc2 = document.getElementById("gc_sp_2");
let gc3 = document.getElementById("gc_sp_3");
let gc4 = document.getElementById("gc_sp_4");

function remapping_sp_enable_menu(enable) {
    enable_dropdown_element("gcsp-collapsible", enable);
}

function gcsp_place_value(val, light)
{
    gc0.checked = false;
    gc1.checked = false;
    gc2.checked = false;
    gc3.checked = false;
    gc4.checked = false;

    var el = null;
    switch(val)
    {
        default:
        case 0:
            el=gc0;
            break;

        case 1:
            el=gc1;
            break;

        case 2:
            el=gc2;
            break;

        case 3:
            el=gc3;
            break;

        case 4:
            el=gc4;
            break;
    }

    el.checked = true;

    console.log("GC SP Mode: " + val);
    console.log("GC Light Value: " + light.toString());

    document.getElementById("lightValue").value = light;
    document.getElementById("lightTextValue").innerText = light.toString();
}

async function gcsp_set_value(val, light)
{
    var dataOut = new Uint8Array([WEBUSB_CMD_GCSP_SET, val, light]);
    await device.transferOut(2, dataOut);
}

let remap_buttons = document.getElementsByClassName("button-map-init");
let remap_view = document.getElementsByClassName("button-map-view");

var current_mode = 0;

const button_output_ids = [
    'bo_dup',
    'bo_ddown',
    'bo_dleft',
    'bo_dright',
    'bo_a',
    'bo_b',
    'bo_x',
    'bo_y',
    'bo_l',
    'bo_zl',
    'bo_r',
    'bo_zr',
    'bo_plus',
    'bo_minus',
    'bo_stickl',
    'bo_stickr'
];

const button_input_ids = [
    'bi_dup',
    'bi_ddown',
    'bi_dleft',
    'bi_dright',
    'bi_a',
    'bi_b',
    'bi_x',
    'bi_y',
    'bi_l',
    'bi_zl',
    'bi_r',
    'bi_zr',
    'bi_plus',
    'bi_minus',
    'bi_stickl',
    'bi_stickr'
];

// Enable or disable the profile switcher radio picker :)
function _remap_enable_profile_switcher(enable)
{
    var sw = document.getElementById("rp_switch");
    var xi = document.getElementById("rp_xinput");
    var gc = document.getElementById("rp_gamecube");
    var n64 = document.getElementById("rp_n64");
    var snes = document.getElementById("rp_snes");
    if(enable)
    {
        sw.removeAttribute('disabled');
        xi.removeAttribute('disabled');
        gc.removeAttribute('disabled');
        n64.removeAttribute('disabled');
        snes.removeAttribute('disabled');
    }
    else
    {
        sw.setAttribute('disabled', true);
        xi.setAttribute('disabled', true);
        gc.setAttribute('disabled', true);
        n64.setAttribute('disabled', true);
        snes.setAttribute('disabled', true);
    }
    
}

// Tell the controller to start
// listening for a new remap option
// This sends the output that should be assigned
// to a new input
async function remap_init_new(code) {

    _remap_enable_profile_switcher(false);

    for (let i = 0; i < remap_view.length; i++) {

        // Disable all remap buttons
        remap_buttons[i].setAttribute("disabled", true);

        if (i == code) {
            var id = button_input_ids[i];
            document.getElementById(id).setAttribute("disabled", true);
        }
    }

    var dataOut = new Uint8Array([WEBUSB_CMD_REMAP_SET, current_mode, code]);

    await device.transferOut(2, dataOut);
}

async function remap_set_default() {
    var dataOut = new Uint8Array([WEBUSB_CMD_REMAP_DEFAULT, current_mode]);
    await device.transferOut(2, dataOut);
}

async function remap_get_values() {
    var dataOut = new Uint8Array([WEBUSB_CMD_REMAP_GET, current_mode]);
    await device.transferOut(2, dataOut);
}

function _remap_get_char(code) {
    var ret = "...";
    switch (code) {
        case MAPCODE_DUP:
            ret = '\u2191'; // Unicode for upward arrow
            break;
        case MAPCODE_DDOWN:
            ret = '\u2193'; // Unicode for downward arrow
            break;
        case MAPCODE_DLEFT:
            ret = '\u2190'; // Unicode for leftward arrow
            break;
        case MAPCODE_DRIGHT:
            ret = '\u2192'; // Unicode for rightward arrow
            break;

        case MAPCODE_B_A:
            ret = 'A';
            break;
        case MAPCODE_B_B:
            ret = 'B';
            break;
        case MAPCODE_B_X:
            ret = 'X';
            break;
        case MAPCODE_B_Y:
            ret = 'Y';
            break;

        case MAPCODE_T_L:
            ret = 'L';
            break;
        case MAPCODE_T_ZL:
            ret = 'ZL';
            break;
        case MAPCODE_T_R:
            ret = 'R';
            break;
        case MAPCODE_T_ZR:
            ret = 'ZR';
            break;

        case MAPCODE_B_PLUS:
            ret = '+';
            break;
        case MAPCODE_B_MINUS:
            ret = '-';
            break;
        case MAPCODE_B_STICKL:
            ret = 'SL';
            break;
        case MAPCODE_B_STICKR:
            ret = 'SR';
            break;

        default:
            ret = ''; // Return an empty string for invalid mapCode
            break;
    }
    return ret;
}

function _remap_get_output_mapcode(id) {
    switch (id) {
        case 'bo_dup': return MAPCODE_DUP;
        case 'bo_ddown': return MAPCODE_DDOWN;
        case 'bo_dleft': return MAPCODE_DLEFT;
        case 'bo_dright': return MAPCODE_DRIGHT;

        case 'bo_a': return MAPCODE_B_A;
        case 'bo_b': return MAPCODE_B_B;
        case 'bo_x': return MAPCODE_B_X;
        case 'bo_y': return MAPCODE_B_Y;

        case 'bo_l': return MAPCODE_T_L;
        case 'bo_zl': return MAPCODE_T_ZL;
        case 'bo_r': return MAPCODE_T_R;
        case 'bo_zr': return MAPCODE_T_ZR;

        case 'bo_plus': return MAPCODE_B_PLUS;
        case 'bo_minus': return MAPCODE_B_MINUS;
        case 'bo_stickl': return MAPCODE_B_STICKL;
        case 'bo_stickr': return MAPCODE_B_STICKR;
        default: return -1; // return -1 or throw an error if the id is invalid
    }
}

function _remap_get_input_mapcode(id) {
    switch (id) {
        case 'bm_dup': return MAPCODE_DUP;
        case 'bm_ddown': return MAPCODE_DDOWN;
        case 'bm_dleft': return MAPCODE_DLEFT;
        case 'bm_dright': return MAPCODE_DRIGHT;

        case 'bm_a': return MAPCODE_B_A;
        case 'bm_b': return MAPCODE_B_B;
        case 'bm_x': return MAPCODE_B_X;
        case 'bm_y': return MAPCODE_B_Y;

        case 'bm_l': return MAPCODE_T_L;
        case 'bm_zl': return MAPCODE_T_ZL;
        case 'bm_r': return MAPCODE_T_R;
        case 'bm_zr': return MAPCODE_T_ZR;

        case 'bm_plus': return MAPCODE_B_PLUS;
        case 'bm_minus': return MAPCODE_B_MINUS;
        case 'bm_stickl': return MAPCODE_B_STICKL;
        case 'bm_stickr': return MAPCODE_B_STICKR;
        default: return -1; // return -1 or throw an error if the id is invalid
    }
}

function _get_output_id(mapcode) {
    switch (mapcode) {
        case MAPCODE_DUP: return 'bo_dup';
        case MAPCODE_DDOWN: return 'bo_ddown';
        case MAPCODE_DLEFT: return 'bo_dleft';
        case MAPCODE_DRIGHT: return 'bo_dright';

        case MAPCODE_B_A: return 'bo_a';
        case MAPCODE_B_B: return 'bo_b';
        case MAPCODE_B_X: return 'bo_x';
        case MAPCODE_B_Y: return 'bo_y';

        case MAPCODE_T_L: return 'bo_l';
        case MAPCODE_T_ZL: return 'bo_zl';
        case MAPCODE_T_R: return 'bo_r';
        case MAPCODE_T_ZR: return 'bo_zr';

        case MAPCODE_B_PLUS: return 'bo_plus';
        case MAPCODE_B_MINUS: return 'bo_minus';
        case MAPCODE_B_STICKL: return 'bo_stickl';
        case MAPCODE_B_STICKR: return 'bo_stickr';
        default: return null; // return null or throw an error if the mapcode is invalid
    }
}

function _remap_enable_profile_radio(name, enable)
{
    var e = document.getElementById(name);
    e.style.display = (enable) ? "" : "none";
}

function remap_enable_menu(enable) {
    var c = capabilities_value_get();

    if(c!=null)
    {
        _remap_enable_profile_radio("rp_snes_label", c.nintendo_serial);
        //_remap_enable_profile_radio("rp_ginput_label", c.nintendo_joybus);
        // Always enabled because GC USB mode.
        _remap_enable_profile_radio("rp_n64_label", c.nintendo_joybus);
    }
    
    enable_dropdown_element("remapping-collapsible", enable);
}

function remap_place_values(data) {
    console.log(data);
    var unset = (data.getUint8(18) << 8) | (data.getUint8(19));

    // GC SP data is a subset of the remapping data
    // Place it here
    gcsp_place_value(data.getUint8(20), data.getUint8(21));

    var disabled = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];

    // First, account for any buttons that should be disabled
    for(var i = 0; i < 16; i++)
    {
        var code = (1<<i);

        if (code & unset)
        {
            disabled[i] = true;
            console.log(_remap_get_char(i) + " is disabled.");
        }

        remap_buttons[i].removeAttribute("disabled");
        remap_view[i].removeAttribute("disabled");
        remap_view[i].innerText="...";
        _remap_enable_profile_switcher(true);
    }

    // First, we place all relevant mappings
    for(var i = 0; i < 16; i++)
    {
        // Get the ID for our first element
        // This will get the element for which the button is assigned to OUTPUT
        var button_value = i;
        var button_output_value = data.getUint8(i+2);
        var el = document.getElementById(button_input_ids[button_output_value]);
        if (!disabled[button_value])
        {
            el.innerText = _remap_get_char(button_value);  
        }
    }

    
}

function _remap_place_profile_icons(mode) {
    const pro_map = {
        bo_dup: 'D\u2191',         // Unicode for upward arrow
        bo_ddown: 'D\u2193',      // Unicode for downward arrow
        bo_dleft: 'D\u2190',      // Unicode for leftward arrow
        bo_dright: 'D\u2192',     // Unicode for rightward arrow

        bo_a: 'A',
        bo_b: 'B',
        bo_x: 'X',
        bo_y: 'Y',

        bo_l: 'L',
        bo_zl: 'ZL',
        bo_r: 'R',
        bo_zr: 'ZR',

        bo_plus: '+',
        bo_minus: '-',
        bo_stickl: 'SL',
        bo_stickr: 'SR'
    };

    const xinput_map = {
        bo_dup: 'D\u2191',         // Unicode for upward arrow
        bo_ddown: 'D\u2193',      // Unicode for downward arrow
        bo_dleft: 'D\u2190',      // Unicode for leftward arrow
        bo_dright: 'D\u2192',     // Unicode for rightward arrow

        bo_a: 'A',
        bo_b: 'B',
        bo_x: 'X',
        bo_y: 'Y',

        bo_l: 'LB',
        bo_zl: 'LT',
        bo_r: 'RB',
        bo_zr: 'RT',

        bo_plus: 'Strt',
        bo_minus: 'Back',
        bo_stickl: 'SL',
        bo_stickr: 'SR'
    };

    const gamecube_map = {
        bo_dup: 'D\u2191',         // Unicode for upward arrow
        bo_ddown: 'D\u2193',      // Unicode for downward arrow
        bo_dleft: 'D\u2190',      // Unicode for leftward arrow
        bo_dright: 'D\u2192',     // Unicode for rightward arrow

        bo_a: 'A',
        bo_b: 'B',
        bo_x: 'X',
        bo_y: 'Y',

        bo_l: 'SP',
        bo_zl: 'LT',
        bo_r: 'Z',
        bo_zr: 'RT',

        bo_plus: 'Strt',
        bo_minus: '...',
        bo_stickl: '...',
        bo_stickr: '...'
    };

    const n64_map = {
        bo_dup: 'D\u2191',         // Unicode for upward arrow
        bo_ddown: 'D\u2193',      // Unicode for downward arrow
        bo_dleft: 'D\u2190',      // Unicode for leftward arrow
        bo_dright: 'D\u2192',     // Unicode for rightward arrow

        bo_a: 'A',
        bo_b: 'B',
        bo_x: 'C\u2191',
        bo_y: 'C\u2193',

        bo_l: 'C\u2190',
        bo_zl: 'Z',
        bo_r: 'C\u2192',
        bo_zr: 'R',

        bo_plus: 'Strt',
        bo_minus: 'L',
        bo_stickl: '...',
        bo_stickr: '...'
    };

    const snes_map = {
        bo_dup: 'D\u2191',         // Unicode for upward arrow
        bo_ddown: 'D\u2193',      // Unicode for downward arrow
        bo_dleft: 'D\u2190',      // Unicode for leftward arrow
        bo_dright: 'D\u2192',     // Unicode for rightward arrow

        bo_a: 'A',
        bo_b: 'B',
        bo_x: 'X',
        bo_y: 'Y',

        bo_l: 'L',
        bo_zl: '...',
        bo_r: 'R',
        bo_zr: '...',

        bo_plus: 'Strt',
        bo_minus: 'Sel',
        bo_stickl: '...',
        bo_stickr: '...'
    };

    var map;
    switch (mode) {
        default:
        case 0:
            map = pro_map;
            break;
        case 1:
            map = xinput_map;
            break;
        case 2:
            map = gamecube_map;
            break;
        case 3:
            map = n64_map;
            break;
        case 4:
            map = snes_map;
            break;
    }

    for (var i = 0; i < 16; i++) {
        var buttonID = remap_buttons[i].id;
        remap_buttons[i].innerText = map[buttonID];
        if (map[buttonID] == "...") {
            remap_buttons[i].setAttribute('unused', "true");
        }
        else {
            remap_buttons[i].removeAttribute('unused');
        }
    }
}

async function remap_switch_profile(mode) {
    current_mode = mode;
    _remap_place_profile_icons(mode);
    await  remap_get_values();
}

_remap_place_profile_icons(0)
