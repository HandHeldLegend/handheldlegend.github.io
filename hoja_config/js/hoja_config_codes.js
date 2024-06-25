const WEBUSB_CMD_FW_SET = 0x0F;
const WEBUSB_CMD_FW_GET = 0xAF;

const WEBUSB_CMD_BB_SET = 0xBB;

const WEBUSB_CMD_CAPABILITIES_GET = 0xBE;

const WEBUSB_CMD_RGB_SET = 0x01;
const WEBUSB_CMD_RGB_GET = 0xA1;

const WEBUSB_CMD_ANALOG_INVERT_SET = 0x02;
const WEBUSB_CMD_ANALOG_INVERT_GET = 0xA2;

const WEBUSB_CMD_CALIBRATION_START = 0x03;
const WEBUSB_CMD_CALIBRATION_STOP = 0xA3;

const WEBUSB_CMD_OCTAGON_SET = 0x04;

const WEBUSB_CMD_ANALYZE_START = 0x05;
const WEBUSB_CMD_ANALYZE_STOP = 0xA5;

const WEBUSB_CMD_REMAP_SET = 0x06;
const WEBUSB_CMD_REMAP_GET = 0xA6;

const WEBUSB_CMD_REMAP_DEFAULT = 0x07;

const WEBUSB_CMD_GCSP_SET = 0x08;

const WEBUSB_CMD_IMU_CALIBRATION_START = 0x09;

const WEBUSB_CMD_VIBRATE_SET = 0x0A;
const WEBUSB_CMD_VIBRATE_GET = 0xAA;

const WEBUSB_CMD_VIBRATEFLOOR_SET = 0x0B;
const WEBUSB_CMD_VIBRATEFLOOR_GET = 0xAB;

const WEBUSB_CMD_SUBANGLE_SET = 0x0C;
const WEBUSB_CMD_SUBANGLE_GET = 0xAC;

const WEBUSB_CMD_OCTOANGLE_SET = 0x0D;
const WEBUSB_CMD_OCTOANGLE_GET = 0xAD;

const WEBUSB_CMD_USERCYCLE_SET = 0x0E;
const WEBUSB_CMD_USERCYCLE_GET = 0xAE;

const WEBUSB_CMD_RGBMODE_SET = 0x10;
const WEBUSB_CMD_RGBMODE_GET = 0xB0;

const WEBUSB_CMD_INPUT_REPORT = 0xE0;

const WEBUSB_CMD_DEBUG_REPORT = 0xEE;

const WEBUSB_CMD_SAVEALL    = 0xF1;
const WEBUSB_CMD_HWTEST_GET = 0xF2;
const WEBUSB_CMD_RUMBLETEST_GET = 0xF3;

const WEBUSB_CMD_BATTERY_STATUS_GET = 0xF4;

const WEBUSB_CMD_DEADZONE_SET = 0x20;
const WEBUSB_CMD_DEADZONE_GET = 0x2A;

const WEBUSB_CMD_BOOTMODE_SET = 0x30;
const WEBUSB_CMD_BOOTMODE_GET = 0x3A;

const WEBUSB_CMD_TRIGGER_CALIBRATION_START  = 0x3B;
const WEBUSB_CMD_TRIGGER_CALIBRATION_STOP   = 0x3C;


const INPUT_MODE_SWPRO    = 0;
const INPUT_MODE_XINPUT   = 1;
const INPUT_MODE_GCUSB    = 2;
const INPUT_MODE_GAMECUBE = 3;
const INPUT_MODE_N64      = 4;
const INPUT_MODE_SNES     = 5;
const INPUT_MODE_DS4      = 6;