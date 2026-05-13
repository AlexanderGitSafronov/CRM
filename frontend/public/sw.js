// Minimal service worker — present only so Chrome treats the app as installable.
// No offline caching: CRM data is dynamic and stale caches would be misleading.
// If real offline support is added later, layer Workbox / runtime caching here.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
  // Pass-through: no caching strategy.
});
