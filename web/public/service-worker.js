const CACHE = 'my-community-static-v1';
const PRECACHE = ['/', '/manifest.webmanifest', '/icons/icon.svg', '/icons/icon-48.png', '/icons/icon-128.png', '/fonts.css'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.headers.has('authorization') || url.pathname.startsWith('/auth/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(async (response) => {
      const contentType = response.headers.get('Content-Type') || '';
      if (response.ok && response.type === 'basic' && contentType.includes('text/html')) {
        const copy = response.clone();
        const cache = await caches.open(CACHE);
        await cache.put('/', copy);
      }
      return response;
    }).catch(() => caches.match('/')));
    return;
  }

  if (!['script', 'style', 'font', 'image', 'manifest'].includes(request.destination)) return;
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
    if (!response.ok || response.type !== 'basic') return response;
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(request, copy));
    return response;
  })));
});
