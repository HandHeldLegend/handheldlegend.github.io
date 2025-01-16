const CACHE_CONFIG = {
    version: 'v0.09a', // Increment this when you update files
    folders: {
        '/': ['index.html', 'attributions.txt'],
        '/js/': ['app.js', 'module-registry.js', 'gamepad.js', 'tooltips.js'],
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
        ]
    }
};

const CACHE_NAME = `app-cache-${CACHE_CONFIG.version}`;

async function precacheResources() {
    
    const resourceList = [];

    // Flatten the folder structure into a list of complete URLs
    for (const [folderPath, files] of Object.entries(CACHE_CONFIG.folders)) {
        for (const file of files) {
            resourceList.push(folderPath + file);
        }
    }

    console.log(resourceList);

    try {
        // Open the cache
        const cache = await caches.open(CACHE_NAME);
        
        // Add all resources to the cache
        await cache.addAll(resourceList);
        
        console.log(`Successfully cached ${resourceList.length} resources in ${CACHE_NAME}`);
        
        // Optional: Delete old caches
        const existingCaches = await caches.keys();
        const oldCaches = existingCaches.filter(name => 
            name.startsWith('app-cache-') && name !== CACHE_NAME
        );
        
        await Promise.all(
            oldCaches.map(CACHE_NAME => caches.delete(CACHE_NAME))
        );
        
        if (oldCaches.length > 0) {
            console.log(`Deleted ${oldCaches.length} old cache(s)`);
        }
        
        return true;
    } catch (error) {
        console.error('Failed to precache resources:', error);
        return false;
    }
}

// Cache management utility function
async function clearOldCaches(currentCacheName) {
  try {
      const names = await caches.keys();
      const deletionPromises = names
          .filter(name => name !== currentCacheName)
          .map(name => {
              console.log(`Deleting old cache: ${name}`);
              return caches.delete(name);
          });
      
      await Promise.all(deletionPromises);
  } catch (error) {
      console.error('Error clearing old caches:', error);
      throw error; // Re-throw to handle in calling context if needed
  }
}

self.addEventListener('install', event => {
  event.waitUntil(
      (async () => {
          try {
              // Clear old caches first
              await clearOldCaches(CACHE_NAME);
              
              // Then precache new resources
              await precacheResources();
          } catch (error) {
              console.error('Error during service worker installation:', error);
              // We still throw the error to ensure the service worker 
              // installation fails if critical operations couldn't complete
              throw error;
          }
      })()
  );
});

// Simplified activate event handler
self.addEventListener("activate", (event) => {
  event.waitUntil(
      (async () => {
          await clearOldCaches(CACHE_NAME);
          await clients.claim();
      })()
  );
});
  
self.addEventListener("fetch", (event) => {
  event.respondWith(
    (async () => {
      const requestURL = event.request.url;

      // First, try to get from cache
      try {
        const cache = await caches.open(CACHE_NAME);

        
        // Important: Need to create a new Request to ensure proper matching
        const normalizedRequest = new Request(requestURL, {
          mode: 'cors',  // or 'same-origin' depending on your needs
          credentials: 'same-origin',
          headers: new Headers(event.request.headers)
        });
        
        const cachedResponse = await cache.match(normalizedRequest);
        
        if (cachedResponse) {

          return cachedResponse;
        }

      } catch (cacheError) {
        console.error(`[SW] Cache access error:`, cacheError);
      }

      // If not in cache or cache error, try network
      try {

        const networkResponse = await fetch(event.request);
        
        if (networkResponse.ok) {

          // Cache the successful response
          try {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(event.request, networkResponse.clone());

          } catch (cacheError) {
            console.error(`[SW] Error caching network response:`, cacheError);
          }
          
          return networkResponse;
        }
        
        throw new Error(`Network response was not ok: ${networkResponse.status}`);
      } catch (networkError) {

        // One last try from cache with less strict matching
        try {
          const cache = await caches.open(CACHE_NAME);
          const allCacheKeys = await cache.keys();
          
          // Try to find a match ignoring search params
          const urlWithoutSearch = requestURL.split('?')[0];
          const matchingKey = allCacheKeys.find(key => 
            key.url.split('?')[0] === urlWithoutSearch
          );
          
          if (matchingKey) {
            const cachedResponse = await cache.match(matchingKey);
            if (cachedResponse) {
              return cachedResponse;
            }
          }
        } catch (fallbackError) {
          console.error(`[SW] Fallback cache access error:`, fallbackError);
        }
        
        // If we get here, both network and cache have failed
        console.error(`[SW] All retrieval methods failed for: ${requestURL}`);
        return new Response(`Network and cache both failed for: ${requestURL}`, {
          status: 504,
          statusText: 'Gateway Timeout',
          headers: new Headers({
            'Content-Type': 'text/plain'
          })
        });
      }
    })()
  );
});