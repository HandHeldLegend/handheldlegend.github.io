const CACHE_VERSION = 'v6';
const CACHE_NAME = `hoja-site-cache-${CACHE_VERSION}`;

const root_css_url = 'https://handheldlegend.github.io/css/'

const urlsToCache = [
    // HTML files
    'index.html',

    // JS Files
    'js/hoja_config_codes.js',
    'js/hoja_config.js',
    'js/hoja_global.js',
    'js/hoja_strings.js',
    'js/hoja_input.js',

    'js/svg-loader.min.js',
    'js/iro.min.js',

    'js/modules/pico_update.js',
    'js/modules/analog_stick.js',
    'js/modules/analog_triggers.js',
    'js/modules/capabilities.js',
    'js/modules/color_settings.js',
    'js/modules/device_ids.js',
    'js/modules/gyroscope.js',
    'js/modules/hardware_test.js',
    'js/modules/network.js',
    'js/modules/octagon_calibration.js',
    'js/modules/remapping.js',
    'js/modules/snapback_viewer.js',
    'js/modules/system.js',
    'js/modules/version.js',
    'js/modules/vibration.js',
    'js/esp/install-button.js',


    'svg/procontroller.svg',
    'svg/snescontroller.svg',
    'svg/wrench-svgrepo-com.svg',
  
    // Image Files
    //'../css/spooky/jak1.svg',
    //'/css/spooky/jak2.svg',
    //'/css/spooky/jak3.svg',
  
    // Favicon
    'images/favicon.ico',
    'images/icon_transparent.png',
  
    // CSS Files
    '/css/style.css',
    '/css/root.css',
    '/css/spooky/spooky.css',
    '/css/sliderPicker.css',
    '/css/radioPicker.css',
    '/css/containers.css',

    'css/hojaConfig.css',
    'css/hojaColor.css',
    'css/hojaAnalog.css',
    'css/hojaRemap.css',
    'css/hojaTrigger.css',
    
  ];
  
  // Function to check and manage caches
  async function checkAndManageCaches() {
    console.log('Checking caches...');
    const cacheNames = await caches.keys();
    const outdatedCaches = cacheNames.filter(name => name !== CACHE_NAME);
    
    await Promise.all(outdatedCaches.map(async (cacheName) => {
      console.log(`Deleting outdated cache: ${cacheName}`);
      await caches.delete(cacheName);
    }));
  
    console.log('Cache check complete');
  }


  self.addEventListener('install', event => {
    event.waitUntil(
      checkAndManageCaches()
        .then(() => caches.open(CACHE_NAME))
        .then(cache => {
          console.log(`Opened cache: ${CACHE_NAME}`);
          return Promise.all(
            urlsToCache.map(url => {
              return cache.add(url)
                .then(() => console.log(`Successfully cached: ${url}`))
                .catch(error => {
                  console.error(`Failed to cache: ${url}`);
                  console.error(`Error: ${error.message}`);
                  // Don't reject the promise, just log the error
                  return Promise.resolve();
                });
            })
          );
        })
        .then(() => console.log('All available items have been cached successfully'))
        .catch(error => {
          console.error('Cache installation encountered an error');
          console.error(`Error: ${error.message}`);
          // Don't throw the error, allow installation to continue
        })
        .then(() => self.skipWaiting()) // Force the waiting service worker to become active
    );
  });

  self.addEventListener('activate', event => {
    event.waitUntil(
      checkAndManageCaches()
        .then(() => {
          console.log('Caches have been checked and managed');
          // Ensure that the new service worker becomes active immediately
          return self.clients.claim();
        })
        .then(() => {
          // Optionally, you can send a message to all clients about the update
          return self.clients.matchAll().then(clients => {
            return Promise.all(clients.map(client => {
              return client.postMessage({ type: 'CACHE_UPDATED' });
            }));
          });
        })
    );
  });

  self.addEventListener('fetch', event => {
    // Check if the request URL is supported for caching
    if (event.request.url.startsWith('http') || event.request.url.startsWith('https')) {
      event.respondWith(
        checkAndManageCaches().then(() => {
          return caches.match(event.request)
            .then(response => {
              // Cache hit - return response
              if (response) {
                return response;
              }
  
              // Clone the request. A request is a stream and can only be consumed once.
              const fetchRequest = event.request.clone();
  
              return fetch(fetchRequest).then(response => {
                // Check if we received a valid response
                if (!response || response.status !== 200 || response.type !== 'basic') {
                  return response;
                }
  
                // Clone the response. A response is a stream and can only be consumed once.
                const responseToCache = response.clone();
  
                caches.open(CACHE_NAME)
                  .then(cache => {
                    cache.put(event.request, responseToCache);
                    console.log(`Cached resource: ${event.request.url}`);
                  })
                  .catch(error => {
                    console.error(`Failed to cache resource: ${event.request.url}`);
                    console.error(`Error: ${error.message}`);
                  });
  
                return response;
              });
            });
        })
      );
    } else {
      // For non-HTTP(S) requests, just fetch without trying to cache
      console.log(`Skipping cache for non-HTTP(S) request: ${event.request.url}`);
      event.respondWith(fetch(event.request));
    }
  });

  // Listen for messages from the client
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'CHECK_CACHES') {
    event.waitUntil(checkAndManageCaches());
  }
});
