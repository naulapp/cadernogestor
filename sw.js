const CACHE_NAME = 'cadernogestor-v1777310081';

self.addEventListener('install', e => {
  self.skipWaiting(); // Ativa imediatamente sem esperar
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => {
        console.log('[SW] Removendo cache antigo:', k);
        return caches.delete(k);
      }))
    )
  );
  self.clients.claim(); // Assume controle de todas as abas imediatamente
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // Para o index.html, SEMPRE buscar da rede (nunca cache)
  if (e.request.url.includes('index.html') || e.request.url.endsWith('/')) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }
  // Para outros assets, cache dinâmico normal
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        if (!response || response.status !== 200) return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        return response;
      }).catch(() => cached);
    })
  );
});
