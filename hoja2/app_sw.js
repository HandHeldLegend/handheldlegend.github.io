const CACHE_CONFIG = {
    version: 'v0.04', // Increment this when you update files
    folders: {
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
            'hapticConfig.js', 'hapticInfoStatic.js',
            'imuConfig.js', 'imuInfoStatic.js',
            'remapConfig.js', 'rgbConfig.js',
            'rgbGroupName.js', 'rgbInfoStatic.js',
            'triggerConfig.js', 'userConfig.js'
        ]
    }
};

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open('app-cache-' + CACHE_CONFIG.version).then(async (cache) => {
            const filesToCache = Object.entries(CACHE_CONFIG.folders)
                .flatMap(([folder, files]) => 
                    files.map(file => folder.replace('./', '/') + file)
                );
            
            // Try to cache files individually to identify failures
            const failures = [];
            for (const file of filesToCache) {
                try {
                    await cache.add(file);
                    console.log('Successfully cached:', file);
                } catch (error) {
                    console.error('Failed to cache:', file, error);
                    failures.push(file);
                }
            }
            
            if (failures.length > 0) {
                console.error('Failed to cache files:', failures);
                throw new Error('Some files failed to cache');
            }
            
            return true;
        })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== 'app-cache-' + CACHE_CONFIG.version) {
                        // Delete old cache versions
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Always try network first for fresh content
                return fetch(event.request)
                    .then(networkResponse => {
                        // Clone the response before using it
                        const responseToCache = networkResponse.clone();
                        
                        // Cache the cloned version
                        caches.open('app-cache-' + CACHE_CONFIG.version)
                            .then(cache => cache.put(event.request, responseToCache));
                            
                        return networkResponse;
                    })
                    .catch(() => {
                        // Fall back to cache if network fails
                        return response;
                    });
            })
    );
});
