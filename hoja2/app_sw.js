const CACHE_CONFIG = {
  version: 'v0.003.018', // Increment this when you update files
  folders: {
    '/': ['attributions.txt', 'index.html', 'manifest.json', 'ping.json'],
    '/assets/3d/': ['supergamepad.stl', 'supergamepadOLD.stl'],
    '/assets/icons/': ['analog.svg', 'battery.svg', 'dpad.svg', 'gamepad.svg', 'haptics.svg', 'motion.svg', 'remap.svg', 'rgb.svg', 'triggers.svg', 'user.svg', 'wireless.svg'],
    '/components/': ['analog-stick-visual.js', 'angle-selector.css', 'angle-selector.js', 'axis-invert-selector.css', 'axis-invert-selector.js', 'button-grid.css', 'button-grid.js', 'components.css', 'components.js', 'group-rgb-picker.css', 'group-rgb-picker.js', 'host-template.css', 'imu-data-display.css', 'imu-data-display.js', 'input-config-panel.css', 'input-config-panel.js', 'input-mapping-display.css', 'input-mapping-display.js', 'mac-address-selector.css', 'mac-address-selector.js', 'multi-position-button.css', 'multi-position-button.js', 'number-selector.css', 'number-selector.js', 'remap-box.css', 'remap-box.js', 'sensor-visualization.css', 'sensor-visualization.js', 'single-shot-button.css', 'single-shot-button.js', 'text-entry.css', 'text-entry.js', 'tristate-button.css', 'tristate-button.js', 'waveform-display.css', 'waveform-display.js'],
    '/css/': ['modules.css', 'styles.css'],
    '/images/': ['favicon-16x16.png', 'favicon-32x32.png', 'favicon.ico', 'favicon.png', 'icon_full.png', 'icon_transparent.png'],
    '/images/glyphs/': ['1.png', '2.png', '3.png', '4.png', '5.png', '6.png', 'a.png', 'b.png', 'back.png', 'capture.png', 'cdown.png', 'cleft.png', 'cright.png', 'cup.png', 'cx+.png', 'cx-.png', 'cy+.png', 'cy-.png', 'ddown.png', 'disabled.png', 'dleft.png', 'dright.png', 'dup.png', 'east.png', 'gl.png', 'gr.png', 'guide.png', 'home.png', 'l.png', 'l1.png', 'l2.png', 'l2a.png', 'l4.png', 'l5.png', 'lb.png', 'lg.png', 'lp.png', 'ls.png', 'lt.png', 'lx+.png', 'lx-.png', 'ly+.png', 'ly-.png', 'minus.png', 'north.png', 'plus.png', 'power.png', 'r.png', 'r1.png', 'r2.png', 'r2a.png', 'r4.png', 'r5.png', 'rb.png', 'rg.png', 'rp.png', 'rs.png', 'rt.png', 'rx+.png', 'rx-.png', 'ry+.png', 'ry-.png', 'select.png', 'sguide.png', 'share.png', 'sl.png', 'soptions.png', 'south.png', 'sr.png', 'sselect.png', 'start.png', 'sview.png', 'tp.png', 'tpl.png', 'tpr.png', 'west.png', 'x+.png', 'x-.png', 'x.png', 'y+.png', 'y-.png', 'y.png', 'z.png', 'zl.png', 'zr.png'],
    '/js/': ['app.js', 'gamepad.js', 'legacy.js', 'module-registry.js', 'pico_update.js', 'tooltips.js'],
    '/libs/': ['STLLoader.js', 'three.min.js'],
    '/modules/': ['analog-md.js', 'battery-md.js', 'dpad-md.js', 'gamepad-md.js', 'haptic-md.js', 'input-md.js', 'motion-md.js', 'rgb-md.js', 'user-md.js', 'wireless-md.js']
  }
};

const PWA_SCOPE = '/hoja2';
const CACHE_NAME = `app-cache-${CACHE_CONFIG.version}`;

/**
 * Generate a list of resources with the correct scope prefix.
 * @returns {string[]} List of resources to cache
 */
function getCacheResourceList() {
  const resources = [];

  for (const folder in CACHE_CONFIG.folders) {
    CACHE_CONFIG.folders[folder].forEach(file => {
      const fullPath = `.${folder}${file}`;
      resources.push(fullPath);
    });
  }

  console.log(resources);

  return resources;
}

// Example usage
const ASSETS_TO_CACHE = getCacheResourceList();

// Install event - cache everything upfront
self.addEventListener('install', event => {
  console.log('[Service Worker] Installing');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching all resources');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .catch(error => console.error('[Service Worker] Caching failed:', error))
  );

  self.skipWaiting(); // Force activation of the new SW
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME) // Remove old caches
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim(); // Ensure all pages immediately use the new service worker
});

self.addEventListener('fetch', event => {
  console.log('[Service Worker] Fetch request:', {
    url: event.request.url,
    mode: event.request.mode,
    destination: event.request.destination
  });

  // Force no-cors mode for JavaScript files
  let request = event.request;
  if (request.url.endsWith('.js')) {
    request = new Request(request, { mode: 'no-cors' });
  }

  event.respondWith(
    caches.match(request)
      .then(response => {
        if (response) {
          console.log('[Service Worker] Cache hit for:', request.url);
          return response;
        }

        console.log('[Service Worker] Cache miss for:', request.url);
        
        // Attempt network fetch for all resources
        return fetch(request)
          .then(networkResponse => {
            if (!networkResponse || !networkResponse.ok) {
              throw new Error('Network response failed');
            }
            
            // Clone the response since we might want to cache it
            const responseToCache = networkResponse.clone();
            
            // Only cache if it's not a manifest.json, .uf2, or .bin file
            if (!request.url.endsWith('manifest.json') && 
                !request.url.endsWith('.uf2') && 
                !request.url.endsWith('.bin')) {
              caches.open(CACHE_NAME)
                .then(cache => {
                  cache.put(request, responseToCache)
                    .catch(error => {
                      console.error('[Service Worker] Failed to cache response:', error);
                    });
                });
            }
            
            return networkResponse;
          })
          .catch(error => {
            console.error('[Service Worker] Network fetch failed:', request.url, error);
            
            // Custom error responses based on resource type
            if (request.url.endsWith('.json')) {
              return new Response('Failed to fetch JSON resource', { 
                status: 500,
                headers: { 'Content-Type': 'application/json' }
              });
            } else if (request.url.endsWith('.js')) {
              return new Response('console.error("Failed to load script");', {
                status: 500,
                headers: { 'Content-Type': 'application/javascript' }
              });
            } else {
              return new Response('Resource not available', { 
                status: 504,
                headers: { 'Content-Type': 'text/plain' }
              });
            }
          });
      })
  );

});