/**
 * RGB view — port of hoja2/modules/rgb-md.js (+ group-rgb-picker).
 *
 * Cards:
 *   1. Lighting     animated preview of the selected effect + effect picker (rgb_mode)
 *   2. Brightness & timing   brightness (0..RGB_BRIGHTNESS_MAX as %), animation time, idle glow
 *   3. Colors      one swatch per LED group (rgb_colors[i], names from static rgb_group_names),
 *                   quick preset palettes, "Paste to all" from the clipboard (hoja2's "Paste All")
 *
 * hoja2 behaviors kept:
 *   - In Fairy mode the group pickers are relabeled "Fairy 1…6" and the rest "Unused", because the
 *     Fairy effect blends between the first six color slots regardless of group names.
 *   - Paste All accepts up to 6 hex digits from the clipboard and sets every group to that color.
 * New: the static rgb_player_group gets a "Player" badge (its LEDs also show the player number).
 * Player LED: the firmware always lights the player group in its own static color (rgb_colors[i]) in
 * every effect, so its tile is never relabeled or dimmed, and the preview never animates it.
 */
import { h, loadStyles } from '../../ui/dom.js';
import { card, colorField, asyncButton, badge, infoTip } from '../../ui/controls.js';
import { toast } from '../../ui/overlay.js';
import { t, N_ } from '../../i18n/index.js';
import { decodeText } from '../../device/struct.js';
import { settingField, refreshSettings } from '../../settings/field.js';
import { getSetting, u32ToHex, hexToU32 } from '../../settings/schema.js';
import { RGB_MODES, FAIRY_COLORS, MAX_GROUPS } from './settings.js';
import { ledPreview } from './led-preview.js';

loadStyles(new URL('./rgb.css', import.meta.url));

const TONE = 'red';

/**
 * Preset palettes. `cycle` is applied to groups in order; `byName` (optional) wins for groups
 * whose name matches exactly (case-insensitive), so "SFC" lights A/B/X/Y in their real colors.
 * Values are LED-tuned (pure primaries read best on WS2812s), mirroring the firmware palettes.
 */
const PRESETS = [
  { name: 'SFC', cycle: ['#ff0000', '#f5d400', '#00ff00', '#0032ff'],
    byName: { a: '#ff0000', b: '#f5d400', x: '#0032ff', y: '#00ff00' } },
  { name: N_('Rainbow'), cycle: ['#ff0000', '#ff7a00', '#ffe600', '#00ff00', '#00c8ff', '#0032ff', '#9b30ff'] },
  { name: N_('Ocean'), cycle: ['#0032ff', '#00b4ff', '#00f5a3', '#66e0ff'] },
  { name: N_('Sunset'), cycle: ['#ff3c28', '#ff7a00', '#ff2d7a', '#9b30ff'] },
  { name: N_('Lavender'), cycle: ['#7300ff', '#b088ff', '#e0d4ff'] },
  { name: N_('Snow'), cycle: ['#ffffff'] },
];

