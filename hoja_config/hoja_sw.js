const CACHE_NAME = 'hoja-pwa-cache-v1';
const urlsToCache = [
    // JS Files
    'js/hoja_version.js',
    'js/hoja_global.js',
    'js/hoja_strings.js',
    'js/hoja_gcsp.js',
    'js/hoja_remap.js',
    'js/hoja_snapback.js',
    'js/hoja_analog.js',
    'js/hoja_input.js',
    'js/hoja_color.js',
    'js/svg-loader.min.js',
    'js/iro.min.js',
    'js/hoja_config.js',

    'svg/procontroller.svg',
    'svg/snescontroller.svg',
  
    // Image Files
    //'../css/spooky/jak1.svg',
    //'/css/spooky/jak2.svg',
    //'/css/spooky/jak3.svg',
  
    // Favicon
    //'/images/favicon.ico',
  
    // CSS Files
    //'/css/style.css',
    //'/css/hojaConfig.css',
    //'/css/hojaColor.css',
    //'/css/hojaAnalog.css',
    //'/css/hojaRemap.css',
    //'/css/sliderPicker.css',
    //'/css/radioPicker.css',
    //'/css/containers.css',
    //'/css/spooky/spooky.css'
  ];
  

self.addEventListener('install', event => {
  // Perform the install steps
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
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