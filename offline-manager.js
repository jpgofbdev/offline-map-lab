// offline-manager.js
export async function swReady() {
  if (!("serviceWorker" in navigator)) throw new Error("No serviceWorker support");
  const reg = await navigator.serviceWorker.ready;
  return reg;
}

export async function cacheRegionPmtiles(pmtilesUrl) {
  const reg = await swReady();
  reg.active?.postMessage({ type: "CACHE_PM", url: pmtilesUrl });
}

export async function uncacheRegionPmtiles(pmtilesUrl) {
  const reg = await swReady();
  reg.active?.postMessage({ type: "UNCACHE_PM", url: pmtilesUrl });
}

export async function hasRegionPmtiles(pmtilesUrl, timeoutMs = 1500) {
  const reg = await swReady();

  return new Promise((resolve) => {
    const t = setTimeout(() => {
      cleanup();
      resolve(false);
    }, timeoutMs);

    function onMsg(ev) {
      const d = ev.data || {};
      if (d.type === "HAS_PM_REPLY" && d.url === pmtilesUrl) {
        cleanup();
        resolve(!!d.has);
      }
    }

    function cleanup() {
      clearTimeout(t);
      navigator.serviceWorker.removeEventListener("message", onMsg);
    }

    navigator.serviceWorker.addEventListener("message", onMsg);
    reg.active?.postMessage({ type: "HAS_PM", url: pmtilesUrl });
  });
}
