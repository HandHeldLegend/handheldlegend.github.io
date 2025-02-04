const CACHE_CONFIG = {
    version: 'v0.13.5', // Increment this when you update files
    folders: {
        '/': ['index.html', 'attributions.txt'],
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
        '/assets/icons/': ['analog.svg', 'battery.svg', 'gamepad.svg', 'haptics.svg', 'motion.svg', 'remap.svg', 'rgb.svg', 'triggers.svg', 'user.svg', 'wireless.svg']
    }
};

const CACHE_NAME = `app-cache-${CACHE_CONFIG.version}`;

// Utility function to get a list of all resources to cache
function getResourceList() {
  const resourceList = [];
  for (const [folderPath, files] of Object.entries(CACHE_CONFIG.folders)) {
      for (const file of files) {
          resourceList.push(folderPath + file);
      }
  }
  return resourceList;
}

async function precacheResources() {
  try {
      // First, delete the existing cache with the same name if it exists
      await caches.delete(CACHE_NAME);

      const cache = await caches.open(CACHE_NAME);
      const resourceList = getResourceList();
      
      // Add all resources to the cache
      await cache.addAll(resourceList);
      console.log(`Successfully cached ${resourceList.length} resources in ${CACHE_NAME}`);
      return true;
  } catch (error) {
      console.error('Failed to precache resources:', error);
      return false;
  }
}

async function clearOldCaches() {
  const existingCaches = await caches.keys();
  const oldCaches = existingCaches.filter(name => 
      name.startsWith('app-cache-') && name !== CACHE_NAME
  );
  
  await Promise.all(
      oldCaches.map(cacheName => {
          console.log(`Deleting old cache: ${cacheName}`);
          return caches.delete(cacheName);
      })
  );
  
  return oldCaches.length;
}

// Install event - precache all resources
self.addEventListener('install', event => {
  console.log(`Installing new service worker with cache: ${CACHE_NAME}`);
  
  event.waitUntil(
      (async () => {
          try {
            // Precache resources
            await precacheResources();

            // Skip waiting immediately to ensure the new service worker takes over
            await self.skipWaiting();
              
            console.log('Service worker installation complete');
          } catch (error) {
              console.error('Service worker installation failed:', error);
              throw error;
          }
      })()
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('New service worker activating...');
  
  event.waitUntil(
      (async () => {
          try {
              // Clear old caches
              const deletedCaches = await clearOldCaches();
              console.log(`Cleared ${deletedCaches} old cache(s)`);
              
              // Take control of all clients immediately
              await clients.claim();
              
              console.log('Service worker activation complete');
          } catch (error) {
              console.error('Service worker activation failed:', error);
              throw error;
          }
      })()
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
      (async () => {
          try {
              const cache = await caches.open(CACHE_NAME);

              // Try network first
              try {
                  const networkResponse = await fetch(event.request);
                  if (networkResponse.ok) {
                      await cache.put(event.request, networkResponse.clone());
                      return networkResponse;
                  }
              } catch (error) {
                  // Network failed, fall back to cache
                  console.log('Network request failed, falling back to cache');
              }

              // Return cached response if available
              const cachedResponse = await cache.match(event.request);
              if (cachedResponse) {
                  return cachedResponse;
              }

              // If neither network nor cache worked, return error
              return new Response('Unable to fetch resource', {
                  status: 504,
                  statusText: 'Gateway Timeout',
                  headers: {
                      'Content-Type': 'text/plain'
                  }
              });
          } catch (error) {
              console.error(`Fetch failed for ${event.request.url}:`, error);
              throw error;
          }
      })()
  );
});