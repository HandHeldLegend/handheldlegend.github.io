self.addEventListener('install', (event) => {
  console.log('Service Worker installed, preparing to uninstall...');
  self.skipWaiting(); // Activate immediately
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activated, cleaning up...');
  
  // Clear caches
  event.waitUntil(
      caches.keys().then(cacheNames => {
          return Promise.all(
              cacheNames.map(cacheName => caches.delete(cacheName))
          );
      }).then(() => {
          console.log('All caches deleted.');
      })
  );

  // Unregister the service worker
  self.registration.unregister().then(success => {
      console.log('Service Worker unregistered:', success);
  });

  // Ensure clients are controlled before closing
  self.clients.matchAll({ type: 'window' }).then(clients => {
      clients.forEach(client => client.navigate(client.url));
  });
});
