/* ============================================================
   Offline Map Lab – Service Worker (Stable V3)
   ============================================================ */

const SHELL_CACHE = "oml-shell-v4";
const PMTILES_CACHE = "offline-map-lab-v1";

const BASE = self.location.pathname.replace(/sw\.js$/, "");

const SHELL_ASSETS = [
  BASE,
  BASE + "index.html",
  BASE + "style.css",
  BASE + "offline.js",
  BASE + "regions.json",
  BASE + "style.json",
  BASE + "maplibre-gl.js",
  BASE + "maplibre-gl.css",
  BASE + "pmtiles.js"
];

/* ================= INSTALL ================= */

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await cache.addAll(SHELL_ASSETS);
    await self.skipWaiting();
  })());
});

/* ================= ACTIVATE ================= */

self.addEventListener("activate", event => {
  event.waitUntil((async () => {

    const keys = await caches.keys();

    await Promise.all(
      keys.map(key => {
        if (
          key !== SHELL_CACHE &&
          key !== PMTILES_CACHE
        ) {
          console.log("Suppression ancien cache:", key);
          return caches.delete(key);
        }
      })
    );

    await self.clients.claim();
  })());
});


/* ================= FETCH ================= */

self.addEventListener("fetch", event => {
  const req = event.request;
  const url = new URL(req.url);

  // Navigation → cache-first
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL_CACHE);
      try {
        const net = await fetch(req);
        cache.put(BASE + "index.html", net.clone());
        return net;
      } catch {
        return await cache.match(BASE + "index.html");
      }
    })());
    return;
  }

  // PMTiles (même domaine externe)
  if (url.pathname.endsWith(".pmtiles")) {
    event.respondWith(handlePmtiles(req));
    return;
  }

  // Same-origin → cache-first
  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL_CACHE);
      const cached = await cache.match(req, { ignoreSearch: true });
      if (cached) return cached;

      try {
        const net = await fetch(req);
        cache.put(req, net.clone());
        return net;
      } catch {
        return new Response("Offline asset missing", { status: 503 });
      }
    })());
    return;
  }
});

/* ================= PMTILES ================= */

async function handlePmtiles(request) {
  const cache = await caches.open(PMTILES_CACHE);
  const cachedFull = await cache.match(request.url, { ignoreVary: true });

  if (cachedFull) {
    const range = request.headers.get("Range");
    if (range) return serveRangeFromCachedBlob(cachedFull, range);
    return cachedFull;
  }

  return fetch(request);
}

/* ================= RANGE SUPPORT ================= */

async function serveRangeFromCachedBlob(fullResponse, rangeHeader) {
  const m = /^bytes=(\d+)-(\d*)$/i.exec(rangeHeader.trim());
  const blob = await fullResponse.blob();
  const total = blob.size;

  if (!m) return fullResponse;

  const start = parseInt(m[1], 10);
  let end = m[2] ? parseInt(m[2], 10) : total - 1;

  if (isNaN(start) || start >= total) {
    return new Response(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${total}` }
    });
  }

  if (isNaN(end) || end >= total) end = total - 1;
  if (end < start) end = start;

  const sliced = blob.slice(start, end + 1);

  return new Response(sliced, {
    status: 206,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": sliced.size,
      "Content-Range": `bytes ${start}-${end}/${total}`,
      "Accept-Ranges": "bytes"
    }
  });
}
