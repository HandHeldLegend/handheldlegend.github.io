const CACHE_NAME = 'hoja-pwa-cache-v25r6';

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

    'js/modules/analog_stick.js',
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

    'svg/procontroller.svg',
    'svg/snescontroller.svg',
  
    // Image Files
    //'../css/spooky/jak1.svg',
    //'/css/spooky/jak2.svg',
    //'/css/spooky/jak3.svg',
  
    // Favicon
    //'/images/favicon.ico',
  
    // CSS Files
    '/css/style.css',
    'css/hojaConfig.css',
    'css/hojaColor.css',
    'css/hojaAnalog.css',
    'css/hojaRemap.css',
    '/css/sliderPicker.css',
    '/css/radioPicker.css',
    '/css/containers.css',
  ];
  

self.addEventListener('install', event => {
  // Perform the install steps
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {

        caches.keys().then(cacheNames => {
          return Promise.all(
              cacheNames.map(cache => {
                  if (cache !== CACHE_NAME) {
                      console.log("Deleting stale cache (Install).");
                      var s = caches.delete(cache);
                      return s;
                  }
              })
          );
      })

        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('activate', event => {
  // Clean up old caches
  event.waitUntil(
      caches.keys().then(cacheNames => {
          return Promise.all(
              cacheNames.map(cache => {
                  if (cache !== CACHE_NAME) {
                      console.log("Deleting stale cache (Activate).");
                      return caches.delete(cache);
                  }
              })
          );
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return the response from the cached version
        if (response) {
          return response;
        }

        // If not found in cache, fetch from network
        return fetch(event.request).then(
          response => {
            // Check if we received a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        );
      })
  );
});
