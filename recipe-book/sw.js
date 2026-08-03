const CACHE_NAME = 'kathies-kitchen-shell-v14';
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.mjs',
  './icon.svg',
  './icon-180.png',
  './manifest.webmanifest',
  './lib/core.mjs',
  './lib/db.mjs',
  './lib/importers.mjs',
  './lib/private-library.mjs',
  './lib/fflate.mjs',
];

self.addEventListener('install', (event) => {
  event.waitUntil(Promise.all([
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)),
    self.skipWaiting(),
  ]));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  const privateApiPath = new URL('api/', self.registration.scope).pathname.toLowerCase();
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.toLowerCase().startsWith(privateApiPath)) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('./index.html')));
    return;
  }

  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
    if (response.ok) {
      const clone = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
    }
    return response;
  })));
});
