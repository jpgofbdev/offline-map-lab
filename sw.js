/* sw.js — Offline Map Lab
   - Cache PMTiles entier par URL
   - Répond aux requêtes Range (206) depuis le fichier complet en cache
   - Si non téléchargé => réseau
*/

const CACHE_NAME = "offline-map-lab-pmtiles-v1";

// --- Installation / activation ---
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// --- Messages depuis la page (download / delete) ---
self.addEventListener("message", (event) => {
  const msg = event.data || {};
  if (msg.type === "CACHE_PM") {
    event.waitUntil(cachePmtilesUrl(msg.url));
  } else if (msg.type === "UNCACHE_PM") {
    event.waitUntil(uncachePmtilesUrl(msg.url));
  } else if (msg.type === "HAS_PM") {
    event.waitUntil(replyHasPm(event, msg.url));
  }
});

async function cachePmtilesUrl(url) {
  if (!url) return;
  const cache = await caches.open(CACHE_NAME);

  // On force une requête SANS Range pour obtenir le fichier complet (200)
  const req = new Request(url, { mode: "cors", cache: "no-store" });
  const res = await fetch(req);

  if (!res.ok) throw new Error(`PMTiles fetch failed (${res.status})`);

  // Stocke la réponse complète (attention: gros fichier => peut prendre du temps)
  await cache.put(url, res);
}

async function uncachePmtilesUrl(url) {
  if (!url) return;
  const cache = await caches.open(CACHE_NAME);
  await cache.delete(url);
}

async function replyHasPm(event, url) {
  const cache = await caches.open(CACHE_NAME);
  const match = await cache.match(url, { ignoreVary: true });
  event.source?.postMessage({ type: "HAS_PM_REPLY", url, has: !!match });
}

// --- Interception fetch : pmtiles uniquement ---
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // On ne gère que les .pmtiles
  if (!url.pathname.endsWith(".pmtiles")) return;

  event.respondWith(handlePmtilesRequest(req));
});

async function handlePmtilesRequest(request) {
  const cache = await caches.open(CACHE_NAME);

  // Si le fichier complet est en cache, on sert LOCAL quoi qu’il arrive.
  const cachedFull = await cache.match(request.url, { ignoreVary: true });
  if (cachedFull) {
    const range = request.headers.get("Range");
    if (range) {
      return serveRangeFromCachedResponse(cachedFull, range);
    }
    // Requête sans Range : on renvoie le fichier complet
    return cachedFull;
  }

  // Sinon, pas téléchargé => réseau (comportement normal)
  return fetch(request);
}

// --- Range support (206) depuis la réponse complète cachée ---
async function serveRangeFromCachedResponse(fullResponse, rangeHeader) {
  // Format attendu : "bytes=start-end"
  const m = /^bytes=(\d+)-(\d*)$/i.exec(rangeHeader.trim());
  if (!m) {
    // Range mal formé => renvoie le complet (ou 416)
    return fullResponse;
  }

  const start = parseInt(m[1], 10);
  const endStr = m[2];
  const fullBuf = await fullResponse.arrayBuffer();
  const total = fullBuf.byteLength;

  let end = endStr ? parseInt(endStr, 10) : (total - 1);
  if (isNaN(start) || isNaN(end) || start >= total) {
    return new Response(null, {
      status: 416,
      statusText: "Range Not Satisfiable",
      headers: {
        "Content-Range": `bytes */${total}`
      }
    });
  }
  if (end >= total) end = total - 1;
  if (end < start) end = start;

  const sliced = fullBuf.slice(start, end + 1);

  const headers = new Headers(fullResponse.headers);
  headers.set("Content-Length", String(sliced.byteLength));
  headers.set("Content-Range", `bytes ${start}-${end}/${total}`);
  headers.set("Accept-Ranges", "bytes");

  // Le Content-Type doit rester cohérent (souvent application/octet-stream)
  if (!headers.get("Content-Type")) {
    headers.set("Content-Type", "application/octet-stream");
  }

  return new Response(sliced, {
    status: 206,
    statusText: "Partial Content",
    headers
  });
}
