# Architecture

## Principles

1. **The firmware is the source of truth.** Memory layouts, block ids, command ids and enums are generated from
   the HOJA-LIB-RP2040 headers. The app never hand-maintains byte offsets.
2. **No build step.** Edit a file, refresh the browser. ES modules load directly; the only generated files are
   checked in (`fw-layout.js`, `precache-manifest.js`, `llms.txt`).
3. **One design system.** Colors, spacing, radii and motion are tokens in `css/tokens.css`; components come from
   `src/ui/controls.js`. Sections compose; they don't restyle.
4. **Capability-driven UI.** HOJA runs on many custom builds. Pages and controls appear based on what the
   controller reports in its static info blocks (`session.caps`), never on a device model list.
5. **Declarative settings.** Simple settings are data (`settings.js`), so the UI, deep links, tests and AI
   assistants all share one definition.

## Layers

```
 ┌──────────────── sections/<id>/view.js ───────────────┐   pages (DOM)
 │   settings/field.js  ui/controls.js  ui/overlay.js    │
 ├──────────────────── app/shell.js ─────────────────────┤   layout, nav, page lifecycle
 │  app/router.js (hash deep links)   settings/apply.js   │
 ├──────────────────── device/session.js ────────────────┤   state, caps, dirty tracking, save
 │  firmware/updater.js (update/install state machine)    │
 ├──────────────────── device/hoja-device.js ────────────┤   WebUSB protocol (events)
 │  device/struct.js ← device/generated/fw-layout.js      │   typed views over memory blocks
 └────────────────────────────────────────────────────────┘
```

### Device protocol (`src/device/hoja-device.js`)

A port of hoja2's `gamepad.js` with the same wire protocol (documented in the file header). It owns a struct
instance per config block (`device.config.<name>`) and static block (`device.static.<name>`), emits `connect`,
`disconnect`, `input`, `snapback`, `legacy`, `bootloader` events, and serializes request/response exchanges so
concurrent views can't interleave reads.

HOJA applies a written block immediately (RAM). `Save` sends `GAMEPAD_CMD_SAVE_ALL` to persist everything to flash.
`session.commit(block)` debounces writes (sliders) and marks the block dirty; the Save button glows until saved.

### Struct runtime (`src/device/struct.js`)

`tools/sync-firmware.mjs` parses the packed structs in the firmware headers (bitfields, nested structs, arrays,
`#define`-sized arrays), validates sizes against the headers' own `_Static_assert`s, and emits `fw-layout.js`.
`struct.js` turns those layouts into accessor classes at runtime. `tools/test-struct-parity.mjs` proves it reads
and writes byte-identically to hoja2's generated parsers (it also exposed that hoja2 returned uint32 fields as
signed numbers).

When firmware adds a field: run `node tools/sync-firmware.mjs` — the new field is immediately available as
`session.config.<block>.<field>`. If the device sends a bigger block than the app knows, the buffer grows rather
than failing, so newer firmware keeps working with an older app.

### Session (`src/device/session.js`)

App-level state: `state`, `caps` (capability flags from static info), `info` (name, version, URLs), dirty
tracking, `save()`, `command()`, and "attention" badges (uncalibrated sticks/triggers, wireless module updates).

### Firmware (`src/firmware/`)

`updater.js` is hoja2's update state machine (update-available → bootloader → flash → complete, plus bare
bootloader install and UF2-drive fallbacks) driving a stepped dialog that survives USB re-enumeration.
`picoboot.js` is hoja2's PICOBOOT/UF2 flasher with progress callbacks. `builds.js` lists builds from GitHub and
caches the list for offline display.

### Shell, routing and deep links

`router.js` uses hash routes: `#/<section>[/<sub>]?params`. Pages reflect their UI state into the URL with
`ctx.setParams()` so any view is shareable. `#/apply?<setting>=<value>` validates values against the schema and
asks the user to confirm before writing. See `docs/DEEPLINKS.md` (generated).

### Offline & updates

`tools/precache.mjs` lists shipped files and hashes them into a version. `sw.js` precaches that list (reporting
progress), serves same-origin requests cache-first and never caches cross-origin requests (firmware downloads and
update manifests stay fresh). New versions wait until the user taps *Restart*.

### Assistants

- `llms.txt` + `docs/DEEPLINKS.md` — generated from the registry and schema.
- `mcp/server.mjs` — zero-dependency MCP server: lists pages/settings, validates values, builds links,
  serves the troubleshooting knowledge base (`docs/KNOWLEDGE.md`). It never touches hardware.
- `src/agent/bridge.js` — `window.hhl` and WebMCP tool registration for in-browser agents; every change goes
  through the same user confirmation as `#/apply`.

### Demo controller

`src/device/mock.js` patches the device driver with in-memory blocks and synthetic input reports (`?demo`).
Sections add their own demo data in `demo.js`. It's used for development, screenshots, support, and as a way
for customers without a controller to explore.

## Theming

`css/tokens.css` defines dark (default), light (`data-theme="light"`) and system (no attribute, follows the OS).
The palette is Super Famicom: red/yellow/green/blue face-button splashes and North-American lavender on a near-black
or vanilla-white canvas. Components only use semantic tokens (`--surface`, `--text-muted`, `--tone`…). Each
section has a `tone`; `tone-*` classes set `--tone`/`--tone-soft` for children.

Motion: 120–320 ms fades and ≤ 8 px offsets; no parallax or large movement. `prefers-reduced-motion` (and the
in-app "Reduce motion" switch) disables decorative animation; loading indicators marked `.motion-ok` keep going.
