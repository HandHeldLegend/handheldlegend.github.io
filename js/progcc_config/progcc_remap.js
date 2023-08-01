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

let remap_buttons = document.getElementsByClassName("button-map-init");
let remap_labels = document.getElementsByClassName("button-map-view");

async function remap_init_new(code)
{
    for(let i = 0; i < remap_buttons.length; i++)
    {
        remap_buttons[i].setAttribute("disabled", true);
        if (_remap_get_mapcode(remap_labels[i].id) == code)
        {
            remap_labels[i].textContent = "...";
            remap_labels[i].setAttribute("disabled", true);
        }
    }

    var dataOut = new Uint8Array([WEBUSB_CMD_REMAP_SET, code]);
    
    await device.transferOut(2, dataOut);
}

async function remap_set_default()
{
    var dataOut = new Uint8Array([WEBUSB_CMD_REMAP_DEFAULT]);
    await device.transferOut(2, dataOut);
}

async function remap_get_values()
{
    var dataOut = new Uint8Array([WEBUSB_CMD_REMAP_GET]);
    await device.transferOut(2, dataOut);
}

function _remap_get_char(code)
{
    switch(code) {
        case MAPCODE_DUP:
            return '\u2191'; // Unicode for upward arrow
        case MAPCODE_DDOWN:
            return '\u2193'; // Unicode for downward arrow
        case MAPCODE_DLEFT:
            return '\u2190'; // Unicode for leftward arrow
        case MAPCODE_DRIGHT:
            return '\u2192'; // Unicode for rightward arrow

        case MAPCODE_B_A:
            return 'A';
        case MAPCODE_B_B:
            return 'B';
        case MAPCODE_B_X:
            return 'X';
        case MAPCODE_B_Y:
            return 'Y';

        case MAPCODE_T_L:
            return 'L';
        case MAPCODE_T_ZL:
            return 'ZL';
        case MAPCODE_T_R:
            return 'R';
        case MAPCODE_T_ZR:
            return 'ZR';

        case MAPCODE_B_PLUS:
            return '+';
        case MAPCODE_B_MINUS:
            return '-';
        case MAPCODE_B_STICKL:
            return 'SL';
        case MAPCODE_B_STICKR:
            return 'SR';

        default:
            return ''; // Return an empty string for invalid mapCode
    }
}

function _remap_get_mapcode(id) {
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

function remap_place_values(data)
{
    for(let i = 0; i < remap_labels.length; i++)
    {
        remap_buttons[i].removeAttribute("disabled");
        remap_labels[i].removeAttribute("disabled");

        // Get the map code based on what the current label is.
        let mp = _remap_get_mapcode(remap_labels[i].id);
        remap_labels[i].textContent = _remap_get_char(data.getUint8(mp+1));
    }
}