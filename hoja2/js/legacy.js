class HojaLegacyManager {
    #fwUpdateUrls = 
    {
        0xA001 : "https://github.com/HandHeldLegend/hoja-device-fw/raw/refs/heads/main/builds/progcc_3/progcc_3.uf2",          // ProGCC 3
        0xA002 : "https://github.com/HandHeldLegend/hoja-device-fw/raw/refs/heads/main/builds/progcc_3p/progcc_3p.uf2",        // ProGCC 3+
        0xA004 : "https://github.com/HandHeldLegend/hoja-device-fw/raw/refs/heads/main/builds/progcc_3.1/progcc_3.1.uf2",      // ProGCC 3.1
        0xA005  : "https://github.com/HandHeldLegend/hoja-device-fw/raw/refs/heads/main/builds/progcc_3.2/progcc_3.2.uf2",     // ProGCC 3.2

        0xB001 : "https://github.com/HandHeldLegend/hoja-device-fw/raw/refs/heads/main/builds/super_gamepad/super_gamepad.uf2", // SuperGamepad+
        0xC001  : "https://github.com/HandHeldLegend/hoja-device-fw/raw/refs/heads/main/builds/gcu_proto/gcu_proto.uf2",        // GC Ultimate
        0xC003  : "https://github.com/HandHeldLegend/hoja-device-fw/raw/refs/heads/main/builds/gcu_r4k/gcu_r4k.uf2",            // GC Ultimate R4K,
    };

    getLegacyUrl(id) {
        return this.#fwUpdateUrls[id];
    }
}

export default HojaLegacyManager;