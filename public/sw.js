/* Workout Tracker service worker — offline-first app shell.
 * Data lives in localStorage, so we only need to cache the static shell.
 * Scope-aware: registered from BASE_URL/sw.js, so the base path (e.g.
 * "/overload/" on GitHub Pages) is derived from the registration scope —
 * cache keys and the shell list are always under that base. */
const CACHE = 'workout-tracker-v1';

self.addEventListener('install', (event) => {
  const scope = self.registration.scope; // ends with "/" → e.g. "/overload/"
  const shell = [
    `${scope}index.html`,
    `${scope}manifest.webmanifest`,
    `${scope}icon-192.png`,
    `${scope}icon-512.png`,
  ];
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(shell))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const scope = self.registration.scope;

  // Navigations: network-first so new deploys take effect, falling back to cache offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(`${scope}index.html`, copy));
          return response;
        })
        .catch(() => caches.match(`${scope}index.html`)),
    );
    return;
  }

  // Static assets (hashed by Vite): cache-first.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return response;
        }),
    ),
  );
});