# HHL Gamepad Config

*Internal name: **hoja3** — the successor to `hoja2/`.*

An installable, offline-first web app (PWA) for configuring, calibrating and updating controllers running
[HOJA firmware](https://github.com/HandHeldLegend/HOJA-LIB-RP2040) from Hand Held Legend. Talks to the controller
over WebUSB; works on desktop (Windows/macOS/Linux/ChromeOS) and Android in Chromium browsers.

- No build step, no dependencies: plain ES modules, a tiny UI kit, and CSS design tokens.
- Struct layouts come **straight from the firmware headers** (`tools/sync-firmware.mjs`).
- Every page and most settings are deep-linkable, and an MCP server lets AI assistants help customers.
- Feature parity with hoja2, plus a demo controller, app updates with progress, and the Gameplay Arena.

## Quick start

```bash
cd hoja3
node tools/serve.mjs          # http://localhost:5173/   (no install needed)
```

- `http://localhost:5173/?demo` — simulated controller (no hardware needed).
- `http://localhost:5173/?sw` — enable the service worker locally to test offline/updates (off by default in dev so a refresh always shows your edits).
- `?debug=force-update` — force the firmware update prompt on connect (same as hoja2).

## Everyday tasks

| Task | Command |
|---|---|
| Run the checks | `node tools/test.mjs` |
| Firmware headers changed (new fields/blocks/enums) | `node tools/sync-firmware.mjs` (local checkout) or `--github main` |
| Before deploying | `node tools/precache.mjs` (regenerates the offline file list + version) |
| Regenerate assistant docs (`llms.txt`, `docs/DEEPLINKS.md`) | `node tools/gen-docs.mjs` |
| Regenerate icons | `python tools/make_icons.py` |
| MCP server for assistants | see [`mcp/README.md`](mcp/README.md) |

Deploying is just pushing to GitHub Pages: the app is served from `/hoja3/`, and every path is relative, so the
folder can be renamed freely.

## Project layout

```
hoja3/
├─ index.html              shell markup, splash, theme pre-paint, platform icons
├─ manifest.webmanifest    PWA manifest (icons, shortcuts)
├─ sw.js                   service worker (precache + update flow)
├─ precache-manifest.js    GENERATED offline file list + version
├─ llms.txt                GENERATED guide for AI assistants
├─ css/                    tokens.css (theme) · base.css · components.css (UI kit) · shell.css
├─ src/
│  ├─ main.js              boot sequence
│  ├─ app/                 shell (layout/nav), router (deep links), prefs (theme), pwa, update UI
│  ├─ ui/                  dom helper, icons, controls (UI kit), overlays (dialogs, toasts, tooltips)
│  ├─ device/              WebUSB driver, session, struct runtime, report decoder, demo controller
│  │  └─ generated/        fw-layout.js — GENERATED from the firmware headers
│  ├─ firmware/            update/install state machine, PICOBOOT flasher, build catalog
│  ├─ settings/            declarative settings schema, bound fields, #/apply deep links
│  ├─ agent/               window.hhl bridge + WebMCP tools
│  └─ sections/<id>/       one folder per page: view.js · settings.js · demo.js · <id>.css
├─ assets/                 icons (app + UI sprite), glyphs, 3D model
├─ vendor/                 third-party libraries (see ATTRIBUTIONS.md)
├─ firmware/               bundled recovery image (flash nuke)
├─ mcp/                    MCP server for assistants (Node, zero deps)
├─ tools/                  dev server, generators, tests
└─ docs/                   ARCHITECTURE.md · SECTIONS.md · DEEPLINKS.md · KNOWLEDGE.md
```

Start with [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), then [`docs/SECTIONS.md`](docs/SECTIONS.md) to add or change a page.

## Attributions

See [`ATTRIBUTIONS.md`](ATTRIBUTIONS.md) (also shown in the app under *Help & about*).
