// PadelAdmin service worker: keeps the app itself on the phone so it opens without a connection.
// Data is not cached here – the app remembers its own data (localStorage) and queues results (lib/outbox).
//
// - Pages: network first (always the newest app when online), the saved index.html when offline.
// - /assets/* (hashed, never change): cache first. Old builds' assets are pruned when a new index.html arrives.
// - /api/* and other origins: never touched.
//
// Emergency off switch: deploy this file as `self.registration.unregister()` + clearing caches (see KILL below),
// or set KILL = true – every phone drops the worker on its next visit.
const KILL = false;
const CACHE = 'padeladmin-app-v1';
const SHELL = ['/', '/manifest.webmanifest', '/icon.svg', '/icon-180.png', '/icon-192.png', '/icon-512.png'];

const assetsIn = (html) => [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);

async function saveShell() {
  const cache = await caches.open(CACHE);
  const res = await fetch('/', { cache: 'no-store' });
  if (!res.ok) return;
  const html = await res.clone().text();
  await cache.put('/', res);
  const keep = new Set(assetsIn(html));
  // Only fetch what is not saved yet (assets are immutable; icons rarely change).
  const missing = async (a) => !(await cache.match(a));
  for (const a of [...keep, ...SHELL.slice(1)]) if (await missing(a)) await cache.add(a).catch(() => {});
  // Prune assets from older builds.
  for (const req of await cache.keys()) {
    const path = new URL(req.url).pathname;
    if (path.startsWith('/assets/') && !keep.has(path)) await cache.delete(req);
  }
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  if (!KILL) event.waitUntil(saveShell().catch(() => {}));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => KILL || n !== CACHE).map((n) => caches.delete(n)));
      if (KILL) {
        await self.registration.unregister();
        return;
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  if (KILL) return;
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/_vercel/')) return;

  if (req.mode === 'navigate') {
    // Newest app when online; the saved one when not. Every successful load refreshes the saved copy.
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) event.waitUntil(saveShell().catch(() => {}));
          return res;
        })
        .catch(async () => (await caches.match('/')) || Response.error()),
    );
    return;
  }

  if (url.pathname.startsWith('/assets/') || SHELL.includes(url.pathname)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok && url.pathname.startsWith('/assets/')) {
              const copy = res.clone();
              event.waitUntil(caches.open(CACHE).then((c) => c.put(req, copy)));
            }
            return res;
          }),
      ),
    );
  }
});