export function mount(root, { session }) {
  const rgb = () => session.config.rgb;
  const st = session.static.rgb;
  const groupCount = Math.max(0, Math.min(MAX_GROUPS, st.rgb_groups));
  const names = st.rgb_group_names.slice(0, groupCount).map((g, i) => decodeText(g.rgb_group_name) || t('Group {n}', { n: i + 1 }));
  const playerGroup = st.rgb_player_group; // i8, -1 = none

  // Live (uncommitted) overrides while a slider or picker is being dragged, for the preview only.
  const live = {};
  const getState = () => ({
    mode: rgb().rgb_mode,
    speed: live.speed ?? rgb().rgb_speed,
    brightness: live.brightness ?? getSetting('rgb.brightness').get(session),
    colors: Array.from(rgb().rgb_colors, (c, i) => live.colors?.[i] ?? u32ToHex(c)),
  });

  // ---- 1. Lighting: preview + effect -----------------------------------------------------------
  const preview = ledPreview({ names, playerGroup, getState });
  const modeAbout = h('p.rgb-mode-about');
  const modeRow = settingField('rgb.mode', { tone: TONE, stacked: true, description: '', onChange: () => onModeChange() });

  const lightingCard = card({ title: t('Lighting'), subtitle: t('Pick an effect — the preview shows roughly how it looks.'), icon: 'rgb', tone: TONE },
    preview, modeRow, modeAbout);

  // ---- 2. Colors ------------------------------------------------------------------------------
  const colorHint = h('p.rgb-hint');
  const tiles = names.map((name, i) => groupTile(name, i));
  const grid = h('div.rgb-groups', tiles.map((tile) => tile.el));

  function groupTile(name, i) {
    const label = h('span.rgb-group-name', name);
    const subText = h('span');
    const isPlayer = i === playerGroup;
    const sub = h('span.rgb-group-sub', subText,
      isPlayer && badge(t('Player'), 'blue'),
      isPlayer && infoTip(t('These LEDs also show your player number when connected and chase while pairing, using this color.')));
    const note = isPlayer && h('span.rgb-group-note', t('Always shows this color, in every mode.'));
    const picker = colorField({
      value: u32ToHex(rgb().rgb_colors[i]),
      ariaLabel: t('{name} color', { name }),
      onInput: (v) => { (live.colors ||= {})[i] = v; preview.refresh(); },
      onChange: (v) => {
        if (live.colors) delete live.colors[i];
        writeColors({ [i]: v });
      },
    });
    const el = h('div.rgb-group', { dataset: { index: i } },
      h('div.rgb-group-text', h('span.rgb-group-title', label), sub, note),
      picker);
    return { el, label, subText, picker, name, isPlayer };
  }

  /** Write { index: '#rrggbb' } into rgb_colors and push the block once. */
  function writeColors(map) {
    const a = rgb().rgb_colors;
    for (const [i, hex] of Object.entries(map)) a[i] = hexToU32(hex);
    rgb().rgb_colors = a;
    session.commit('rgb');
    syncTiles();
  }

  function syncTiles() {
    const c = rgb().rgb_colors;
    tiles.forEach((tile, i) => { tile.picker.value = u32ToHex(c[i]); });
    preview.refresh();
  }

  /** Relabel tiles for Fairy mode (hoja2's updateRgbPickerTexts). */
  function relabel() {
    const fairy = RGB_MODES.find((m) => m.value === rgb().rgb_mode)?.id === 'fairy';
    tiles.forEach((tile, i) => {
      // The Player LED keeps its own static color in every effect, so it is never relabeled or dimmed.
      const asFairy = fairy && !tile.isPlayer;
      const unused = asFairy && i >= FAIRY_COLORS;
      tile.label.textContent = asFairy ? (unused ? t('Unused') : t('Fairy {n}', { n: i + 1 })) : tile.name;
      tile.subText.textContent = asFairy ? tile.name : '';
      tile.el.classList.toggle('is-unused', unused);
    });
  }

  function applyPreset(p) {
    const before = Object.fromEntries(Array.from(rgb().rgb_colors, (c, i) => [i, u32ToHex(c)]));
    // Fairy uses slots 0..5 even if the controller has fewer groups, so fill at least six.
    const n = Math.max(groupCount, FAIRY_COLORS);
    const map = {};
    let k = 0;
    for (let i = 0; i < n; i++) {
      const byName = p.byName?.[(names[i] || '').trim().toLowerCase()];
      map[i] = byName || p.cycle[k++ % p.cycle.length];
    }
    writeColors(map);
    toast(t('{name} colors applied', { name: t(p.name) }), { tone: 'green', action: { label: t('Undo'), onClick: () => writeColors(before) } });
  }

  const presets = h('div.rgb-presets', { role: 'group', 'aria-label': t('Color presets') },
    PRESETS.map((p) => h('button.rgb-preset', { type: 'button', title: t('Apply the {name} palette', { name: t(p.name) }), onclick: () => applyPreset(p) },
      h('span.rgb-preset-swatch', { 'aria-hidden': 'true', style: { background: stripes(p.cycle) } }),
      t(p.name))));

  const paste = asyncButton({
    label: t('Paste to all'), icon: 'copy', variant: 'tonal', size: 'sm',
    busyLabel: t('Pasting…'), okLabel: t('Pasted'), failLabel: t('No color'),
    title: t('Set every group to a hex color from your clipboard'),
    run: async () => {
      let text = '';
      try { text = await navigator.clipboard.readText(); } catch (err) {
        toast(t('Clipboard access was blocked. Copy a hex color like #FF8800 and try again.'), { tone: 'yellow' });
        return false;
      }
      // Same rule as hoja2: strip non-alphanumerics, accept up to six hex digits.
      const cleaned = text.replace(/[^a-zA-Z0-9]/g, '');
      if (!cleaned || cleaned.length > 6 || !/^[0-9a-f]+$/i.test(cleaned)) {
        toast(t('The clipboard doesn’t contain a hex color like #FF8800.'), { tone: 'yellow' });
        return false;
      }
      const hex = `#${cleaned.padStart(6, '0').toLowerCase()}`;
      const map = {};
      for (let i = 0; i < groupCount; i++) map[i] = hex;
      writeColors(map);
      return true;
    },
  });

  const colorsCard = card({ title: t('Colors'), subtitle: t('One color per LED group. Tap a swatch to pick, or type a hex code.'), icon: 'palette', tone: TONE, actions: paste },
    colorHint,
    h('div.rgb-presets-wrap', h('div.rgb-presets-label', t('Quick palettes')), presets),
    grid);

  // ---- 3. Brightness & timing ------------------------------------------------------------------
  const brightRow = settingField('rgb.brightness', { tone: TONE, onChange: () => { delete live.brightness; preview.refresh(); } });
  const speedRow = settingField('rgb.speed', { tone: TONE, onChange: () => { delete live.speed; preview.refresh(); } });
  // Live preview while dragging (settingField reports only committed values).
  brightRow.control.querySelector('input[type="range"]')?.addEventListener('input', (e) => { live.brightness = Number(e.target.value); preview.refresh(); });
  speedRow.control.querySelector('input[type="range"]')?.addEventListener('input', (e) => { live.speed = Number(e.target.value); });

  const tuningCard = card({ title: t('Brightness & timing'), subtitle: t('Changes apply instantly — press Save to keep them.'), icon: 'sliders', tone: TONE },
    brightRow, speedRow, settingField('rgb.idleGlow', { tone: TONE }));

  // Order (owner request): preview + effect, then brightness & timing, then the per-group colors.
  root.append(lightingCard, tuningCard, colorsCard);

  function onModeChange() {
    const m = RGB_MODES.find((x) => x.value === rgb().rgb_mode);
    modeAbout.textContent = m ? t(m.about) : t('This controller is using an effect this app doesn’t know about.');
    colorHint.textContent = {
      authentic: t('Authentic mode picks its own colors, so your colors are ignored, except the Player LED.'),
      rainbow: t('Your colors are ignored in Rainbow mode, except the Player LED.'),
      fairy: t('Fairy mode blends between the first six colors below. The Player LED always keeps its own color.'),
    }[m?.id] || '';
    colorHint.hidden = !colorHint.textContent;
    relabel();
    preview.refresh();
  }
  onModeChange();

  return {
    update() {
      refreshSettings(root);
      syncTiles();
      onModeChange();
    },
    destroy() { preview.destroy(); },
  };
}

/** Hard-stop gradient showing each preset color as an equal stripe. */
function stripes(colors) {
  if (colors.length === 1) return colors[0];
  const step = 100 / colors.length;
  return `linear-gradient(90deg, ${colors.map((c, i) => `${c} ${i * step}% ${(i + 1) * step}%`).join(', ')})`;
}
