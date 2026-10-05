# Attributions

Third-party work used by HHL Gamepad Config. This list is mirrored in the app (*Help & about*) from
`src/sections/about/attributions.js` — update both when adding a dependency or asset.

| Work | Author | License | Used for |
|---|---|---|---|
| [Input Prompts](https://kenney.nl/assets/input-prompts) | Kenney | CC0 1.0 | Button glyphs on the Input page (`assets/glyphs/`) |
| ["Nintendo Gamepad" 3D model](https://skfb.ly/PyDP) | Nidal Ghonaim | [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/) | Controller model on the Motion page (`assets/3d/supergamepad.stl`) |
| [three.js](https://threejs.org) r128 + STLLoader | three.js authors | MIT (`vendor/three/LICENSE`) | 3D rendering on the Motion page (`vendor/three/`) |
| [esptool-js](https://github.com/espressif/esptool-js) 0.4.3 | Espressif Systems | Apache-2.0 (`vendor/esptool-js/LICENSE`) | ESP32 wireless module updates (`vendor/esptool-js/`) |
| [pako](https://github.com/nodeca/pako) 2.1.0 (bundled in esptool-js) | Andrei Tuputcyn, Vitaly Puzrin | MIT AND Zlib (`vendor/esptool-js/LICENSE-pako`, `NOTICE.txt`) | Compression while writing ESP32 firmware |
| CH340 WebUSB serial driver | ported from `hoja_esptool/src/plugin/niceSerial.js` (Hand Held Legend) | — | Android ESP32 updates without Web Serial (`src/sections/wireless/ch34x-webusb.js`) |
| [pico-universal-flash-nuke](https://github.com/Gadgetoid/pico-universal-flash-nuke) | Phil Howard | BSD 3-Clause (below) | Recovery image (`firmware/universal_flash_nuke.uf2`) |
| [PICOBOOT protocol](https://github.com/raspberrypi/pico-bootrom-rp2040) | Raspberry Pi Ltd | BSD 3-Clause | Reference for the USB bootloader commands (`src/firmware/picoboot.js`) |
| [HOJA-LIB-RP2040](https://github.com/HandHeldLegend/HOJA-LIB-RP2040) | Hand Held Legend | see repository | Memory layouts generated from its headers (`src/device/generated/fw-layout.js`) |

The Super Famicom-inspired palette is a tribute; this project is not affiliated with or endorsed by Nintendo.
The Gameplay Arena is original work inspired by classic platform fighters and contains no game code or assets.

## pico-universal-flash-nuke — BSD 3-Clause License

Copyright 2024 Phil Howard

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the
following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following
   disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following
   disclaimer in the documentation and/or other materials provided with the distribution.
3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products
   derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES,
INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
