import { cacheRegionPmtiles, uncacheRegionPmtiles, hasRegionPmtiles } from "./offline-manager.js";

function getPmParam() {
  const u = new URL(location.href);
  return u.searchParams.get("pm"); // ex "CVL.pmtiles"
}

async function loadRegions() {
  const res = await fetch("./regions.json", { cache: "no-store" });
  if (!res.ok) throw new Error("regions.json introuvable");
  const data = await res.json();
  return data.regions || [];
}

function setBadge(text) {
  const el = document.getElementById("net-badge");
  el.textContent = text;
}

function openDrawer() {
  const d = document.getElementById("offline-drawer");
  d.classList.remove("hidden");
  d.setAttribute("aria-hidden", "false");
}

function closeDrawer() {
  const d = document.getElementById("offline-drawer");
  d.classList.add("hidden");
  d.setAttribute("aria-hidden", "true");
}

function regionFromPm(regions, pmParam) {
  if (!pmParam) return null;
  const code = pmParam.replace(".pmtiles", "");
  return regions.find(r => r.code === code) || null;
}

async function refreshUI(regions) {
  const pm = getPmParam();
  const current = regionFromPm(regions, pm);

  // Badge: on affiche réseau + offline prêt pour la région courante
  const online = navigator.onLine ? "En ligne" : "Hors-ligne";
  if (!current) {
    setBadge(`${online} · Région ?`);
    document.getElementById("drawer-subtitle").textContent =
      `Région courante : inconnue (paramètre ?pm=...)`;
    return;
  }

  const has = await hasRegionPmtiles(current.pmtiles_url);
  setBadge(`${online} · ${has ? "✅ " : "⛔ "}Offline ${current.code}`);

  document.getElementById("drawer-subtitle").textContent =
    `Région courante : ${current.label} (${current.code})`;
}

async function renderDrawer(regions) {
  const pm = getPmParam();
  const current = regionFromPm(regions, pm);
  const container = document.getElementById("drawer-content");
  container.innerHTML = "";

  for (const r of regions) {
    const row = document.createElement("div");
    row.className = "region-row";

    const left = document.createElement("div");
    left.className = "region-meta";

    const name = document.createElement("div");
    name.className = "region-name";
    name.textContent = `${r.label} (${r.code})`;

    const size = document.createElement("div");
    size.className = "region-size";
    size.textContent = `≈ ${r.size_mb ?? "?"} Mo`;

    left.appendChild(name);
    left.appendChild(size);

    const right = document.createElement("div");

    const has = await hasRegionPmtiles(r.pmtiles_url);

    const pill = document.createElement("span");
    pill.className = "pill";
    pill.textContent = has ? "Téléchargé" : "Non téléchargé";
    right.appendChild(pill);

    if (!has) {
      const btn = document.createElement("button");
      btn.className = "btn btn-primary";
      btn.textContent = "Télécharger";
      btn.onclick = async () => {
        btn.disabled = true;
        btn.textContent = "Téléchargement…";
        try {
          await cacheRegionPmtiles(r.pmtiles_url);
          await renderDrawer(regions);
          await refreshUI(regions);
        } catch (e) {
          console.warn(e);
          btn.textContent = "Erreur (réessayer)";
          btn.disabled = false;
        }
      };
      right.appendChild(btn);
    } else {
      const btn = document.createElement("button");
      btn.className = "btn btn-danger";
      btn.textContent = "Supprimer";
      btn.onclick = async () => {
        btn.disabled = true;
        btn.textContent = "Suppression…";
        try {
          await uncacheRegionPmtiles(r.pmtiles_url);
          await renderDrawer(regions);
          await refreshUI(regions);
        } catch (e) {
          console.warn(e);
          btn.textContent = "Erreur";
        }
      };
      right.appendChild(btn);
    }

    row.appendChild(left);
    row.appendChild(right);
    container.appendChild(row);
  }

  const note = document.createElement("div");
  note.className = "small-note";
  note.textContent =
    "Astuce terrain : une fois téléchargé, le fond est utilisé en local même si vous avez du réseau (plus stable).";
  container.appendChild(note);

  // Option UX: si région courante non téléchargée, on le signale
  if (current) {
    const hasCur = await hasRegionPmtiles(current.pmtiles_url);
    if (!hasCur) {
      const warn = document.createElement("div");
      warn.className = "small-note";
      warn.textContent = `⚠️ La région courante (${current.code}) n’est pas encore disponible hors-ligne.`;
      container.appendChild(warn);
    }
  }
}

export async function initOfflineTopbar() {
  // Boutons
  document.getElementById("offline-btn").addEventListener("click", openDrawer);
  document.getElementById("drawer-close").addEventListener("click", closeDrawer);
  document.getElementById("offline-drawer").addEventListener("click", (e) => {
    if (e.target.id === "offline-drawer") closeDrawer();
  });

  // Données
  const regions = await loadRegions();

  // Premier rendu
  await renderDrawer(regions);
  await refreshUI(regions);

  // Refresh sur changements
  window.addEventListener("online", () => refreshUI(regions));
  window.addEventListener("offline", () => refreshUI(regions));
  window.addEventListener("popstate", () => refreshUI(regions));
}
