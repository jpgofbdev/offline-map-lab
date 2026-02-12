const CACHE_NAME = "offline-map-lab-v1";

self.addEventListener("fetch", event => {
  const url = event.request.url;

  if (!url.endsWith(".pmtiles")) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(url);

    if (cached) {
      return cached;
    }

    return fetch(event.request);
  })());
});
