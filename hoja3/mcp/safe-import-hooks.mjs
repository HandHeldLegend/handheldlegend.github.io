/**
 * safe-import-hooks.mjs — Node module-resolution hooks used ONLY when the settings catalog fails
 * to import (see catalog.mjs → loadCatalog). Registered lazily with `module.register()`.
 *
 * Why: src/settings/schema.js statically imports every src/sections/<id>/settings.js, and those files
 * import schema.js back (circular). If a single settings.js throws in Node (e.g. it touches `document`),
 * the whole catalog fails. These hooks let catalog.mjs import a *fresh copy* of the module graph in
 * which chosen sections' settings.js are replaced by `export default []`, so it can pinpoint the
 * offending sections and still serve everything else.
 *
 * Protocol (all carried in the URL query, so no shared state between threads is needed):
 *   schema.js?hhl-safe=<nonce>&hhl-stub=<id>,<id>
 *     hhl-safe  — any value; makes every file: module in the graph a fresh instance for this attempt
 *     hhl-stub  — comma-separated section ids whose settings.js should be stubbed
 * Both params are propagated from a parent module to every file: module it imports.
 */

const STUB_URL = 'data:text/javascript,export%20default%20%5B%5D%3B';
const SETTINGS_RE = /\/src\/sections\/([^/]+)\/settings\.js$/;

function tagOf(url) {
  if (!url || !url.startsWith('file:')) return null;
  const u = new URL(url);
  const safe = u.searchParams.get('hhl-safe');
  if (safe == null) return null;
  return { safe, stub: u.searchParams.get('hhl-stub') || '' };
}

export async function resolve(specifier, context, nextResolve) {
  const result = await nextResolve(specifier, context);
  if (!result.url.startsWith('file:')) return result;

  // The entry import carries the tag itself; everything below inherits it from its parent.
  const tag = tagOf(result.url) || tagOf(context.parentURL);
  if (!tag) return result;

  const u = new URL(result.url);
  const m = u.pathname.match(SETTINGS_RE);
  if (m && tag.stub.split(',').includes(m[1])) {
    return { url: `${STUB_URL}//${m[1]}`, format: 'module', shortCircuit: true };
  }
  u.searchParams.set('hhl-safe', tag.safe);
  if (tag.stub) u.searchParams.set('hhl-stub', tag.stub);
  else u.searchParams.delete('hhl-stub');
  return { ...result, url: u.href, shortCircuit: true };
}
