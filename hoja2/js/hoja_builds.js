const BUILDS_API =
    'https://api.github.com/repos/HandHeldLegend/hoja-device-fw/contents/builds';
const RAW_BASE =
    'https://raw.githubusercontent.com/HandHeldLegend/hoja-device-fw/main/builds';

const DISPLAY_NAMES = {
    gcu_2: 'GC Ultimate 2',
    gcu_2s: 'GC Ultimate 2S',
    gcu_proto: 'GC Ultimate (Proto)',
    gcu_r4k: 'GC Ultimate R4K',
    gcu_r5: 'GC Ultimate R5',
    gcu_s1: 'GC Ultimate S1',
    hoverboard: 'Hoverboard',
    padbox_gs_c: 'Padbox GS-C',
    phob_2: 'Phob 2',
    pico_w: 'Pico W',
    'progcc_3': 'ProGCC 3',
    'progcc_3p': 'ProGCC 3+',
    'progcc_3.1': 'ProGCC 3.1',
    'progcc_3.2': 'ProGCC 3.2',
    'progcc_3s': 'ProGCC 3S',
    super_gamepad: 'Super Gamepad+',
};

let cachedBuilds = null;

function humanizeBuildId(id) {
    if (DISPLAY_NAMES[id]) return DISPLAY_NAMES[id];
    return id
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * List HOJA device builds from the GitHub builds directory.
 * Results are cached for the page session.
 */
export async function listHojaBuilds() {
    if (cachedBuilds) return cachedBuilds;

    const response = await fetch(BUILDS_API);
    if (!response.ok) {
        throw new Error(`Failed to list builds (${response.status})`);
    }

    const entries = await response.json();
    cachedBuilds = entries
        .filter((entry) => entry.type === 'dir')
        .map((entry) => {
            const id = entry.name;
            return {
                id,
                label: humanizeBuildId(id),
                uf2Url: `${RAW_BASE}/${id}/${id}.uf2`,
                binUrl: `${RAW_BASE}/${id}/${id}.bin`,
                manifestUrl: `${RAW_BASE}/${id}/manifest.json`,
            };
        })
        .sort((a, b) => a.label.localeCompare(b.label));

    return cachedBuilds;
}

export async function getBuildManifest(manifestUrl) {
    const response = await fetch(manifestUrl);
    if (!response.ok) return null;
    return response.json();
}
