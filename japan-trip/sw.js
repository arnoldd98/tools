// Service worker: open fast from the phone, update in the background.
//
// The app shell is cached as ONE versioned set and served cache-first, so the app
// opens instantly on any signal and old/new files are never mixed. A new deploy is
// picked up when the browser re-checks this file (every online open); the new worker
// installs the whole new set, then WAITS until the page asks it to take over
// ("Updated, tap to reload") or every tab is closed.
//
// BUMP VERSION whenever any file in SHELL changes, or phones keep the old version.
// Also update the matching ?v= tags in index.html, app.js and views.js (npm test checks).
const VERSION = '12';
const SHELL_CACHE = `jt-shell-${VERSION}`;
const DATA_CACHE = 'jt-data';
const SHELL = [
  './', 'index.html', 'app.js', 'lib.js', 'views.js', 'style.css', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const shell = await caches.open(SHELL_CACHE);
    // cache: 'reload' bypasses the HTTP cache so a new set never contains stale files
    await shell.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })));
    try {
      const res = await fetch('data/trip.json', { cache: 'no-store' });
      if (res.ok) await (await caches.open(DATA_CACHE)).put('data/trip.json', res);
    } catch { /* offline during install: fine, the page keeps its own copy */ }
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key !== SHELL_CACHE && key !== DATA_CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

async function dataNetworkFirst(request) {
  const cache = await caches.open(DATA_CACHE);
  try {
    const res = await fetch(request, { cache: 'no-store' });
    if (res.ok) await cache.put(request.url, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(request.url, { ignoreSearch: true })
      || await cache.match('data/trip.json');
    if (hit) return hit;
    throw err;
  }
}

async function shellFirst(request, key) {
  const cache = await caches.open(SHELL_CACHE);
  const hit = await cache.match(key || request, { ignoreSearch: true });
  return hit || fetch(request);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // GitHub API, rate API, maps: untouched
  if (url.pathname.endsWith('/data/trip.json')) {
    event.respondWith(dataNetworkFirst(request));
  } else if (request.mode === 'navigate') {
    event.respondWith(shellFirst(request, 'index.html'));
  } else {
    event.respondWith(shellFirst(request));
  }
});
