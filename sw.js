'use strict';
// Change VERSION whenever any cached file changes. Updates activate after all app tabs close.
const VERSION = 'v7';
const BASE = self.registration.scope;
const PREFIX = `sleep-graph-${BASE}-`;
const CACHE = `${PREFIX}${VERSION}`;
const FILES = [
  'index.html', 'style.css',
  'model.js', 'app.js', 'pwa.js', 'manifest.webmanifest',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
  'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png'
];
const ASSETS = FILES.map(file => new URL(file, BASE).href);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(
    ASSETS.map(url => new Request(url, { cache: 'reload' }))
  )));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const home = new URL('index.html', BASE);
  const isHome = event.request.mode === 'navigate' &&
    url.origin === home.origin && [new URL(BASE).pathname, home.pathname].includes(url.pathname);
  if (!isHome && !ASSETS.includes(url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(isHome ? home.href : event.request);
    return cached || fetch(event.request);
  })());
});
