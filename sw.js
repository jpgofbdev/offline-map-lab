const CACHE_NAME = "offline-map-lab-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // On ne gère que les PMTiles
  if (!url.pathname.endsWith(".pmtiles")) return;

  event.respondWith(handlePmtiles(req));
});

async function handlePmtiles(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedFull = await cache.match(request.url, { ignoreVary: true });

  // Si le fichier est en cache => toujours local (même online)
  if (cachedFull) {
    const range = request.headers.get("Range");
    if (range) {
      return serveRangeFromCachedBlob(cachedFull, range);
    }
    return cachedFull;
  }

  // Sinon => réseau
  return fetch(request);
}

async function serveRangeFromCachedBlob(fullResponse, rangeHeader) {
  // Range attendu: "bytes=start-end"
  const m = /^bytes=(\d+)-(\d*)$/i.exec(rangeHeader.trim());
  const blob = await fullResponse.blob();
  const total = blob.size;

  if (!m) {
    // Range mal formé : on renvoie le complet
    return fullResponse;
  }

  const start = parseInt(m[1], 10);
  const endStr = m[2];
  let end = endStr ? parseInt(endStr, 10) : (total - 1);

  if (isNaN(start) || start >= total) {
    return new Response(null, {
      status: 416,
      statusText: "Range Not Satisfiable",
      headers: {
        "Content-Range": `bytes */${total}`
      }
    });
  }

  if (isNaN(end) || end >= total) end = total - 1;
  if (end < start) end = start;

  // IMPORTANT : Blob.slice évite de charger tout le fichier en mémoire
  const sliced = blob.slice(start, end + 1);

  const headers = new Headers(fullResponse.headers);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Content-Range", `bytes ${start}-${end}/${total}`);
  headers.set("Content-Length", String(sliced.size));

  // Conserver un content-type cohérent
  if (!headers.get("Content-Type")) {
    headers.set("Content-Type", "application/octet-stream");
  }

  return new Response(sliced, {
    status: 206,
    statusText: "Partial Content",
    headers
  });
}
