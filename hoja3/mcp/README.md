# HHL Gamepad Config — MCP server

A zero-dependency [Model Context Protocol](https://modelcontextprotocol.io) server that lets AI assistants
(Claude Desktop, Claude Code, and any other MCP client) help customers configure HOJA controllers with
HHL Gamepad Config: find the right page, explain settings, build deep links that pre-fill settings, and
troubleshoot common problems.

It reads the app's own source — `src/sections/registry.js` (pages, deep-link params) and
`src/settings/schema.js` (every setting, with the same validation the app uses) — so it can't drift from
what the app ships.

Requires **Node.js 20.6 or newer**. Nothing to install.

```
node hoja3/mcp/server.mjs      # stdio transport (newline-delimited JSON-RPC 2.0)
```

## Safety model

- **The server never touches hardware.** It has no USB access and can't read or change a controller.
- It only produces **links**. A settings link (`#/apply?...`) opens the app, which shows every change as
  *current → new* and does nothing until the customer presses **Apply** (live) or **Apply & save** (also written
  to flash). **Cancel** discards it. Settings the controller lacks hardware for are skipped.
- Values are validated with the app's own `coerceValue()` before a link is built, so out-of-range or unknown
  values never reach the customer.
- Firmware installs, calibration, button remapping and pairing are deliberately not settable by link; the
  assistant links to the page and walks the customer through it.
- The only network access is the optional `list_firmware_builds {live: true}`, which reads the public build
  list from GitHub.

## Use with Claude Desktop

Add to `claude_desktop_config.json` (Settings → Developer → Edit Config), using the absolute path to your clone:

```json
{
  "mcpServers": {
    "hhl-gamepad": {
      "command": "node",
      "args": ["C:/path/to/handheldlegend.github.io/hoja3/mcp/server.mjs"],
      "env": { "HHL_APP_URL": "https://handheldlegend.github.io/hoja3/" }
    }
  }
}
```

Restart Claude Desktop; the server's tools and prompts (e.g. *Fix stick drift*) then appear in the chat's
tools/connectors menu.

## Use with Claude Code

```
claude mcp add hhl-gamepad -- node /path/to/handheldlegend.github.io/hoja3/mcp/server.mjs
```

Add `--scope project` to share it via `.mcp.json`, or `-e HHL_APP_URL=http://localhost:5173/` to point links at a
local dev server. Check it with `claude mcp list` or `/mcp` inside a session.

## Other MCP clients

Any client that supports the stdio transport works: run `node <path>/hoja3/mcp/server.mjs` as the server command
with no arguments. Protocol versions `2025-06-18` (preferred), `2025-03-26` and `2024-11-05` are supported.
Logs go to stderr; stdout carries only protocol messages.

To try it by hand:

```
npx @modelcontextprotocol/inspector node hoja3/mcp/server.mjs
```

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `HHL_APP_URL` | `https://handheldlegend.github.io/hoja3/` | Base URL used in every generated link (use `http://localhost:5173/` for development). |
| `HHL_MCP_DEBUG` | unset | `1` logs every request and response to stderr. |

## Tools

| Tool | What it does |
|---|---|
| `list_pages` | Every page with summary, required capability, deep-link params and URL. |
| `list_settings` `{section?, query?}` | Settings that can be proposed by key: type, range/options, unit, capability, description. |
| `describe_setting` `{key}` | Full details for one setting, plus the page where it lives. |
| `build_page_link` `{page, params?}` | Validated link to a page, e.g. `#/joysticks?stick=left&tab=calibrate`. |
| `build_settings_link` `{settings, then?}` | Validates values and returns an `#/apply` link, a human summary and any rejected entries. |
| `troubleshoot` `{topic}` | Guidance from the knowledge base (`docs/KNOWLEDGE.md`) by topic id or free text. |
| `list_firmware_builds` `{live?}` | Controller firmware builds with install links (`live: true` asks GitHub). |

Tools return Markdown text plus `structuredContent` (on protocol 2025-06-18).

**Resources:** `hhl://docs/llms.txt`, `hhl://docs/deeplinks.md`, `hhl://docs/knowledge.md`,
`hhl://catalog/pages.json`, `hhl://catalog/settings.json`, `hhl://knowledge/<topic>`, and the templates
`hhl://knowledge/{topic}` and `hhl://settings/{key}`. The docs are rendered live from the catalog.

**Prompts:** `setup-new-controller {controller?}`, `fix-stick-drift {stick?}`, `remap-for-mode {mode}`,
`update-firmware {build?}`.

## In the browser

When the app is open, the same capabilities are available in-page as `window.hhl` (see `src/agent/bridge.js`) and
are registered with the browser's WebMCP API (`navigator.modelContext`) where supported. There,
`proposeSettings()` opens the same confirmation dialog as `#/apply` links.

## Files

| File | Purpose |
|---|---|
| `server.mjs` | Protocol handling, tools, resources, prompts. |
| `catalog.mjs` | Loads pages and settings from the app source; link building and validation. |
| `docs.mjs` | Renders `llms.txt` and `docs/DEEPLINKS.md` (also used by `tools/gen-docs.mjs`). |
| `knowledge.mjs` | Parses and searches `docs/KNOWLEDGE.md`. |
| `safe-import-hooks.mjs` | Fallback loader: if a section's `settings.js` can't run in Node, that section is skipped with a warning instead of taking the server down. |

## Maintenance

- Adding a page or a `SettingDef` needs no change here. Run `node tools/gen-docs.mjs` to refresh `llms.txt` and
  `docs/DEEPLINKS.md` (`--check` fails if they're stale).
- Add troubleshooting topics to `docs/KNOWLEDGE.md` as `## Title` + `<!-- topic: id; keywords: … -->`.
- `node tools/test-mcp.mjs` runs the end-to-end test (set `HHL_TEST_LIVE=1` to include the GitHub fetch).
- `settings.js` files must stay DOM-free; if one isn't, the server logs `warning: Skipped settings for section …`.
