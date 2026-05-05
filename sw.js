const CACHE_NAME = 'sistema-static-v10';
const SAME_ORIGIN_TYPES = new Set(['document', 'style', 'script', 'image', 'font', 'manifest']);

function shouldCache(request) {
  if (request.method !== 'GET') return false;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith('/api/')) return false;
  if (url.pathname.startsWith('/video/')) return false;

  return SAME_ORIGIN_TYPES.has(request.destination) ||
    request.mode === 'navigate' ||
    /\.(?:html|css|js|json|png|jpg|jpeg|webp|svg|woff2?)$/i.test(url.pathname);
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);

  return cached || networkPromise;
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll([
      '/',
      '/css/style.css?v=12',
      '/css/nav.css?v=38',
      '/js/config.js',
      '/js/api.js?v=26',
      '/js/auth.js?v=9',
      '/js/nav.js?v=44',
      '/assets/webp/logo2.webp',
      '/assets/webp/logo2-Photoroom.webp',
      '/manifest.json',
    ]).catch(() => {}))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (!shouldCache(event.request)) return;
  event.respondWith(staleWhileRevalidate(event.request));
});
