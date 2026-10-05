/**
 * attributions.js — Third-party work used by the app. Rendered on Help & about and mirrored in
 * ATTRIBUTIONS.md. Add an entry whenever you vendor code, fonts, models or images.
 * `usedFor` is marked with N_() and translated where rendered (names, authors and licenses stay as-is).
 */
import { N_ } from '../../i18n/index.js';

export const ATTRIBUTIONS = [
  {
    name: 'Input Prompts',
    author: 'Kenney',
    url: 'https://kenney.nl/assets/input-prompts',
    license: 'CC0 1.0',
    usedFor: N_('Button glyphs on the Input page (assets/glyphs/)'),
  },
  {
    name: '“Nintendo Gamepad” 3D model',
    author: 'Nidal Ghonaim',
    url: 'https://skfb.ly/PyDP',
    license: 'CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/)',
    usedFor: N_('Controller model in the Motion page live view (assets/3d/supergamepad.stl)'),
  },
  {
    name: 'three.js r128 (with STLLoader)',
    author: 'three.js authors',
    url: 'https://threejs.org',
    license: 'MIT',
    usedFor: N_('3D rendering on the Motion page (vendor/three/)'),
  },
  {
    name: 'esptool-js 0.4.3',
    author: 'Espressif Systems',
    url: 'https://github.com/espressif/esptool-js',
    license: 'Apache-2.0',
    usedFor: N_('Updating the ESP32 wireless module from the Wireless page (vendor/esptool-js/)'),
  },
  {
    name: 'pako 2.1.0 (bundled in esptool-js)',
    author: 'Andrei Tuputcyn, Vitaly Puzrin',
    url: 'https://github.com/nodeca/pako',
    license: 'MIT AND Zlib',
    usedFor: N_('Compression while writing ESP32 firmware (vendor/esptool-js/)'),
  },
  {
    name: 'pico-universal-flash-nuke',
    author: 'Phil Howard',
    url: 'https://github.com/Gadgetoid/pico-universal-flash-nuke',
    license: 'BSD 3-Clause — Copyright 2024 Phil Howard',
    usedFor: N_('The “Full reset — erase flash” recovery image (firmware/universal_flash_nuke.uf2)'),
  },
  {
    name: 'PICOBOOT protocol',
    author: 'Raspberry Pi Ltd',
    url: 'https://github.com/raspberrypi/pico-bootrom-rp2040',
    license: 'BSD 3-Clause',
    usedFor: N_('Reference for the USB bootloader commands used to flash firmware (src/firmware/picoboot.js)'),
  },
  {
    name: 'HOJA firmware (HOJA-LIB-RP2040)',
    author: 'Hand Held Legend',
    url: 'https://github.com/HandHeldLegend/HOJA-LIB-RP2040',
    license: 'See repository',
    usedFor: N_('Config/static memory layouts are generated from its headers (src/device/generated/fw-layout.js)'),
  },
];
