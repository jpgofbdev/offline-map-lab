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

async function downloadRegion(url) {
  const cache = await caches.open(CACHE_NAME);
  const response = await fetch(url);
  await cache.put(url, response);
}

async function deleteRegion(url) {
  const cache = await caches.open(CACHE_NAME);
  await cache.delete(url);
}

async function updateBadge(currentUrl) {
  const has = await isCached(currentUrl);
  const online = navigator.onLine ? "🟢" : "🔴";
  const offline = has ? "✅" : "⛔";
  document.getElementById("net-badge").textContent =
    `${online} ${offline}`;
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
      <strong>${r.label}</strong> (${r.size_mb} Mo)
      <br/>
      <button>${has ? "Supprimer" : "Télécharger"}</button>
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
