const CACHE_NAME = 'sistema-static-v41-mobile-trial-sync';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  // For HTML document navigations, force the browser to check the server for updates
  // (cache: 'reload' bypasses Safari/PWA HTTP cache more reliably).
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request, { cache: 'reload' }).catch(async () => {
        return await caches.match(event.request) || await caches.match('/') || Response.error();
      })
    );
    return;
  }

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    return;
  }
  if (/\.(?:js|css)$/i.test(url.pathname)) {
    event.respondWith(
      fetch(event.request, { cache: 'reload' }).catch(async () => {
        return await caches.match(event.request) || Response.error();
      })
    );
    return;
  }

  event.respondWith(
    fetch(event.request).catch(async () => {
      // In case of network failure (offline), try to serve from cache if available
      return await caches.match(event.request) || Response.error();
    })
  );
});

// Listen for Web Push events from the server
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (err) {
      data = {
        title: 'Новое сообщение',
        body: event.data.text()
      };
    }
  }

  const title = data.title || 'Новое сообщение';
  const options = {
    body: data.body || 'Вы получили новое сообщение в чате.',
    icon: data.icon || '/assets/logo2.png',
    badge: data.badge || '/assets/logo2.png',
    tag: data.tag || 'chat-general-notification',
    data: {
      url: data.url || '/chat/'
    },
    vibrate: [100, 50, 100]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Handle notification click to focus or open chat page
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/chat/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // If chat page is already open, focus it
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i];
          const clientUrl = new URL(client.url).pathname;
          if (clientUrl.includes('/chat/') && 'focus' in client) {
            return client.focus();
          }
        }
        // Otherwise open a new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen);
        }
      })
  );
});
