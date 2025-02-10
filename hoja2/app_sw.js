const CACHE_CONFIG = {
  version: 'v0.001.016', // Increment this when you update files
  folders: {
    '/': ['', 'index.html', 'attributions.txt', 'manifest.json'],
    '/js/': ['app.js', 'module-registry.js', 'gamepad.js', 'tooltips.js', 'legacy.js'],
    '/assets/3d/': ['supergamepad.stl'],
    '/libs/': ['STLLoader.js', 'three.min.js'],
    '/css/': ['styles.css'],
    '/components/': [
      'host-template.css',
      'analog-stick-visual.js',
      'angle-selector.js', 'angle-selector.css',
      'axis-invert-selector.js', 'axis-invert-selector.css',
      'dual-analog-trigger.js', 'dual-analog-trigger.css',
      'group-rgb-picker.js', 'group-rgb-picker.css',
      'imu-data-display.js', 'imu-data-display.css',
      'mac-address-selector.js', 'mac-address-selector.css',
      'multi-position-button.js', 'multi-position-button.css',
      'number-selector.js', 'number-selector.css',
      'remap-selector.js', 'remap-selector.css',
      'sensor-visualization.js', 'sensor-visualization.css',
      'single-shot-button.js', 'single-shot-button.css',
      'text-entry.js', 'text-entry.css',
      'tristate-button.js', 'tristate-button.css'
    ],
    '/modules/': [
      'analog-md.js',
      'battery-md.js',
      'gamepad-md.js',
      'haptic-md.js',
      'motion-md.js',
      'remap-md.js',
      'rgb-md.js',
      'trigger-md.js',
      'user-md.js',
      'wireless-md.js'
    ],
    '/factory/parsers/': [
      'analogConfig.js', 'analogInfoStatic.js',
      'analogPackedDistances.js', 'angleMap.js',
      'batteryConfig.js', 'batteryInfoStatic.js',
      'bluetoothInfoStatic.js', 'buttonInfoStatic.js',
      'buttonRemap.js', 'deviceInfoStatic.js',
      'gamepadConfig.js', 'hapticConfig.js',
      'hapticInfoStatic.js',
      'imuConfig.js', 'imuInfoStatic.js',
      'remapConfig.js', 'rgbConfig.js',
      'rgbGroupName.js', 'rgbInfoStatic.js',
      'triggerConfig.js', 'userConfig.js'
    ],
    '/images/' : ['icon_transparent.png', 'favicon.ico'], 
    '/assets/icons/': ['analog.svg', 'battery.svg', 'gamepad.svg', 'haptics.svg', 'motion.svg', 'remap.svg', 'rgb.svg', 'triggers.svg', 'user.svg', 'wireless.svg']
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

        console.error('[Service Worker] Cache miss for:', request.url);

        // If it's a JSON request, fall back to network
        if (request.url.endsWith('.json')) {
          console.log('[Service Worker] Fetching JSON from network:', request.url);
          return fetch(request)
            .then(networkResponse => {
              if (!networkResponse || !networkResponse.ok) {
                throw new Error('Network response failed');
              }
              return networkResponse;
            })
            .catch(error => {
              console.error('[Service Worker] Network fetch failed for JSON:', request.url, error);
              return new Response('Failed to fetch JSON resource', { status: 500 });
            });
        }

        // Default behavior: Log cache contents and return a 404 response
        return caches.open(CACHE_NAME).then(cache => {
          return cache.keys().then(keys => {
            return new Response('Resource not available offline', { status: 404 });
          });
        });
      })
  );
});