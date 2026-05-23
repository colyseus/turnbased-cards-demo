const CACHE_NAME = 'card-game-shell-v2';
const ASSETS = [
  '/',
  '/index.html',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const isShellRequest = url.origin === self.location.origin && ASSETS.includes(url.pathname);
  const isFreshAsset =
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.includes('/cards/');

  if (isFreshAsset) {
    event.respondWith(fetch(event.request));
    return;
  }

  if (isShellRequest) {
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
  }
});
