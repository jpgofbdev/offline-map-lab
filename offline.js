const CACHE_NAME = "offline-map-lab-v1";

async function loadRegions() {
  const res = await fetch("./regions.json");
  const data = await res.json();
  return data.regions;
}

async function isCached(url) {
  const cache = await caches.open(CACHE_NAME);
  const match = await cache.match(url);
  return !!match;
}
async function downloadRegion(url, onProgress) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Téléchargement impossible: " + res.status);

  const total = Number(res.headers.get("content-length")) || 0;

  // Si pas de streaming possible, fallback (rare sur Chrome Android mais on gère)
  if (!res.body || !window.ReadableStream) {
    const blob = await res.blob();
    const cache = await caches.open(CACHE_NAME);
    await cache.put(url, new Response(blob, { headers: res.headers }));
    if (onProgress) onProgress(blob.size, blob.size, true);
    return;
  }

  const reader = res.body.getReader();
  const chunks = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    if (onProgress) onProgress(received, total, false);
  }

  const blob = new Blob(chunks, {
    type: res.headers.get("content-type") || "application/octet-stream"
  });

  const cache = await caches.open(CACHE_NAME);
  await cache.put(url, new Response(blob, { headers: res.headers }));

  if (onProgress) onProgress(received, total, true);
}


async function deleteRegion(url) {
  const cache = await caches.open(CACHE_NAME);
  await cache.delete(url);
}

async function updateBadge(currentUrl) {
  const has = await isCached(currentUrl);
  const online = navigator.onLine;

  const statusNet = online ? "En ligne" : "Hors-ligne";
  const statusOffline = has ? "prêt" : "indisponible";

  const btn = document.getElementById("net-badge");

  btn.textContent = `${statusNet} · Hors-connexion : ${statusOffline}`;

  btn.title = has
    ? "Le fond de plan est disponible hors connexion.\nAppuyer pour gérer."
    : "Le fond de plan n'est pas encore téléchargé.\nAppuyer pour gérer.";

  btn.setAttribute("aria-label", btn.title);

btn.style.backgroundColor = has ? "#e8f5e9" : "#fff3e0";
btn.style.borderColor = has ? "#c8e6c9" : "#ffe0b2";

  
}



async function renderDrawer(currentUrl) {
  const regions = await loadRegions();
  const container = document.getElementById("drawer-content");
  container.innerHTML = "";

  for (const r of regions) {
    const div = document.createElement("div");
    div.style.marginBottom = "10px";

    const has = await isCached(r.pmtiles_url);

div.innerHTML = `
  <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
    <div>
      <div><strong>${r.label}</strong> (${r.size_mb} Mo)</div>
      <div id="status-${r.code}" class="progress-text">${has ? "Déjà téléchargé" : "Non téléchargé"}</div>
      <div id="progwrap-${r.code}" style="display:none;">
        <div class="progress"><div id="prog-${r.code}"></div></div>
        <div id="progtext-${r.code}" class="progress-text">0%</div>
      </div>
    </div>
    <div>
      <button id="btn-${r.code}" class="btn">${has ? "Supprimer" : "Télécharger"}</button>
    </div>
  </div>
`;


    div.querySelector("button").onclick = async () => {
      if (has) {
        await deleteRegion(r.pmtiles_url);
      } else {
        await downloadRegion(r.pmtiles_url);
      }
      renderDrawer(currentUrl);
      updateBadge(currentUrl);
    };

    container.appendChild(div);
  }
}

function initUI() {
  const pm = new URLSearchParams(window.location.search).get("pm");
  const currentUrl = pm.includes("://")
    ? pm
    : `https://tiles.jpg-cvl-dev.fr/tiles/${pm}`;

  updateBadge(currentUrl);

  document.getElementById("net-badge").onclick = () => {
    document.getElementById("offline-drawer").classList.remove("hidden");
    renderDrawer(currentUrl);
  };

  document.getElementById("drawer-close").onclick = () => {
    document.getElementById("offline-drawer").classList.add("hidden");
  };

  window.addEventListener("online", () => updateBadge(currentUrl));
  window.addEventListener("offline", () => updateBadge(currentUrl));
}

window.addEventListener("DOMContentLoaded", initUI);
