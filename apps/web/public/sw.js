/* Etholys offline shell. Caches visited pages and static assets. API traffic is handled in the page. */
const CACHE = 'etholys-offline-v1';

const OFFLINE_HTML = `<!doctype html>
<html lang="es">
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Etholys</title>
<body style="margin:0;font-family:system-ui,sans-serif;background:#0f172a;color:#f8fafc;display:grid;min-height:100vh;place-items:center">
  <main style="max-width:28rem;padding:1.5rem;text-align:center">
    <h1 style="font-size:1.25rem;margin:0 0 .75rem">Etholys</h1>
    <p style="margin:0;line-height:1.5;color:#cbd5e1">Esta pantalla todavía no se abrió en este aparato con red. Ábrela una vez en línea y vuelve a quedar disponible sin conexión.</p>
  </main>
</body>
</html>`;

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith('etholys-offline') && k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

function isStatic(pathname) {
  return pathname.startsWith('/_next/static/') || pathname.startsWith('/fonts/') || /\.(?:svg|png|jpg|jpeg|webp|ico|woff2?)$/.test(pathname);
}

function isNavigation(request) {
  return request.mode === 'navigate' || request.headers.get('RSC') === '1' || request.headers.get('Next-Router-Prefetch') === '1';
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  const fresh = fetch(request)
    .then((res) => {
      if (res.ok) void cache.put(request, res.clone());
      return res;
    })
    .catch(() => null);
  if (hit) return hit;
  const res = await fresh;
  if (res) return res;
  return new Response('', { status: 503 });
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(request);
    if (res.ok && request.method === 'GET') await cache.put(request, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(request);
    if (hit) return hit;
    if (request.mode === 'navigate') {
      return new Response(OFFLINE_HTML, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;
  if (url.pathname.includes('webpack-hmr') || url.pathname.includes('hot-update')) return;

  if (isStatic(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }
  if (isNavigation(request)) {
    event.respondWith(networkFirst(request));
  }
});

/* --- Web Push (browser notifications) --- */
self.addEventListener('push', (event) => {
  let data = { title: 'Etholys', body: '', url: '/hub', tag: 'etholys' };
  try {
    if (event.data) {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    }
  } catch {
    try {
      data.body = event.data ? event.data.text() : '';
    } catch {
      /* ignore */
    }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Etholys', {
      body: data.body || '',
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      tag: data.tag || 'etholys',
      data: { url: data.url || '/hub' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/hub';
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of all) {
        if ('focus' in client) {
          await client.focus();
          if ('navigate' in client) {
            try {
              await client.navigate(target);
              return;
            } catch {
              /* fall through */
            }
          }
          return;
        }
      }
      if (self.clients.openWindow) await self.clients.openWindow(target);
    })(),
  );
});

