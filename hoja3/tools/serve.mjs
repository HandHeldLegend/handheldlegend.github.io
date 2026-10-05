#!/usr/bin/env node
/**
 * serve.mjs — Zero-dependency dev server for the app.
 *
 *   node tools/serve.mjs            # http://localhost:5173/
 *   node tools/serve.mjs --port 8080
 *
 * Serves the hoja3 folder with no-cache headers so a plain refresh always shows your edits.
 * The service worker is disabled on localhost unless you open the page with ?sw (see src/app/pwa.js).
 * WebUSB works on http://localhost because browsers treat it as a secure context.
 */
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argPort = process.argv.indexOf('--port');
const PORT = Number(argPort > -1 ? process.argv[argPort + 1] : process.env.PORT || 5173);

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8', '.uf2': 'application/octet-stream', '.bin': 'application/octet-stream',
  '.stl': 'model/stl', '.woff2': 'font/woff2', '.wasm': 'application/wasm',
};

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    let file = path.join(ROOT, decodeURIComponent(url.pathname));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    if ((await stat(file).catch(() => null))?.isDirectory()) file = path.join(file, 'index.html');
    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
  }
}).listen(PORT, () => {
  console.log(`HHL Gamepad Config dev server → http://localhost:${PORT}/   (demo controller: http://localhost:${PORT}/?demo)`);
});
