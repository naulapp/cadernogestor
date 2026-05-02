const CACHE_NAME = 'cadernogestor-static-v20260502a';
const STATIC_EXTENSIONS = [
  '.css', '.js', '.mjs', '.png', '.jpg', '.jpeg', '.webp', '.svg',
  '.gif', '.ico', '.woff', '.woff2', '.ttf', '.eot'
];

function isStaticAsset(requestUrl) {
  try {
    const url = new URL(requestUrl);
    return STATIC_EXTENSIONS.some(ext => url.pathname.toLowerCase().endsWith(ext));
  } catch {
    return false;
  }
}

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  if (!isStaticAsset(event.request.url)) {
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200) return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      });
    })
  );
});
