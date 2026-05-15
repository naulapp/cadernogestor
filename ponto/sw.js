const CACHE = 'cg-ponto-v4';
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      c.addAll(['./', './index.html', './app.js', './manifest.json']).catch(() => {})
    )
  );
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  const u = e.request.url;
  if (u.includes('/api/')) {
    e.respondWith(fetch(e.request).catch(() => new Response(JSON.stringify({ ok: false, error: 'offline' }), { status: 503 })));
    return;
  }
  e.respondWith(
    caches.match(e.request).then((r) => r || fetch(e.request).catch(() => caches.match('./index.html')))
  );
});
