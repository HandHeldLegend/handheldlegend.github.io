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
let remap_view = document.getElementsByClassName("button-map-view");

async function remap_init_new(code)
{
    for(let i = 0; i < remap_view.length; i++)
    {
        remap_buttons[i].setAttribute("disabled", true);
        if(i==code)
        {
            var id = _get_id_from_mapcode(code);
            document.getElementById(id).setAttribute("disabled", true);
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
    var ret = "...";
    switch(code) {
        case MAPCODE_DUP:
            ret= '\u2191'; // Unicode for upward arrow
            break;
        case MAPCODE_DDOWN:
            ret= '\u2193'; // Unicode for downward arrow
            break;
        case MAPCODE_DLEFT:
            ret= '\u2190'; // Unicode for leftward arrow
            break;
        case MAPCODE_DRIGHT:
            ret= '\u2192'; // Unicode for rightward arrow
            break;

        case MAPCODE_B_A:
            ret= 'A';
            break;
        case MAPCODE_B_B:
            ret= 'B';
            break;
        case MAPCODE_B_X:
            ret= 'X';
            break;
        case MAPCODE_B_Y:
            ret= 'Y';
            break;

        case MAPCODE_T_L:
            ret= 'L';
            break;
        case MAPCODE_T_ZL:
            ret= 'ZL';
            break;
        case MAPCODE_T_R:
            ret= 'R';
            break;
        case MAPCODE_T_ZR:
            ret= 'ZR';
            break;

        case MAPCODE_B_PLUS:
            ret= '+';
            break;
        case MAPCODE_B_MINUS:
            ret= '-';
            break;
        case MAPCODE_B_STICKL:
            ret= 'SL';
            break;
        case MAPCODE_B_STICKR:
            ret= 'SR';
            break;

        default:
            ret=''; // Return an empty string for invalid mapCode
            break;
    }
    return ret;
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

function _get_id_from_mapcode(mapcode) {
    switch (mapcode) {
        case MAPCODE_DUP: return 'bm_dup';
        case MAPCODE_DDOWN: return 'bm_ddown';
        case MAPCODE_DLEFT: return 'bm_dleft';
        case MAPCODE_DRIGHT: return 'bm_dright';

        case MAPCODE_B_A: return 'bm_a';
        case MAPCODE_B_B: return 'bm_b';
        case MAPCODE_B_X: return 'bm_x';
        case MAPCODE_B_Y: return 'bm_y';

        case MAPCODE_T_L: return 'bm_l';
        case MAPCODE_T_ZL: return 'bm_zl';
        case MAPCODE_T_R: return 'bm_r';
        case MAPCODE_T_ZR: return 'bm_zr';

        case MAPCODE_B_PLUS: return 'bm_plus';
        case MAPCODE_B_MINUS: return 'bm_minus';
        case MAPCODE_B_STICKL: return 'bm_stickl';
        case MAPCODE_B_STICKR: return 'bm_stickr';
        default: return null; // return null or throw an error if the mapcode is invalid
    }
}

function remap_place_values(data)
{
    var unset = (data.getUint8(17)<<8) | (data.getUint8(18));

    // Find the index of the value mapped to this button
    for(var u = 0; u < 16; u++)
    {
        //console.log(remap_view[u].id);
        var output_mapcode = _remap_get_mapcode(remap_view[u].id);
        //console.log(output_mapcode);
        var assignment = data.getUint8(output_mapcode+1);
        //console.log(assignment);
        var out_char = _remap_get_char(assignment);
        //console.log(out_char);

        // Check if the button has no output enabled
        var bit = (1<<output_mapcode) & unset;
        //console.log(bit);

        if (bit>0)
        {
            // Button is unset, make sure its ID is cleared
            //console.log(remap_view[u].id + " is disabled.");
            remap_view[u].innerText = "...";
        }
        else
        {
            //console.log("X");
            remap_view[u].innerText = out_char;
        }

        remap_view[u].removeAttribute("disabled");
        remap_buttons[u].removeAttribute("disabled");
    }

}