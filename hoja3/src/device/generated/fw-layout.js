// GENERATED FILE — do not edit by hand.
// Source of truth: HOJA-LIB-RP2040 headers (include/hoja_shared_types.h, include/input_shared_types.h, include/settings_shared_types.h, include/utilities/static_config.h).
// Regenerate with: node tools/sync-firmware.mjs   (source: local HandHeldLegend/HOJA-LIB-RP2040@b840192)
// Validated 4 size assertion(s) from the firmware headers.
export default {
 "source": {
  "kind": "local",
  "repo": "HandHeldLegend/HOJA-LIB-RP2040",
  "ref": "b840192"
 },
 "blocks": {
  "config": [
   {
    "index": 0,
    "key": "gamepad",
    "struct": "gamepadConfig_s"
   },
   {
    "index": 1,
    "key": "hover",
    "struct": "hoverConfig_s"
   },
   {
    "index": 2,
    "key": "analog",
    "struct": "analogConfig_s"
   },
   {
    "index": 3,
    "key": "rgb",
    "struct": "rgbConfig_s"
   },
   {
    "index": 4,
    "key": "trigger",
    "struct": "triggerConfig_s"
   },
   {
    "index": 5,
    "key": "imu",
    "struct": "imuConfig_s"
   },
   {
    "index": 6,
    "key": "haptic",
    "struct": "hapticConfig_s"
   },
   {
    "index": 7,
    "key": "user",
    "struct": "userConfig_s"
   },
   {
    "index": 8,
    "key": "input",
    "struct": "inputConfig_s"
   }
  ],
  "static": [
   {
    "index": 0,
    "key": "device",
    "struct": "deviceInfoStatic_s"
   },
   {
    "index": 1,
    "key": "input",
    "struct": "inputInfoStatic_s"
   },
   {
    "index": 2,
    "key": "analog",
    "struct": "analogInfoStatic_s"
   },
   {
    "index": 3,
    "key": "haptic",
    "struct": "hapticInfoStatic_s"
   },
   {
    "index": 4,
    "key": "imu",
    "struct": "imuInfoStatic_s"
   },
   {
    "index": 5,
    "key": "battery",
    "struct": "batteryInfoStatic_s"
   },
   {
    "index": 6,
    "key": "bluetooth",
    "struct": "bluetoothInfoStatic_s"
   },
   {
    "index": 7,
    "key": "rgb",
    "struct": "rgbInfoStatic_s"
   }
  ]
 },
 "commands": {
  "gamepad": {
   "REFRESH": 0,
   "RESET_TO_BOOTLOADER": 1,
   "ENABLE_BLUETOOTH_UPLOAD": 2,
   "SAVE_ALL": 255
  },
  "input": {
   "REFRESH": 0,
   "DEFAULT_ALL": 1,
   "DEFAULT_SWITCH": 2,
   "DEFAULT_XINPUT": 3,
   "DEFAULT_SNES": 4,
   "DEFAULT_N64": 5,
   "DEFAULT_GAMECUBE": 6,
   "DEFAULT_SINPUT": 7,
   "WEBUSB_SWITCH": 8,
   "WEBUSB_XINPUT": 9,
   "WEBUSB_SNES": 10,
   "WEBUSB_N64": 11,
   "WEBUSB_GAMECUBE": 12,
   "WEBUSB_SINPUT": 13
  },
  "analog": {
   "REFRESH": 0,
   "CALIBRATE_START": 1,
   "CALIBRATE_STOP": 2,
   "CAPTURE_JOYSTICK_LEFT": 3,
   "CAPTURE_JOYSTICK_RIGHT": 4
  },
  "rgb": {
   "REFRESH": 0
  },
  "imu": {
   "REFRESH": 0,
   "CALIBRATE_START": 1
  },
  "haptic": {
   "REFRESH": 0,
   "TEST_STRENGTH": 1
  }
 },
 "structs": {
  "userConfig_s": {
   "size": 64,
   "fields": [
    {
     "name": "user_config_version",
     "offset": 0,
     "type": "u8"
    },
    {
     "name": "user_name",
     "offset": 1,
     "type": "u8",
     "count": 24
    },
    {
     "name": "reserved",
     "offset": 25,
     "type": "u8",
     "count": 39
    }
   ]
  },
  "hapticConfig_s": {
   "size": 8,
   "fields": [
    {
     "name": "haptic_config_version",
     "offset": 0,
     "type": "u8"
    },
    {
     "name": "haptic_strength",
     "offset": 1,
     "type": "u8"
    },
    {
     "name": "haptic_triggers",
     "offset": 2,
     "type": "u8"
    },
    {
     "name": "reserved",
     "offset": 3,
     "type": "u8",
     "count": 5
    }
   ]
  },
  "imuConfig_s": {
   "size": 32,
   "fields": [
    {
     "name": "imu_config_version",
     "offset": 0,
     "type": "u8"
    },
    {
     "name": "imu_a_gyro_offsets",
     "offset": 1,
     "type": "i8",
     "count": 3
    },
    {
     "name": "imu_a_accel_config",
     "offset": 4,
     "type": "i8",
     "count": 3
    },
    {
     "name": "imu_b_gyro_offsets",
     "offset": 7,
     "type": "i8",
     "count": 3
    },
    {
     "name": "imu_b_accel_config",
     "offset": 10,
     "type": "i8",
     "count": 3
    },
    {
     "name": "imu_disabled",
     "offset": 13,
     "type": "u8"
    },
    {
     "name": "imu_gyro_sensitivity",
     "offset": 14,
     "type": "u8",
     "count": 3,
     "doc": "X, Y, Z — default 120 (1.20x)"
    },
    {
     "name": "imu_accel_sensitivity",
     "offset": 17,
     "type": "u8",
     "count": 3,
     "doc": "X, Y, Z — default 100 (1.00x)"
    },
    {
     "name": "reserved",
     "offset": 20,
     "type": "u8",
     "count": 12
    }
   ]
  },
  "triggerConfig_s": {
   "size": 64,
   "fields": [
    {
     "name": "reserved",
     "offset": 0,
     "type": "u8",
     "count": 64
    }
   ]
  },
  "dpadConfig_s": {
   "size": 4,
   "fields": [
    {
     "name": "dpad_config_version",
     "offset": 0,
     "type": "u8"
    },
    {
     "name": "socd_type",
     "offset": 1,
     "type": "u8"
    },
    {
     "name": "dpad_deadzone",
     "offset": 2,
     "type": "u16"
    }
   ]
  },
  "joyConfigSlot_s": {
   "size": 21,
   "fields": [
    {
     "name": "in_angle",
     "offset": 0,
     "type": "f32"
    },
    {
     "name": "out_angle",
     "offset": 4,
     "type": "f32"
    },
    {
     "name": "deadzone",
     "offset": 8,
     "type": "f32"
    },
    {
     "name": "in_distance",
     "offset": 12,
     "type": "f32"
    },
    {
     "name": "out_distance",
     "offset": 16,
     "type": "f32"
    },
    {
     "name": "enabled",
     "offset": 20,
     "type": "u8"
    }
   ]
  },
  "analogConfig_s": {
   "size": 1024,
   "fields": [
    {
     "name": "analog_config_version",
     "offset": 0,
     "type": "u8"
    },
    {
     "name": "analog_calibration_set",
     "offset": 1,
     "type": "u8"
    },
    {
     "name": "lx_invert",
     "type": "u16",
     "offset": 2,
     "bits": {
      "shift": 0,
      "width": 1
     }
    },
    {
     "name": "lx_center",
     "type": "u16",
     "offset": 2,
     "bits": {
      "shift": 1,
      "width": 15
     }
    },
    {
     "name": "ly_invert",
     "type": "u16",
     "offset": 4,
     "bits": {
      "shift": 0,
      "width": 1
     }
    },
    {
     "name": "ly_center",
     "type": "u16",
     "offset": 4,
     "bits": {
      "shift": 1,
      "width": 15
     }
    },
    {
     "name": "rx_invert",
     "type": "u16",
     "offset": 6,
     "bits": {
      "shift": 0,
      "width": 1
     }
    },
    {
     "name": "rx_center",
     "type": "u16",
     "offset": 6,
     "bits": {
      "shift": 1,
      "width": 15
     }
    },
    {
     "name": "ry_invert",
     "type": "u16",
     "offset": 8,
     "bits": {
      "shift": 0,
      "width": 1
     }
    },
    {
     "name": "ry_center",
     "type": "u16",
     "offset": 8,
     "bits": {
      "shift": 1,
      "width": 15
     }
    },
    {
     "name": "joy_config_l",
     "offset": 10,
     "struct": "joyConfigSlot_s",
     "count": 16
    },
    {
     "name": "joy_config_r",
     "offset": 346,
     "struct": "joyConfigSlot_s",
     "count": 16
    },
    {
     "name": "l_deadzone",
     "offset": 682,
     "type": "u16"
    },
    {
     "name": "r_deadzone",
     "offset": 684,
     "type": "u16"
    },
    {
     "name": "l_snapback_type",
     "offset": 686,
     "type": "u8"
    },
    {
     "name": "r_snapback_type",
     "offset": 687,
     "type": "u8"
    },
    {
     "name": "l_deadzone_outer",
     "offset": 688,
     "type": "u16"
    },
    {
     "name": "r_deadzone_outer",
     "offset": 690,
     "type": "u16"
    },
    {
     "name": "l_snapback_intensity",
     "offset": 692,
     "type": "u16"
    },
    {
     "name": "r_snapback_intensity",
     "offset": 694,
     "type": "u16"
    },
    {
     "name": "l_exp_scaler",
     "offset": 696,
     "type": "u8",
     "doc": "Offset-encoded exponent (see ANALOG_EXP_*)"
    },
    {
     "name": "r_exp_scaler",
     "offset": 697,
     "type": "u8"
    },
    {
     "name": "reserved",
     "offset": 698,
     "type": "u8",
     "count": 326
    }
   ]
  },
  "rgbConfig_s": {
   "size": 256,
   "fields": [
    {
     "name": "rgb_config_version",
     "offset": 0,
     "type": "u8"
    },
    {
     "name": "rgb_mode",
     "offset": 1,
     "type": "u8"
    },
    {
     "name": "rgb_speed",
     "offset": 2,
     "type": "u16",
     "doc": "RGB Speed in ms"
    },
    {
     "name": "rgb_colors",
     "offset": 4,
     "type": "u32",
     "count": 32,
     "doc": "Store 32 RGB colors"
    },
    {
     "name": "rgb_brightness",
     "offset": 132,
     "type": "u16",
     "doc": "4096 range"
    },
    {
     "name": "rgb_idle_glow",
     "offset": 134,
     "type": "u8"
    },
    {
     "name": "reserved",
     "offset": 135,
     "type": "u8",
     "count": 121
    }
   ]
  },
  "gamepadConfig_s": {
   "size": 64,
   "fields": [
    {
     "name": "gamepad_config_version",
     "offset": 0,
     "type": "u8"
    },
    {
     "name": "gamepad_default_mode",
     "offset": 1,
     "type": "u8",
     "doc": "core_reportformat_t value (0=SWPRO .. 6=SINPUT)"
    },
    {
     "name": "gamepad_mac_address",
     "offset": 2,
     "type": "u8",
     "count": 6,
     "doc": "Device BASE MAC Address"
    },
    {
     "name": "gamepad_color_body",
     "offset": 8,
     "type": "u32"
    },
    {
     "name": "gamepad_color_buttons",
     "offset": 12,
     "type": "u32"
    },
    {
     "name": "gamepad_color_grip_left",
     "offset": 16,
     "type": "u32"
    },
    {
     "name": "gamepad_color_grip_right",
     "offset": 20,
     "type": "u32"
    },
    {
     "name": "host_mac_switch",
     "offset": 24,
     "type": "u8",
     "count": 6,
     "doc": "Mac address of the Switch we are paired to"
    },
    {
     "name": "host_mac_sinput",
     "offset": 30,
     "type": "u8",
     "count": 6,
     "doc": "Mac address of the SInput device we are paired to"
    },
    {
     "name": "webusb_enable_popup",
     "offset": 36,
     "type": "u8",
     "doc": "Whether or not the WebUSB toast should show"
    },
    {
     "name": "wlan_dongle_key",
     "offset": 37,
     "type": "u16",
     "doc": "WLAN dongle pairing pin (0000-9999)"
    },
    {
     "name": "reserved",
     "offset": 39,
     "type": "u8",
     "count": 25
    }
   ]
  },
  "hoverSlot_s": {
   "size": 4,
   "fields": [
    {
     "name": "invert",
     "type": "u16",
     "offset": 0,
     "bits": {
      "shift": 0,
      "width": 1
     }
    },
    {
     "name": "min",
     "type": "u16",
     "offset": 0,
     "bits": {
      "shift": 1,
      "width": 15
     }
    },
    {
     "name": "max",
     "offset": 2,
     "type": "u16"
    }
   ]
  },
  "hoverConfig_s": {
   "size": 256,
   "fields": [
    {
     "name": "hover_config_version",
     "offset": 0,
     "type": "u8"
    },
    {
     "name": "hover_calibration_set",
     "offset": 1,
     "type": "u8"
    },
    {
     "name": "config",
     "offset": 2,
     "struct": "hoverSlot_s",
     "count": 36
    },
    {
     "name": "reserved",
     "offset": 146,
     "type": "u8",
     "count": 110
    }
   ]
  },
  "inputConfigSlot_s": {
   "size": 5,
   "fields": [
    {
     "name": "output_mode",
     "type": "u16",
     "offset": 0,
     "bits": {
      "shift": 0,
      "width": 3
     },
     "doc": "0=default, 1=rapid trigger, 2=threshold"
    },
    {
     "name": "static_output",
     "type": "u16",
     "offset": 0,
     "bits": {
      "shift": 3,
      "width": 13
     },
     "doc": "Output that is used when this input is pressed"
    },
    {
     "name": "threshold_delta",
     "offset": 2,
     "type": "u16",
     "doc": "Either a threshold for digital press or a delta for rapid trigger"
    },
    {
     "name": "output_code",
     "offset": 4,
     "type": "i8",
     "doc": "Code for what this outputs or is assigned to"
    }
   ]
  },
  "inputConfig_s": {
   "size": 2048,
   "fields": [
    {
     "name": "input_config_version",
     "offset": 0,
     "type": "u8"
    },
    {
     "name": "input_profile_switch",
     "offset": 1,
     "struct": "inputConfigSlot_s",
     "count": 36
    },
    {
     "name": "input_profile_xinput",
     "offset": 181,
     "struct": "inputConfigSlot_s",
     "count": 36
    },
    {
     "name": "input_profile_snes",
     "offset": 361,
     "struct": "inputConfigSlot_s",
     "count": 36
    },
    {
     "name": "input_profile_n64",
     "offset": 541,
     "struct": "inputConfigSlot_s",
     "count": 36
    },
    {
     "name": "input_profile_gamecube",
     "offset": 721,
     "struct": "inputConfigSlot_s",
     "count": 36
    },
    {
     "name": "input_profile_sinput",
     "offset": 901,
     "struct": "inputConfigSlot_s",
     "count": 36
    },
    {
     "name": "input_profile_reserved_2",
     "offset": 1081,
     "struct": "inputConfigSlot_s",
     "count": 36
    },
    {
     "name": "reserved",
     "offset": 1261,
     "type": "u8",
     "count": 787
    }
   ]
  },
  "switchpairConfig_s": {
   "size": 64,
   "fields": [
    {
     "name": "switchpair_config_version",
     "offset": 0,
     "type": "u8"
    },
    {
     "name": "link_key",
     "offset": 1,
     "type": "u8",
     "count": 16
    },
    {
     "name": "reserved",
     "offset": 17,
     "type": "u8",
     "count": 47
    }
   ]
  },
  "deviceInfoStatic_s": {
   "size": 802,
   "fields": [
    {
     "name": "name",
     "offset": 0,
     "type": "u8",
     "count": 16
    },
    {
     "name": "maker",
     "offset": 16,
     "type": "u8",
     "count": 16
    },
    {
     "name": "manifest_url",
     "offset": 32,
     "type": "u8",
     "count": 256
    },
    {
     "name": "firmware_url",
     "offset": 288,
     "type": "u8",
     "count": 256
    },
    {
     "name": "manual_url",
     "offset": 544,
     "type": "u8",
     "count": 128
    },
    {
     "name": "reserved",
     "offset": 672,
     "type": "u8",
     "count": 32
    },
    {
     "name": "fw_version",
     "offset": 704,
     "type": "u32"
    },
    {
     "name": "snes_supported",
     "type": "u8",
     "offset": 708,
     "bits": {
      "shift": 0,
      "width": 1
     }
    },
    {
     "name": "joybus_supported",
     "type": "u8",
     "offset": 708,
     "bits": {
      "shift": 1,
      "width": 1
     }
    },
    {
     "name": "reserved_bits",
     "type": "u8",
     "offset": 708,
     "bits": {
      "shift": 2,
      "width": 6
     }
    },
    {
     "name": "reserved_bytes",
     "offset": 709,
     "type": "u8",
     "count": 93
    }
   ]
  },
  "inputInfoSlot_s": {
   "size": 10,
   "fields": [
    {
     "name": "input_type",
     "offset": 0,
     "type": "u8",
     "doc": "0=unused, 1=digital, 2=hover, 3=joystick"
    },
    {
     "name": "input_name",
     "offset": 1,
     "type": "u8",
     "count": 8,
     "doc": "Char name of input"
    },
    {
     "name": "rgb_group",
     "offset": 9,
     "type": "u8",
     "doc": "Which RGB group is correlated with this input via key_mappings (Results are -1, 0 is unused)"
    }
   ]
  },
  "inputInfoStatic_s": {
   "size": 360,
   "fields": [
    {
     "name": "input_info",
     "offset": 0,
     "struct": "inputInfoSlot_s",
     "count": 36
    }
   ]
  },
  "analogInfoStatic_s": {
   "size": 1,
   "fields": [
    {
     "name": "axis_lx",
     "type": "u8",
     "offset": 0,
     "bits": {
      "shift": 0,
      "width": 1
     }
    },
    {
     "name": "axis_ly",
     "type": "u8",
     "offset": 0,
     "bits": {
      "shift": 1,
      "width": 1
     }
    },
    {
     "name": "axis_rx",
     "type": "u8",
     "offset": 0,
     "bits": {
      "shift": 2,
      "width": 1
     }
    },
    {
     "name": "axis_ry",
     "type": "u8",
     "offset": 0,
     "bits": {
      "shift": 3,
      "width": 1
     }
    },
    {
     "name": "axis_lt",
     "type": "u8",
     "offset": 0,
     "bits": {
      "shift": 4,
      "width": 1
     }
    },
    {
     "name": "axis_rt",
     "type": "u8",
     "offset": 0,
     "bits": {
      "shift": 5,
      "width": 1
     }
    },
    {
     "name": "invert_allowed",
     "type": "u8",
     "offset": 0,
     "bits": {
      "shift": 6,
      "width": 1
     }
    },
    {
     "name": "reserved",
     "type": "u8",
     "offset": 0,
     "bits": {
      "shift": 7,
      "width": 1
     }
    }
   ]
  },
  "imuInfoStatic_s": {
   "size": 1,
   "fields": [
    {
     "name": "axis_gyro_a",
     "type": "u8",
     "offset": 0,
     "bits": {
      "shift": 0,
      "width": 1
     }
    },
    {
     "name": "axis_gyro_b",
     "type": "u8",
     "offset": 0,
     "bits": {
      "shift": 1,
      "width": 1
     }
    },
    {
     "name": "axis_accel_a",
     "type": "u8",
     "offset": 0,
     "bits": {
      "shift": 2,
      "width": 1
     }
    },
    {
     "name": "axis_accel_b",
     "type": "u8",
     "offset": 0,
     "bits": {
      "shift": 3,
      "width": 1
     }
    },
    {
     "name": "reserved",
     "type": "u8",
     "offset": 0,
     "bits": {
      "shift": 4,
      "width": 4
     }
    }
   ]
  },
  "batteryInfoStatic_s": {
   "size": 76,
   "fields": [
    {
     "name": "battery_capacity_mah",
     "offset": 0,
     "type": "u16"
    },
    {
     "name": "battery_part_number",
     "offset": 2,
     "type": "u8",
     "count": 24
    },
    {
     "name": "pmic_status",
     "offset": 26,
     "type": "u8"
    },
    {
     "name": "pmic_part_number",
     "offset": 27,
     "type": "u8",
     "count": 24
    },
    {
     "name": "fuelgauge_status",
     "offset": 51,
     "type": "u8"
    },
    {
     "name": "fuelgauge_part_number",
     "offset": 52,
     "type": "u8",
     "count": 24
    }
   ]
  },
  "hapticInfoStatic_s": {
   "size": 1,
   "fields": [
    {
     "name": "haptic_hd",
     "type": "u8",
     "offset": 0,
     "bits": {
      "shift": 0,
      "width": 1
     }
    },
    {
     "name": "haptic_sd",
     "type": "u8",
     "offset": 0,
     "bits": {
      "shift": 1,
      "width": 1
     }
    },
    {
     "name": "reserved",
     "type": "u8",
     "offset": 0,
     "bits": {
      "shift": 2,
      "width": 6
     }
    }
   ]
  },
  "bluetoothInfoStatic_s": {
   "size": 55,
   "fields": [
    {
     "name": "part_number",
     "offset": 0,
     "type": "u8",
     "count": 24
    },
    {
     "name": "external_update_supported",
     "offset": 24,
     "type": "u8"
    },
    {
     "name": "external_version_number",
     "offset": 25,
     "type": "u16"
    },
    {
     "name": "bluetooth_bdr_supported",
     "offset": 27,
     "type": "u8"
    },
    {
     "name": "bluetooth_ble_supported",
     "offset": 28,
     "type": "u8"
    },
    {
     "name": "wireless_part_status",
     "offset": 29,
     "type": "u8"
    },
    {
     "name": "fcc_id",
     "offset": 30,
     "type": "u8",
     "count": 24
    },
    {
     "name": "wlan_supported",
     "offset": 54,
     "type": "u8",
     "doc": "1 when RPI RM2 WLAN dongle transport is available"
    }
   ]
  },
  "rgbGroupName_s": {
   "size": 8,
   "fields": [
    {
     "name": "rgb_group_name",
     "offset": 0,
     "type": "u8",
     "count": 8
    }
   ]
  },
  "rgbInfoStatic_s": {
   "size": 258,
   "fields": [
    {
     "name": "rgb_groups",
     "offset": 0,
     "type": "u8"
    },
    {
     "name": "rgb_group_names",
     "offset": 1,
     "struct": "rgbGroupName_s",
     "count": 32
    },
    {
     "name": "rgb_player_group",
     "offset": 257,
     "type": "i8"
    }
   ]
  }
 },
 "enums": {
  "connection_status_t": [
   {
    "name": "CONNECTION_STATUS_DOWN",
    "value": 0
   },
   {
    "name": "CONNECTION_STATUS_CONNECTED",
    "value": 1
   },
   {
    "name": "CONNECTION_STATUS_DISCONNECTED",
    "value": 2
   }
  ],
  "core_reportformat_t": [
   {
    "name": "CORE_REPORTFORMAT_UNDEFINED",
    "value": -1
   },
   {
    "name": "CORE_REPORTFORMAT_SWPRO",
    "value": 0
   },
   {
    "name": "CORE_REPORTFORMAT_XINPUT",
    "value": 1
   },
   {
    "name": "CORE_REPORTFORMAT_SLIPPI",
    "value": 2
   },
   {
    "name": "CORE_REPORTFORMAT_GAMECUBE",
    "value": 3
   },
   {
    "name": "CORE_REPORTFORMAT_N64",
    "value": 4
   },
   {
    "name": "CORE_REPORTFORMAT_SNES",
    "value": 5
   },
   {
    "name": "CORE_REPORTFORMAT_SINPUT",
    "value": 6
   },
   {
    "name": "CORE_REPORTFORMAT_MAX",
    "value": 7
   }
  ],
  "gamepad_method_t": [
   {
    "name": "GAMEPAD_METHOD_AUTO",
    "value": -1,
    "doc": "Automatically determine if we are plugged or wireless"
   },
   {
    "name": "GAMEPAD_METHOD_WIRED",
    "value": 0,
    "doc": "Used for modes that should retain power even when unplugged"
   },
   {
    "name": "GAMEPAD_METHOD_USB",
    "value": 1,
    "doc": "Use for USB modes where we should power off when unplugged"
   },
   {
    "name": "GAMEPAD_METHOD_BLUETOOTH",
    "value": 2,
    "doc": "Wireless Bluetooth modes"
   },
   {
    "name": "GAMEPAD_METHOD_WLAN",
    "value": 3,
    "doc": "Wireless WLAN modes (dongle)"
   }
  ],
  "gamepad_transport_t": [
   {
    "name": "GAMEPAD_TRANSPORT_UNDEFINED",
    "value": -2
   },
   {
    "name": "GAMEPAD_TRANSPORT_AUTO",
    "value": -1
   },
   {
    "name": "GAMEPAD_TRANSPORT_NESBUS",
    "value": 0
   },
   {
    "name": "GAMEPAD_TRANSPORT_JOYBUS64",
    "value": 1
   },
   {
    "name": "GAMEPAD_TRANSPORT_JOYBUSGC",
    "value": 2
   },
   {
    "name": "GAMEPAD_TRANSPORT_USB",
    "value": 3
   },
   {
    "name": "GAMEPAD_TRANSPORT_BLUETOOTH",
    "value": 4
   },
   {
    "name": "GAMEPAD_TRANSPORT_WLAN",
    "value": 5
   }
  ],
  "mapper_input_type_t": [
   {
    "name": "MAPPER_INPUT_TYPE_UNUSED",
    "value": 0,
    "doc": "Input is disabled"
   },
   {
    "name": "MAPPER_INPUT_TYPE_DIGITAL",
    "value": 1,
    "doc": "Binary off or on"
   },
   {
    "name": "MAPPER_INPUT_TYPE_HOVER",
    "value": 2,
    "doc": "Analog input 0-4095 (12 bits)"
   },
   {
    "name": "MAPPER_INPUT_TYPE_JOYSTICK",
    "value": 3,
    "doc": "Analog input 0-2048 (half of 12 bit range)"
   }
  ],
  "mapper_output_type_t": [
   {
    "name": "MAPPER_OUTPUT_DISABLED",
    "value": 0
   },
   {
    "name": "MAPPER_OUTPUT_DIGITAL",
    "value": 1
   },
   {
    "name": "MAPPER_OUTPUT_HOVER",
    "value": 2
   },
   {
    "name": "MAPPER_OUTPUT_JOYSTICK",
    "value": 3
   },
   {
    "name": "MAPPER_OUTPUT_DPAD",
    "value": 4
   }
  ],
  "mapper_input_code_t": [
   {
    "name": "INPUT_CODE_UNUSED",
    "value": -1
   },
   {
    "name": "INPUT_CODE_SOUTH",
    "value": 0
   },
   {
    "name": "INPUT_CODE_EAST",
    "value": 1
   },
   {
    "name": "INPUT_CODE_WEST",
    "value": 2
   },
   {
    "name": "INPUT_CODE_NORTH",
    "value": 3
   },
   {
    "name": "INPUT_CODE_UP",
    "value": 4
   },
   {
    "name": "INPUT_CODE_DOWN",
    "value": 5
   },
   {
    "name": "INPUT_CODE_LEFT",
    "value": 6
   },
   {
    "name": "INPUT_CODE_RIGHT",
    "value": 7
   },
   {
    "name": "INPUT_CODE_LB",
    "value": 8
   },
   {
    "name": "INPUT_CODE_RB",
    "value": 9
   },
   {
    "name": "INPUT_CODE_LT",
    "value": 10
   },
   {
    "name": "INPUT_CODE_LT_ANALOG",
    "value": 11
   },
   {
    "name": "INPUT_CODE_RT",
    "value": 12
   },
   {
    "name": "INPUT_CODE_RT_ANALOG",
    "value": 13
   },
   {
    "name": "INPUT_CODE_LP1",
    "value": 14
   },
   {
    "name": "INPUT_CODE_RP1",
    "value": 15
   },
   {
    "name": "INPUT_CODE_LP2",
    "value": 16
   },
   {
    "name": "INPUT_CODE_RP2",
    "value": 17
   },
   {
    "name": "INPUT_CODE_START",
    "value": 18
   },
   {
    "name": "INPUT_CODE_SELECT",
    "value": 19
   },
   {
    "name": "INPUT_CODE_HOME",
    "value": 20
   },
   {
    "name": "INPUT_CODE_SHARE",
    "value": 21
   },
   {
    "name": "INPUT_CODE_MISC3",
    "value": 22
   },
   {
    "name": "INPUT_CODE_MISC4",
    "value": 23
   },
   {
    "name": "INPUT_CODE_TP1",
    "value": 24
   },
   {
    "name": "INPUT_CODE_TP2",
    "value": 25
   },
   {
    "name": "INPUT_CODE_LS",
    "value": 26
   },
   {
    "name": "INPUT_CODE_LX_RIGHT",
    "value": 27
   },
   {
    "name": "INPUT_CODE_LX_LEFT",
    "value": 28
   },
   {
    "name": "INPUT_CODE_LY_UP",
    "value": 29
   },
   {
    "name": "INPUT_CODE_LY_DOWN",
    "value": 30
   },
   {
    "name": "INPUT_CODE_RS",
    "value": 31
   },
   {
    "name": "INPUT_CODE_RX_RIGHT",
    "value": 32
   },
   {
    "name": "INPUT_CODE_RX_LEFT",
    "value": 33
   },
   {
    "name": "INPUT_CODE_RY_UP",
    "value": 34
   },
   {
    "name": "INPUT_CODE_RY_DOWN",
    "value": 35
   },
   {
    "name": "INPUT_CODE_MAX",
    "value": 36
   }
  ],
  "mapper_switch_code_t": [
   {
    "name": "SWITCH_CODE_UNUSED",
    "value": -1
   },
   {
    "name": "SWITCH_CODE_A",
    "value": 0
   },
   {
    "name": "SWITCH_CODE_B",
    "value": 1
   },
   {
    "name": "SWITCH_CODE_X",
    "value": 2
   },
   {
    "name": "SWITCH_CODE_Y",
    "value": 3
   },
   {
    "name": "SWITCH_CODE_UP",
    "value": 4
   },
   {
    "name": "SWITCH_CODE_DOWN",
    "value": 5
   },
   {
    "name": "SWITCH_CODE_LEFT",
    "value": 6
   },
   {
    "name": "SWITCH_CODE_RIGHT",
    "value": 7
   },
   {
    "name": "SWITCH_CODE_L",
    "value": 8
   },
   {
    "name": "SWITCH_CODE_R",
    "value": 9
   },
   {
    "name": "SWITCH_CODE_ZL",
    "value": 10
   },
   {
    "name": "SWITCH_CODE_ZR",
    "value": 11
   },
   {
    "name": "SWITCH_CODE_PLUS",
    "value": 12
   },
   {
    "name": "SWITCH_CODE_MINUS",
    "value": 13
   },
   {
    "name": "SWITCH_CODE_HOME",
    "value": 14
   },
   {
    "name": "SWITCH_CODE_CAPTURE",
    "value": 15
   },
   {
    "name": "SWITCH_CODE_LS",
    "value": 16
   },
   {
    "name": "SWITCH_CODE_RS",
    "value": 17
   },
   {
    "name": "SWITCH_CODE_LX_RIGHT",
    "value": 18
   },
   {
    "name": "SWITCH_CODE_LX_LEFT",
    "value": 19
   },
   {
    "name": "SWITCH_CODE_LY_UP",
    "value": 20
   },
   {
    "name": "SWITCH_CODE_LY_DOWN",
    "value": 21
   },
   {
    "name": "SWITCH_CODE_RX_RIGHT",
    "value": 22
   },
   {
    "name": "SWITCH_CODE_RX_LEFT",
    "value": 23
   },
   {
    "name": "SWITCH_CODE_RY_UP",
    "value": 24
   },
   {
    "name": "SWITCH_CODE_RY_DOWN",
    "value": 25
   },
   {
    "name": "SWITCH_CODE_MAX",
    "value": 26
   }
  ],
  "mapper_snes_code_t": [
   {
    "name": "SNES_CODE_UNUSED",
    "value": -1
   },
   {
    "name": "SNES_CODE_A",
    "value": 0
   },
   {
    "name": "SNES_CODE_B",
    "value": 1
   },
   {
    "name": "SNES_CODE_X",
    "value": 2
   },
   {
    "name": "SNES_CODE_Y",
    "value": 3
   },
   {
    "name": "SNES_CODE_UP",
    "value": 4
   },
   {
    "name": "SNES_CODE_DOWN",
    "value": 5
   },
   {
    "name": "SNES_CODE_LEFT",
    "value": 6
   },
   {
    "name": "SNES_CODE_RIGHT",
    "value": 7
   },
   {
    "name": "SNES_CODE_L",
    "value": 8
   },
   {
    "name": "SNES_CODE_R",
    "value": 9
   },
   {
    "name": "SNES_CODE_START",
    "value": 10
   },
   {
    "name": "SNES_CODE_SELECT",
    "value": 11
   },
   {
    "name": "SNES_CODE_MAX",
    "value": 12
   }
  ],
  "mapper_n64_code_t": [
   {
    "name": "N64_CODE_UNUSED",
    "value": -1
   },
   {
    "name": "N64_CODE_A",
    "value": 0
   },
   {
    "name": "N64_CODE_B",
    "value": 1
   },
   {
    "name": "N64_CODE_CUP",
    "value": 2
   },
   {
    "name": "N64_CODE_CDOWN",
    "value": 3
   },
   {
    "name": "N64_CODE_CLEFT",
    "value": 4
   },
   {
    "name": "N64_CODE_CRIGHT",
    "value": 5
   },
   {
    "name": "N64_CODE_UP",
    "value": 6
   },
   {
    "name": "N64_CODE_DOWN",
    "value": 7
   },
   {
    "name": "N64_CODE_LEFT",
    "value": 8
   },
   {
    "name": "N64_CODE_RIGHT",
    "value": 9
   },
   {
    "name": "N64_CODE_L",
    "value": 10
   },
   {
    "name": "N64_CODE_R",
    "value": 11
   },
   {
    "name": "N64_CODE_Z",
    "value": 12
   },
   {
    "name": "N64_CODE_START",
    "value": 13
   },
   {
    "name": "N64_CODE_LX_RIGHT",
    "value": 14
   },
   {
    "name": "N64_CODE_LX_LEFT",
    "value": 15
   },
   {
    "name": "N64_CODE_LY_UP",
    "value": 16
   },
   {
    "name": "N64_CODE_LY_DOWN",
    "value": 17
   },
   {
    "name": "N64_CODE_MAX",
    "value": 18
   }
  ],
  "mapper_gamecube_code_t": [
   {
    "name": "GAMECUBE_CODE_UNUSED",
    "value": -1
   },
   {
    "name": "GAMECUBE_CODE_A",
    "value": 0
   },
   {
    "name": "GAMECUBE_CODE_B",
    "value": 1
   },
   {
    "name": "GAMECUBE_CODE_X",
    "value": 2
   },
   {
    "name": "GAMECUBE_CODE_Y",
    "value": 3
   },
   {
    "name": "GAMECUBE_CODE_UP",
    "value": 4
   },
   {
    "name": "GAMECUBE_CODE_DOWN",
    "value": 5
   },
   {
    "name": "GAMECUBE_CODE_LEFT",
    "value": 6
   },
   {
    "name": "GAMECUBE_CODE_RIGHT",
    "value": 7
   },
   {
    "name": "GAMECUBE_CODE_START",
    "value": 8
   },
   {
    "name": "GAMECUBE_CODE_Z",
    "value": 9
   },
   {
    "name": "GAMECUBE_CODE_L",
    "value": 10
   },
   {
    "name": "GAMECUBE_CODE_R",
    "value": 11
   },
   {
    "name": "GAMECUBE_CODE_L_ANALOG",
    "value": 12
   },
   {
    "name": "GAMECUBE_CODE_R_ANALOG",
    "value": 13
   },
   {
    "name": "GAMECUBE_CODE_LX_RIGHT",
    "value": 14
   },
   {
    "name": "GAMECUBE_CODE_LX_LEFT",
    "value": 15
   },
   {
    "name": "GAMECUBE_CODE_LY_UP",
    "value": 16
   },
   {
    "name": "GAMECUBE_CODE_LY_DOWN",
    "value": 17
   },
   {
    "name": "GAMECUBE_CODE_RX_RIGHT",
    "value": 18
   },
   {
    "name": "GAMECUBE_CODE_RX_LEFT",
    "value": 19
   },
   {
    "name": "GAMECUBE_CODE_RY_UP",
    "value": 20
   },
   {
    "name": "GAMECUBE_CODE_RY_DOWN",
    "value": 21
   },
   {
    "name": "GAMECUBE_CODE_MAX",
    "value": 22
   }
  ],
  "mapper_override_slots_t": [
   {
    "name": "MAPPER_OVERRIDE_SLOT_0",
    "value": 0
   },
   {
    "name": "MAPPER_OVERRIDE_SLOT_1",
    "value": 1
   },
   {
    "name": "MAPPER_OVERRIDE_SLOT_2",
    "value": 2
   },
   {
    "name": "MAPPER_OVERRIDE_SLOT_3",
    "value": 3
   },
   {
    "name": "MAPPER_OVERRIDE_SLOT_4",
    "value": 4
   }
  ],
  "mapper_xinput_code_t": [
   {
    "name": "XINPUT_CODE_UNUSED",
    "value": -1
   },
   {
    "name": "XINPUT_CODE_A",
    "value": 0
   },
   {
    "name": "XINPUT_CODE_B",
    "value": 1
   },
   {
    "name": "XINPUT_CODE_X",
    "value": 2
   },
   {
    "name": "XINPUT_CODE_Y",
    "value": 3
   },
   {
    "name": "XINPUT_CODE_UP",
    "value": 4
   },
   {
    "name": "XINPUT_CODE_DOWN",
    "value": 5
   },
   {
    "name": "XINPUT_CODE_LEFT",
    "value": 6
   },
   {
    "name": "XINPUT_CODE_RIGHT",
    "value": 7
   },
   {
    "name": "XINPUT_CODE_LB",
    "value": 8
   },
   {
    "name": "XINPUT_CODE_RB",
    "value": 9
   },
   {
    "name": "XINPUT_CODE_START",
    "value": 10
   },
   {
    "name": "XINPUT_CODE_BACK",
    "value": 11
   },
   {
    "name": "XINPUT_CODE_GUIDE",
    "value": 12
   },
   {
    "name": "XINPUT_CODE_LS",
    "value": 13
   },
   {
    "name": "XINPUT_CODE_RS",
    "value": 14
   },
   {
    "name": "XINPUT_CODE_LT_ANALOG",
    "value": 15
   },
   {
    "name": "XINPUT_CODE_RT_ANALOG",
    "value": 16
   },
   {
    "name": "XINPUT_CODE_LX_RIGHT",
    "value": 17
   },
   {
    "name": "XINPUT_CODE_LX_LEFT",
    "value": 18
   },
   {
    "name": "XINPUT_CODE_LY_UP",
    "value": 19
   },
   {
    "name": "XINPUT_CODE_LY_DOWN",
    "value": 20
   },
   {
    "name": "XINPUT_CODE_RX_RIGHT",
    "value": 21
   },
   {
    "name": "XINPUT_CODE_RX_LEFT",
    "value": 22
   },
   {
    "name": "XINPUT_CODE_RY_UP",
    "value": 23
   },
   {
    "name": "XINPUT_CODE_RY_DOWN",
    "value": 24
   },
   {
    "name": "XINPUT_CODE_MAX",
    "value": 25
   }
  ],
  "mapper_sinput_code_t": [
   {
    "name": "SINPUT_CODE_UNUSED",
    "value": -1
   },
   {
    "name": "SINPUT_CODE_SOUTH",
    "value": 0
   },
   {
    "name": "SINPUT_CODE_EAST",
    "value": 1
   },
   {
    "name": "SINPUT_CODE_WEST",
    "value": 2
   },
   {
    "name": "SINPUT_CODE_NORTH",
    "value": 3
   },
   {
    "name": "SINPUT_CODE_UP",
    "value": 4
   },
   {
    "name": "SINPUT_CODE_DOWN",
    "value": 5
   },
   {
    "name": "SINPUT_CODE_LEFT",
    "value": 6
   },
   {
    "name": "SINPUT_CODE_RIGHT",
    "value": 7
   },
   {
    "name": "SINPUT_CODE_LB",
    "value": 8
   },
   {
    "name": "SINPUT_CODE_RB",
    "value": 9
   },
   {
    "name": "SINPUT_CODE_LT",
    "value": 10,
    "doc": "Left trigger digital"
   },
   {
    "name": "SINPUT_CODE_LT_ANALOG",
    "value": 11
   },
   {
    "name": "SINPUT_CODE_RT",
    "value": 12,
    "doc": "Right trigger digital"
   },
   {
    "name": "SINPUT_CODE_RT_ANALOG",
    "value": 13
   },
   {
    "name": "SINPUT_CODE_LP_1",
    "value": 14,
    "doc": "Left paddle 1"
   },
   {
    "name": "SINPUT_CODE_RP_1",
    "value": 15,
    "doc": "Right paddle 1"
   },
   {
    "name": "SINPUT_CODE_LP_2",
    "value": 16,
    "doc": "Left paddle 2"
   },
   {
    "name": "SINPUT_CODE_RP_2",
    "value": 17,
    "doc": "Right paddle 2"
   },
   {
    "name": "SINPUT_CODE_START",
    "value": 18
   },
   {
    "name": "SINPUT_CODE_SELECT",
    "value": 19
   },
   {
    "name": "SINPUT_CODE_GUIDE",
    "value": 20
   },
   {
    "name": "SINPUT_CODE_SHARE",
    "value": 21
   },
   {
    "name": "SINPUT_CODE_MISC_3",
    "value": 22,
    "doc": "Misc 3 (Power)"
   },
   {
    "name": "SINPUT_CODE_MISC_4",
    "value": 23,
    "doc": "Misc 4"
   },
   {
    "name": "SINPUT_CODE_TP_1",
    "value": 24,
    "doc": "Touchpad 1"
   },
   {
    "name": "SINPUT_CODE_TP_2",
    "value": 25,
    "doc": "Touchpad 2"
   },
   {
    "name": "SINPUT_CODE_LS",
    "value": 26,
    "doc": "Stick left"
   },
   {
    "name": "SINPUT_CODE_LX_RIGHT",
    "value": 27
   },
   {
    "name": "SINPUT_CODE_LX_LEFT",
    "value": 28
   },
   {
    "name": "SINPUT_CODE_LY_UP",
    "value": 29
   },
   {
    "name": "SINPUT_CODE_LY_DOWN",
    "value": 30
   },
   {
    "name": "SINPUT_CODE_RS",
    "value": 31,
    "doc": "Stick right"
   },
   {
    "name": "SINPUT_CODE_RX_RIGHT",
    "value": 32
   },
   {
    "name": "SINPUT_CODE_RX_LEFT",
    "value": 33
   },
   {
    "name": "SINPUT_CODE_RY_UP",
    "value": 34
   },
   {
    "name": "SINPUT_CODE_RY_DOWN",
    "value": 35
   },
   {
    "name": "SINPUT_CODE_MISC_5",
    "value": 36,
    "doc": "Misc 5"
   },
   {
    "name": "SINPUT_CODE_MISC_6",
    "value": 37,
    "doc": "Misc 6"
   },
   {
    "name": "SINPUT_CODE_MAX",
    "value": 38
   }
  ],
  "analog_scaler_t": [
   {
    "name": "ANALOG_SCALER_ROUND",
    "value": 0
   },
   {
    "name": "ANALOG_SCALER_POLYGON",
    "value": 1
   }
  ],
  "calibrate_set_t": [
   {
    "name": "CALIBRATE_START",
    "value": 0
   },
   {
    "name": "CALIBRATE_CANCEL",
    "value": 1
   },
   {
    "name": "CALIBRATE_SAVE",
    "value": 2
   }
  ],
  "snapback_type_t": [
   {
    "name": "SNAPBACK_TYPE_DISABLED",
    "value": 0
   },
   {
    "name": "SNAPBACK_TYPE_ZERO",
    "value": 1
   },
   {
    "name": "SNAPBACK_TYPE_POST",
    "value": 2
   }
  ],
  "cfg_block_t": [
   {
    "name": "CFG_BLOCK_GAMEPAD",
    "value": 0
   },
   {
    "name": "CFG_BLOCK_HOVER",
    "value": 1
   },
   {
    "name": "CFG_BLOCK_ANALOG",
    "value": 2
   },
   {
    "name": "CFG_BLOCK_RGB",
    "value": 3
   },
   {
    "name": "CFG_BLOCK_TRIGGER",
    "value": 4
   },
   {
    "name": "CFG_BLOCK_IMU",
    "value": 5
   },
   {
    "name": "CFG_BLOCK_HAPTIC",
    "value": 6
   },
   {
    "name": "CFG_BLOCK_USER",
    "value": 7
   },
   {
    "name": "CFG_BLOCK_INPUT",
    "value": 8
   },
   {
    "name": "CFG_BLOCK_MAX",
    "value": 9
   }
  ],
  "gamepad_cmd_t": [
   {
    "name": "GAMEPAD_CMD_REFRESH",
    "value": 0
   },
   {
    "name": "GAMEPAD_CMD_RESET_TO_BOOTLOADER",
    "value": 1
   },
   {
    "name": "GAMEPAD_CMD_ENABLE_BLUETOOTH_UPLOAD",
    "value": 2
   },
   {
    "name": "GAMEPAD_CMD_SAVE_ALL",
    "value": 255
   }
  ],
  "mapper_cmd_t": [
   {
    "name": "MAPPER_CMD_REFRESH",
    "value": 0
   },
   {
    "name": "MAPPER_CMD_DEFAULT_ALL",
    "value": 1
   },
   {
    "name": "MAPPER_CMD_DEFAULT_SWITCH",
    "value": 2
   },
   {
    "name": "MAPPER_CMD_DEFAULT_XINPUT",
    "value": 3
   },
   {
    "name": "MAPPER_CMD_DEFAULT_SNES",
    "value": 4
   },
   {
    "name": "MAPPER_CMD_DEFAULT_N64",
    "value": 5
   },
   {
    "name": "MAPPER_CMD_DEFAULT_GAMECUBE",
    "value": 6
   },
   {
    "name": "MAPPER_CMD_DEFAULT_SINPUT",
    "value": 7
   },
   {
    "name": "MAPPER_CMD_WEBUSB_SWITCH",
    "value": 8
   },
   {
    "name": "MAPPER_CMD_WEBUSB_XINPUT",
    "value": 9
   },
   {
    "name": "MAPPER_CMD_WEBUSB_SNES",
    "value": 10
   },
   {
    "name": "MAPPER_CMD_WEBUSB_N64",
    "value": 11
   },
   {
    "name": "MAPPER_CMD_WEBUSB_GAMECUBE",
    "value": 12
   },
   {
    "name": "MAPPER_CMD_WEBUSB_SINPUT",
    "value": 13
   }
  ],
  "analog_cmd_t": [
   {
    "name": "ANALOG_CMD_REFRESH",
    "value": 0
   },
   {
    "name": "ANALOG_CMD_CALIBRATE_START",
    "value": 1
   },
   {
    "name": "ANALOG_CMD_CALIBRATE_STOP",
    "value": 2
   },
   {
    "name": "ANALOG_CMD_CAPTURE_JOYSTICK_LEFT",
    "value": 3
   },
   {
    "name": "ANALOG_CMD_CAPTURE_JOYSTICK_RIGHT",
    "value": 4
   }
  ],
  "rgb_cmd_t": [
   {
    "name": "RGB_CMD_REFRESH",
    "value": 0
   }
  ],
  "imu_cmd_t": [
   {
    "name": "IMU_CMD_REFRESH",
    "value": 0
   },
   {
    "name": "IMU_CMD_CALIBRATE_START",
    "value": 1
   }
  ],
  "haptic_cmd_t": [
   {
    "name": "HAPTIC_CMD_REFRESH",
    "value": 0
   },
   {
    "name": "HAPTIC_CMD_TEST_STRENGTH",
    "value": 1
   }
  ],
  "static_block_t": [
   {
    "name": "STATIC_BLOCK_DEVICE",
    "value": 0,
    "doc": "Half way through config block"
   },
   {
    "name": "STATIC_BLOCK_INPUT",
    "value": 1
   },
   {
    "name": "STATIC_BLOCK_ANALOG",
    "value": 2
   },
   {
    "name": "STATIC_BLOCK_HAPTIC",
    "value": 3
   },
   {
    "name": "STATIC_BLOCK_IMU",
    "value": 4
   },
   {
    "name": "STATIC_BLOCK_BATTERY",
    "value": 5
   },
   {
    "name": "STATIC_BLOCK_BLUETOOTH",
    "value": 6
   },
   {
    "name": "STATIC_BLOCK_RGB",
    "value": 7
   },
   {
    "name": "STATIC_BLOCK_MAX",
    "value": 8
   }
  ]
 },
 "defines": {
  "MAPPER_INPUT_COUNT": 36,
  "MAPPER_DIGITAL_PRESS_MASK": 32768,
  "CFG_BLOCK_GAMEPAD_VERSION": 20,
  "CFG_BLOCK_HOVER_VERSION": 21,
  "CFG_BLOCK_ANALOG_VERSION": 19,
  "CFG_BLOCK_RGB_VERSION": 18,
  "CFG_BLOCK_TRIGGER_VERSION": 17,
  "CFG_BLOCK_IMU_VERSION": 18,
  "CFG_BLOCK_HAPTIC_VERSION": 17,
  "CFG_BLOCK_USER_VERSION": 17,
  "CFG_BLOCK_INPUT_VERSION": 20,
  "CFG_BLOCK_SWITCHPAIR_VERSION": 16,
  "IMU_SENSITIVITY_MIN": 50,
  "IMU_SENSITIVITY_MAX": 200,
  "IMU_SENSITIVITY_UNITY": 100,
  "IMU_GYRO_SENSITIVITY_DEFAULT": 120,
  "IMU_ACCEL_SENSITIVITY_DEFAULT": 100,
  "ANALOG_EXP_STORED_MIN": 1,
  "ANALOG_EXP_STORED_MAX": 251,
  "ANALOG_EXP_STORED_DEFAULT": 51,
  "ANALOG_EXP_SENSITIVITY_OFFSET": 49,
  "ANALOG_EXP_SENSITIVITY_MIN": 50,
  "ANALOG_EXP_SENSITIVITY_MAX": 300,
  "ANALOG_EXP_SENSITIVITY_DEFAULT": 100,
  "RGB_BRIGHTNESS_MAX": 4096,
  "FIRMWARE_VERSION_TIMESTAMP": 0
 }
};
