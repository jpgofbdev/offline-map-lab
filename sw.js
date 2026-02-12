// sw.js — Offline Map Lab (Android Chrome)
// 1) Met l'app "shell" en cache (index.html, css, js, libs locales)
// 2) Sert les PMTiles depuis le cache si téléchargés (même online)
// 3) Supporte les requêtes Range (206) pour PMTiles via Blob.slice()

const SHELL_CACHE = "oml-shell-v1";
const PMTILES_CACHE = "offline-map-lab-v1"; // IMPORTANT: même nom que dans offline.js

// Fichiers à rendre dispo OFFLINE au redémarrage (app shell)
const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./offline.js",
  "./regions.json",
  "./maplibre-gl.js",
  "./maplibre-gl.css",
  "./pmtiles.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await cache.addAll(SHELL_ASSETS);
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // A) Navigation (ouvrir/recharger la page)
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL_CACHE);

      try {
        // Online: on sert le réseau et on met à jour l'index en cache
        const net = await fetch(req);
        cache.put("./index.html", net.clone());
        return net;
      } catch {
        // Offline: on sert l'index depuis le cache
        const cached = await cache.match("./index.html");
        return cached || new Response("Offline", { status: 503 });
      }
    })());
    return;
  }

  // B) PMTiles : local prioritaire + Range (206)
  if (url.pathname.endsWith(".pmtiles")) {
    event.respondWith(handlePmtiles(req));
    return;
  }

  // C) Assets same-origin (css/js/json locaux) : cache-first
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
        // hors-ligne et pas en cache
        return new Response("Offline asset missing", { status: 503 });
      }
    })());
    return;
  }

  // D) Le reste (ex: glyphs externes) : réseau (ou cache navigateur)
  // (On ne le gère pas ici pour rester simple et éviter des comportements opaques)
});

async function handlePmtiles(request) {
  const cache = await caches.open(PMTILES_CACHE);
  const cachedFull = await cache.match(request.url, { ignoreVary: true });

  // Si téléchargé => toujours local (même online)
  if (cachedFull) {
    const range = request.headers.get("Range");
    if (range) return serveRangeFromCachedBlob(cachedFull, range);
    return cachedFull;
  }

  // Sinon => réseau
  return fetch(request);
}

async function serveRangeFromCachedBlob(fullResponse, rangeHeader) {
  // Range: "bytes=start-end"
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

  // Blob.slice => évite de charger tout le fichier en RAM
  const sliced = blob.slice(start, end + 1);

  const headers = new Headers(fullResponse.headers);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Content-Range", `bytes ${start}-${end}/${total}`);
  headers.set("Content-Length", String(sliced.size));
  if (!headers.get("Content-Type")) headers.set("Content-Type", "application/octet-stream");

  return new Response(sliced, {
    status: 206,
    statusText: "Partial Content",
    headers
  });
}
