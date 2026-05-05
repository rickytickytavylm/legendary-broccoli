const CACHE_NAME = 'sistema-static-v16';
const SAME_ORIGIN_TYPES = new Set(['document', 'style', 'script', 'image', 'font', 'manifest']);

function shouldCache(request) {
  if (request.method !== 'GET') return false;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith('/api/')) return false;
  if (url.pathname.startsWith('/video/')) return false;

  return SAME_ORIGIN_TYPES.has(request.destination) ||
    request.mode === 'navigate' ||
    /\.(?:html|css|js|json|png|jpg|jpeg|webp|svg|woff2?|ico)$/i.test(url.pathname);
}

function offlineFallback() {
  return new Response('', { status: 503, statusText: 'Service Unavailable' });
}

async function staleWhileRevalidate(request) {
  let cache;
  try {
    cache = await caches.open(CACHE_NAME);
  } catch (e) {
    try { return await fetch(request); } catch (err) { return offlineFallback(); }
  }

  const cached = await cache.match(request).catch(() => null);

  const networkFetch = fetch(request).then((response) => {
    if (response && response.ok && response.type === 'basic') {
      try { cache.put(request, response.clone()); } catch (e) {}
    }
    return response;
  });

  if (cached) {
    networkFetch.catch(() => {});
    return cached;
  }

  try {
    const fresh = await networkFetch;
    return fresh || offlineFallback();
  } catch (e) {
    return offlineFallback();
  }
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
    } catch (e) {}
    try { await self.clients.claim(); } catch (e) {}
  })());
});

self.addEventListener('fetch', (event) => {
  if (!shouldCache(event.request)) return;

  event.respondWith(
    staleWhileRevalidate(event.request)
      .catch(() => fetch(event.request).catch(() => offlineFallback()))
  );
});
