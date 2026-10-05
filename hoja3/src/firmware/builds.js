/**
 * builds.js — The catalog of HOJA device firmware builds (github.com/HandHeldLegend/hoja-device-fw).
 *
 * Builds are listed live from GitHub's contents API. The last successful list is kept in
 * localStorage so the picker still shows names offline (flashing itself needs a download).
 */
// Marks a literal for translation (tools/test-i18n.mjs); kept local so this module stays Node-importable
// (the MCP server lists builds, and src/i18n/index.js needs a browser).
const N_ = (text) => text;

const BUILDS_API = 'https://api.github.com/repos/HandHeldLegend/hoja-device-fw/contents/builds';
const RAW_BASE = 'https://raw.githubusercontent.com/HandHeldLegend/hoja-device-fw/main/builds';
const CACHE_KEY = 'hhl-config:builds';

/** Friendly names for build folder ids. Unknown ids are title-cased automatically. */
export const DISPLAY_NAMES = {
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
  progcc_3: 'ProGCC 3',
  progcc_3p: 'ProGCC 3+',
  'progcc_3.1': 'ProGCC 3.1',
  'progcc_3.2': 'ProGCC 3.2',
  progcc_3s: 'ProGCC 3S',
  super_gamepad: 'Super Gamepad+',
};

/** Special entry: wipes the whole flash (recovery for badly corrupted boards). Label: t() it where shown. */
export const NUKE_BUILD = {
  id: 'full-reset-nuke',
  label: N_('Full reset — erase flash (nuke)'),
  uf2Url: new URL('../../firmware/universal_flash_nuke.uf2', import.meta.url).href,
  manifestUrl: null,
  danger: true,
};

export function humanizeBuildId(id) {
  return DISPLAY_NAMES[id] || id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function toBuild(id) {
  return {
    id,
    label: humanizeBuildId(id),
    uf2Url: `${RAW_BASE}/${id}/${id}.uf2`,
    binUrl: `${RAW_BASE}/${id}/${id}.bin`,
    manifestUrl: `${RAW_BASE}/${id}/manifest.json`,
  };
}

let memo = null;

/** @returns {Promise<{builds: Array, offline: boolean}>} */
export async function listBuilds() {
  if (memo) return memo;
  try {
    const res = await fetch(BUILDS_API);
    if (!res.ok) throw new Error(`GitHub responded ${res.status}`);
    const ids = (await res.json()).filter((e) => e.type === 'dir').map((e) => e.name);
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(ids)); } catch { /* ignore */ }
    memo = { builds: ids.map(toBuild).sort((a, b) => a.label.localeCompare(b.label)), offline: false };
  } catch (err) {
    let ids = [];
    try { ids = JSON.parse(localStorage.getItem(CACHE_KEY) || '[]'); } catch { /* ignore */ }
    if (!ids.length) ids = Object.keys(DISPLAY_NAMES);
    console.warn('[builds] using cached list:', err.message);
    return { builds: ids.map(toBuild).sort((a, b) => a.label.localeCompare(b.label)), offline: true };
  }
  return memo;
}

export async function getBuildManifest(manifestUrl) {
  if (!manifestUrl) return null;
  try {
    const res = await fetch(manifestUrl, { cache: 'no-store' });
    return res.ok ? res.json() : null;
  } catch {
    return null;
  }
}
