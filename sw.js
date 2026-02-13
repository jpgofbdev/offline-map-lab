/* ============================================================
   Offline Map Lab – Service Worker
   - Cache shell (HTML, JS, CSS, JSON, libs)
   - Cache PMTiles par région
   - Support Range 206 offline
   ============================================================ */

const SHELL_CACHE = "oml-shell-v2";
const PMTILES_CACHE = "offline-map-lab-v1";

// Base path (important pour GitHub Pages sous /offline-map-lab/)
const BASE = self.location.pathname.replace(/sw\.js$/, "");

// Fichiers nécessaires au redémarrage offline
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
    self.skipWaiting();
  })());
});

/* ================= ACTIVATE ================= */

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    await self.clients.claim();
  })());
});

/* ================= FETCH ================= */

self.addEventListener("fetch", event => {
  const req = event.request;
  const url = new URL(req.url);

  // 1️⃣ Navigation → cache-first
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL_CACHE);

      try {
        const net = await fetch(req);
        cache.put(BASE + "index.html", net.clone());
        return net;
      } catch {
        const cached = await cache.match(BASE + "index.html");
        return cached || new Response("Offline", { status: 503 });
      }
    })());
    return;
  }

  // 2️⃣ PMTiles (même domaine externe)
  if (url.pathname.endsWith(".pmtiles")) {
    event.respondWith(handlePmtiles(req));
    return;
  }

  // 3️⃣ Fichiers same-origin → cache-first
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

  // 4️⃣ Sinon → réseau normal
});

/* ================= PMTILES HANDLER ================= */

async function handlePmtiles(request) {
  const cache = await caches.open(PMTILES_CACHE);
  const cachedFull = await cache.match(request.url, { ignoreVary: true });

  // Si déjà téléchargé → toujours local
  if (cachedFull) {
    const range = request.headers.get("Range");
    if (range) return serveRangeFromCachedBlob(cachedFull, range);
    return cachedFull;
  }

  // Sinon réseau
  return fetch(request);
}

/* ================= RANGE 206 SUPPORT ================= */

async function serveRangeFromCachedBlob(fullResponse, rangeHeader) {
  const m = /^bytes=(\d+)-(\d*)$/i.exec(rangeHeader.trim());
  const blob = await fullResponse.blob();
  const total = blob.size;

  if (!m) return fullResponse;

  const start = parseInt(m[1], 10);
  const endStr = m[2];
  let end = endStr ? parseInt(endStr, 10) : (total - 1);

  if (isNaN(start) || start >= total) {
    return new Response(null, {
      status: 416,
      statusText: "Range Not Satisfiable",
      headers: { "Content-Range": `bytes */${total}` }
    });
  }

  if (isNaN(end) || end >= total) end = total - 1;
  if (end < start) end = start;

  const sliced = blob.slice(start, end + 1);

  const headers = new Headers(fullResponse.headers);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Content-Range", `bytes ${start}-${end}/${total}`);
  headers.set("Content-Length", String(sliced.size));
  if (!headers.get("Content-Type")) {
    headers.set("Content-Type", "application/octet-stream");
  }

  return new Response(sliced, {
    status: 206,
    statusText: "Partial Content",
    headers
  });
}
