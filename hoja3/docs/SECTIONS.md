# Writing a section

A *section* is one page of the app (Joysticks, RGB, …). Each lives in `src/sections/<id>/`:

| File | Purpose | Rules |
|---|---|---|
| `view.js` | `export function mount(root, ctx)` — builds the page | DOM code lives here |
| `settings.js` | Scalar settings as `SettingDef`s (see `src/settings/schema.js`) | **No DOM.** Imported by Node for the MCP server |
| `demo.js` | Demo-controller hooks: `seed(device)`, `command(block, cmd, device)` (may return a Promise) | Only used with `?demo` |
| `<id>.css` | Page-specific styles, loaded with `loadStyles(new URL('./<id>.css', import.meta.url))` | Use theme tokens only (`var(--…)`), never raw hex |
| other `*.js` | Widgets used only by this section (visualizers, editors…) | Keep them here, not in `src/ui/` |

The page is registered in `src/sections/registry.js` (title, icon, tone, capability gate, deep-link params).

## `mount(root, ctx)`

```js
export function mount(root, ctx) {
  // ctx.session  — src/device/session.js (state, caps, info, config, static, commit, save, command, refresh, on)
  // ctx.device   — src/device/hoja-device.js (raw driver: events 'input' / 'snapback', setInputMode, setFocusedInput…)
  // ctx.params   — deep-link query params, e.g. { stick: 'left', tab: 'calibrate' }
  // ctx.sub      — extra path segments (#/joysticks/left → ['left'])
  // ctx.setParams({ tab: 'sensitivity' }) — reflect UI state into the URL (no re-render) so links are shareable
  // ctx.navigate('rgb') — go to another page
  // ctx.header   — element in the page header for small extra actions (e.g. a "Reset" button)
  // Escape returns to Home unless a view handles it first and calls event.preventDefault().
  return {
    destroy() { /* stop timers, unsubscribe events, restore input mode */ },
    update(params) { /* optional: react to a new deep link without remounting */ },
  }; // or just return a cleanup function
}
```

The shell only mounts device sections while a controller is connected **and** `session.caps[requires]` is true,
so views can assume both. When the controller disconnects, the page is unmounted (destroy is called).

## Reading and writing controller memory

```js
const cfg = ctx.session.config.analog;       // live struct (generated from firmware headers)
cfg.l_deadzone = 120;                        // write a field
ctx.session.commit('analog');                // push to controller (debounced) + light up Save
await ctx.session.refresh('analog');         // re-read a block from the controller
const { status, data } = await ctx.session.command('analog', 'CALIBRATE_START');  // firmware enum names
```

* Block names and command names come from the firmware enums (`cfg_block_t`, `analog_cmd_t`, …) — see
  `src/device/generated/fw-layout.js` (`blocks`, `commands`). Never hard-code numbers.
* Array fields return **copies**: `const a = cfg.joy_config_l; a[0].in_angle = 45; cfg.joy_config_l = a;`
* Char arrays: `decodeText(bytes)` / `encodeText(str, len)` from `src/device/struct.js`.
* Enums (input codes, report formats…): `enumValues('mapper_input_code_t')`; numeric `#define`s: `fwDefine('ANALOG_EXP_STORED_DEFAULT')`.

## Live input

```js
import { onInputReport } from '../../device/reports.js';
await ctx.device.setInputMode(true);                 // true = joystick stream (0xFE), false = raw/hover (0xFF)
const stop = onInputReport(ctx.device, (r) => { /* r.sticks / r.inputs / r.accel / r.gyro / r.batteryPercent */ });
// in destroy(): stop();
```

Throttle rendering with `requestAnimationFrame` — reports arrive at ~125 Hz.

## UI kit (`src/ui/controls.js`)

`button`, `asyncButton` (busy → ok/fail feedback), `segmented`, `toggle`, `slider` (range + number), `stepper`,
`select`, `textInput`, `colorField`, `field` (label/description/tip + control row), `card`, `callout`, `badge`,
`dot`, `infoTip`, `progressBar`, `tabView` (lazy tabs), `emptyState`, `kv`, `face`.
Overlays (`src/ui/overlay.js`): `toast`, `openDialog`, `confirmDialog`. Any element with `data-tip="…"` gets a tooltip.
DOM helper: `h('div.class', props, ...children)` from `src/ui/dom.js`. Canvas visualizers: `canvasSurface()` from `src/ui/canvas-surface.js` (DPR-aware, self-sizing, theme colors). Icons: `icon('name')` (see `assets/icons/preview.html`).

For simple scalar settings, prefer declaring them in `settings.js` and rendering with
`settingField('section.key')` from `src/settings/field.js` — then deep links and assistants get them for free.

## Left/right layouts

Anything configured per stick (or per trigger) uses the shared `.lr-split` layout from `css/components.css`:
both columns are always rendered; a container query shows them side by side when the page is ≥ 640px wide (pages with a two-column split widen to 1240px automatically)
and one at a time (with a Left/Right `segmented` switch in `.lr-switch`) when it isn't. Mark the selected
column with `data-active`; add `.single` for single-stick builds. Keep the same sections in the same order
in both columns so rows line up. Deep links (`?stick=right`) set `data-active` and, on wide layouts, scroll
to that column and set `data-highlight` briefly.

## Translations (English, Spanish, Japanese)

* Wrap every user-visible string in `t('English text')` from `src/i18n/index.js`; use placeholders for
  values: `t('Connected to {name}', { name })`. Counts: `plural(n, '{n} input', '{n} inputs')`.
* Never build sentences by concatenation — word order differs between languages. One whole sentence per `t()`.
* Pass literal strings to `t()` (no `${}` templates) so `tools/test-i18n.mjs` can find them. For literals
  that are translated later (e.g. stored and displayed elsewhere) mark them with `N_('…')`.
* `settings.js` / `registry.js` stay plain English data — they're translated where rendered (settingField does it).
* Numbers, percentages and dates: `fmt.number/percent/date` (locale-aware).
* Translations live in `src/i18n/locales/{es,ja}/<area>.js` (area = section id, or `core`). Use the terms in
  `src/i18n/GLOSSARY.md`. `node tools/test-i18n.mjs --emit es <area>` prints what's missing.
* Leave room: Spanish runs ~30% longer than English; Japanese is shorter but taller. Avoid fixed widths on text.

## Style

* Cards group related settings. One idea per card, a short subtitle explaining *why* you'd change it.
* Use the section's `tone` for its accent (`card({ tone })`, `slider({ tone })`). Tones: red, yellow, blue, green, lavender.
* Mobile first: everything must work at 360 px wide. Visualizers scale with `width: 100%` / `aspect-ratio`.
* Motion: short fades and small offsets only. Respect `prefers-reduced-motion` (the base CSS already does for CSS animations; check `matchMedia('(prefers-reduced-motion: reduce)')` for JS animation).
* Explain hardware terms in plain language for customers (tips via `infoTip`).

## Demo controller

Open `?demo` (e.g. `http://localhost:5173/?demo#/joysticks`). `src/device/mock.js` seeds plausible data and streams
input. Put section-specific demo data in your `demo.js`.

## Checklist for porting a hoja2 module

1. Every control and behavior in `hoja2/modules/<x>-md.js` (and the components it uses) exists in the new page.
2. Same struct fields, same value conversions, same commands, same order of operations (e.g. flush before a test command).
3. Capability-dependent UI is hidden exactly when hoja2 hid it.
4. Works with `?demo` without console errors, at 360 px and 1280 px wide, in dark and light themes.
