// Serialized by prepare-offline.mjs. Keep this function self-contained.
export function offlineWorker(version, files) {
  const base = new URL('./', self.location.href);
  const prefix = `chess-lab:${base.pathname}:`;
  const name = prefix + version;
  const urls = files.map(file => new URL(file, base).href);
  const known = new Set(urls);

  self.addEventListener('install', event => {
    event.waitUntil((async () => {
      const cache = await caches.open(name);
      // A partial download must never replace a working offline version.
      await cache.addAll(urls.map(url => new Request(url, { cache: 'no-cache' })));
    })());
  });

  self.addEventListener('activate', event => {
    event.waitUntil((async () => {
      const names = await caches.keys();
      await Promise.all(names.filter(key => key.startsWith(prefix) && key !== name).map(key => caches.delete(key)));
      await self.clients.claim();
    })());
  });

  self.addEventListener('message', event => {
    // Only a user's update button activates a waiting version during a game.
    if (event.data?.type === 'ACTIVATE_UPDATE') event.waitUntil(self.skipWaiting());
  });

  self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;
    const url = new URL(event.request.url);
    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) return;
    url.search = '';
    url.hash = '';
    if (url.pathname === base.pathname) url.pathname += 'index.html';
    if (!known.has(url.href)) return;
    event.respondWith((async () => {
      const cache = await caches.open(name);
      return await cache.match(url.href) || fetch(event.request);
    })());
  });
}
