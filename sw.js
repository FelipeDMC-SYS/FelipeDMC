// Relative paths support both a domain root and a GitHub Pages repository path.
const BASE = new URL('./', self.location.href);
const PREFIX = `colindantes:${BASE.pathname}:`;
const CACHE = PREFIX + 'v1-github';
const SHELL = [
  './', 'index.html', 'coordenadas.html', 'style.css', 'polish.css',
  'app.mjs', 'parser.mjs', 'coordinate-app.mjs', 'coordinates.mjs',
  'imaging.mjs', 'pwa.mjs', 'manifest.webmanifest',
  'assets/felipedmc-logo.png', 'assets/icon.svg', 'assets/icon-192.png',
  'assets/icon-512.png', 'assets/icon-maskable-512.png',
  'assets/apple-touch-icon.png', 'assets/ejemplo.png',
  'assets/coordenadas-ejemplo.png'
].map(path => new URL(path, BASE).href);
const SHELL_PATHS = new Set(SHELL.map(path => new URL(path).pathname));
const ASSETS_PATH = new URL('assets/', BASE).pathname;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.allSettled(SHELL.map(async path => {
      const response = await fetch(path);
      if (response.ok && !response.redirected) await cache.put(path, response);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      // Keep caches from other repositories on the same github.io domain.
      if (key.startsWith(PREFIX) && key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== BASE.origin) return;
  if (!SHELL_PATHS.has(url.pathname) && !url.pathname.startsWith(ASSETS_PATH)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(event.request);
      if (response.ok && !response.redirected) await cache.put(event.request, response.clone());
      return response;
    } catch (error) {
      const cached = await cache.match(event.request);
      if (cached) return cached;
      throw error;
    }
  })());
});
