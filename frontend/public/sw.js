// Minimal service worker — present only so Chrome treats the app as installable.
// No offline caching: CRM data is dynamic and stale caches would be misleading.
// If real offline support is added later, layer Workbox / runtime caching here.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Намеренно НЕТ обработчика 'fetch': пустой pass-through лишь добавлял диспетч
// service worker к каждому запросу без пользы. Современный Chrome (89+) считает
// приложение устанавливаемым и без fetch-обработчика (достаточно manifest + SW).
