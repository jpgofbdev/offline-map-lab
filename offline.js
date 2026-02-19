const PMTILES_CACHE = "offline-map-lab-v1"; // doit matcher sw.js
const META_KEY = "oml_meta_v1"; // { url: {code,label,bytes,ts} }

function loadMeta(){
  try { return JSON.parse(localStorage.getItem(META_KEY) || "{}"); }
  catch { return {}; }
}
function saveMeta(meta){
  localStorage.setItem(META_KEY, JSON.stringify(meta));
}
function formatMB(bytes){
  if (!bytes && bytes !== 0) return "? Mo";
  return (bytes / 1024 / 1024).toFixed(0) + " Mo";
}
function getPm(){
  const params = new URLSearchParams(location.search);
  return params.get("pm"); // ex: CVL.pmtiles
}
function getCodeFromPm(pm){
  if (!pm) return null;
  return pm.replace(".pmtiles", "");
}

async function loadRegions(){
  const res = await fetch("./regions.json", { cache: "no-store" });
  if (!res.ok) throw new Error("regions.json introuvable");
  const data = await res.json();
  return data.regions || [];
}

async function isCached(url){
  const cache = await caches.open(PMTILES_CACHE);
  const match = await cache.match(url, { ignoreVary: true });
  return !!match;
}

async function deleteRegion(url){
  const cache = await caches.open(PMTILES_CACHE);
  await cache.delete(url);

  const meta = loadMeta();
  delete meta[url];
  saveMeta(meta);
}

// Téléchargement avec progression (stream) + save meta taille
async function downloadRegion(region, onProgress){
  const url = region.pmtiles_url;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Téléchargement impossible: " + res.status);

  const total = Number(res.headers.get("content-length")) || 0;

  // fallback si pas de stream
  if (!res.body || !window.ReadableStream) {
    const blob = await res.blob();
    const cache = await caches.open(PMTILES_CACHE);
    await cache.put(url, new Response(blob, { headers: res.headers }));

    const meta = loadMeta();
    meta[url] = { code: region.code, label: region.label, bytes: blob.size, ts: Date.now() };
    saveMeta(meta);

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

  const blob = new Blob(chunks, { type: res.headers.get("content-type") || "application/octet-stream" });

  const cache = await caches.open(PMTILES_CACHE);
  await cache.put(url, new Response(blob, { headers: res.headers }));

  const meta = loadMeta();
  meta[url] = { code: region.code, label: region.label, bytes: blob.size, ts: Date.now() };
  saveMeta(meta);

  if (onProgress) onProgress(received, total, true);
}

function openDrawer(){
  const d = document.getElementById("offline-drawer");
  d.classList.remove("hidden");
  d.setAttribute("aria-hidden", "false");
}
function closeDrawer(){
  const d = document.getElementById("offline-drawer");
  d.classList.add("hidden");
  d.setAttribute("aria-hidden", "true");
}

async function updateBadge(){
  const online = navigator.onLine ? "En ligne" : "Hors-ligne";
  const meta = loadMeta();

  // ne garder que ce qui est vraiment encore en cache
  const okCodes = [];
  for (const url of Object.keys(meta)) {
    if (await isCached(url)) okCodes.push(meta[url].code || "?");
  }

  let offlineText = "aucune";
  if (okCodes.length === 1) offlineText = okCodes[0];
  else if (okCodes.length === 2) offlineText = okCodes.join(", ");
  else if (okCodes.length > 2) offlineText = `${okCodes[0]}, ${okCodes[1]} +${okCodes.length - 2}`;

  const btn = document.getElementById("net-badge");
  btn.textContent = `${online} · Hors-connexion : ${offlineText}`;

  // Si le badge est désactivé (ex: fonds en ligne), on garde son title/opacity
  // gérés ailleurs, mais on continue d'actualiser le texte d'état.
  if (!btn.disabled) {
    btn.title = "Appuyer pour gérer les régions hors connexion";
    btn.setAttribute("aria-label", btn.title);

    const hasAny = okCodes.length > 0;
    btn.style.backgroundColor = hasAny ? "#e8f5e9" : "#fff3e0";
    btn.style.borderColor = hasAny ? "#c8e6c9" : "#ffe0b2";
  }
}

async function renderRegionSelectors(regions){
  // topbar select (toujours visible)
  const topSel = document.getElementById("region-select");
  if (topSel && topSel.options.length === 0) {
    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = "Région…";
    topSel.appendChild(opt0);

    regions.forEach(r => {
      const opt = document.createElement("option");
      opt.value = r.code;
      opt.textContent = r.code;
      topSel.appendChild(opt);
    });
  }

  // landing select (si landing visible)
  const landSel = document.getElementById("landing-select");
  if (landSel && landSel.options.length === 0) {
    regions.forEach(r => {
      const opt = document.createElement("option");
      opt.value = r.code;
      opt.textContent = `${r.code} — ${r.label}`;
      landSel.appendChild(opt);
    });
  }

  // sync sélection actuelle si ?pm=
  const pm = getPm();
  const code = getCodeFromPm(pm);
  if (code && topSel) topSel.value = code;
}

async function renderDrawer(regions){
  const pm = getPm();
  const currentCode = getCodeFromPm(pm);
  const subtitle = document.getElementById("drawer-subtitle");
  subtitle.textContent = currentCode ? `Région courante : ${currentCode}` : "Région courante : non sélectionnée";

  const meta = loadMeta();
  const container = document.getElementById("drawer-content");
  container.innerHTML = "";

  // Section A: régions offline OK
  const t1 = document.createElement("div");
  t1.className = "section-title";
  t1.textContent = "Régions hors connexion";
  container.appendChild(t1);

  const downloaded = [];
  for (const r of regions) {
    if (await isCached(r.pmtiles_url)) downloaded.push(r);
  }

  if (downloaded.length === 0) {
    const p = document.createElement("div");
    p.className = "small-note";
    p.textContent = "Aucune région téléchargée.";
    container.appendChild(p);
  } else {
    for (const r of downloaded) {
      const row = document.createElement("div");
      row.className = "region-row";

      const bytes = meta[r.pmtiles_url]?.bytes ?? null;
      row.innerHTML = `
        <div class="region-meta">
          <div class="region-name">${r.code} — hors-ligne OK</div>
          <div class="region-size">Occupe ${formatMB(bytes)}</div>
        </div>
        <div>
          <button class="btn btn-danger" type="button">Nettoyer</button>
        </div>
      `;

      row.querySelector("button").onclick = async () => {
        await deleteRegion(r.pmtiles_url);
        await renderDrawer(regions);
        await updateBadge();
      };

      container.appendChild(row);
    }
  }

  // Total offline
  const totalBytes = Object.values(loadMeta()).reduce((s, x) => s + (x.bytes || 0), 0);
  const totalDiv = document.createElement("div");
  totalDiv.className = "small-note";
  totalDiv.style.marginTop = "8px";
  totalDiv.textContent = `Stockage hors-ligne total : ${formatMB(totalBytes)}`;
  container.appendChild(totalDiv);

  // Section B: ajouter région
  const t2 = document.createElement("div");
  t2.className = "section-title";
  t2.textContent = "Ajouter une région";
  t2.style.marginTop = "14px";
  container.appendChild(t2);

  const notDownloaded = [];
  for (const r of regions) {
    if (!(await isCached(r.pmtiles_url))) notDownloaded.push(r);
  }

  const addWrap = document.createElement("div");
  addWrap.style.display = "flex";
  addWrap.style.gap = "10px";
  addWrap.style.alignItems = "center";

  const sel = document.createElement("select");
  sel.className = "btn";
  sel.style.flex = "1";

  notDownloaded.forEach(r => {
    const opt = document.createElement("option");
    opt.value = r.code;
    const sz = (r.size_mb ? `${r.size_mb} Mo` : "? Mo");
    opt.textContent = `${r.code} — ${sz}`;
    sel.appendChild(opt);
  });

  const btn = document.createElement("button");
  btn.className = "btn btn-primary";
  btn.type = "button";
  btn.textContent = notDownloaded.length ? "Télécharger" : "Tout est téléchargé";
  btn.disabled = notDownloaded.length === 0;

  addWrap.appendChild(sel);
  addWrap.appendChild(btn);
  container.appendChild(addWrap);

  // zone progression
  const progWrap = document.createElement("div");
  progWrap.style.display = "none";
  progWrap.innerHTML = `
    <div class="progress"><div id="dl-bar"></div></div>
    <div id="dl-text" class="progress-text">0%</div>
    <div id="dl-status" class="progress-text"></div>
  `;
  container.appendChild(progWrap);

  btn.onclick = async () => {
    const code = sel.value;
    const region = regions.find(r => r.code === code);
    if (!region) return;

    btn.disabled = true;
    sel.disabled = true;
    btn.textContent = "Téléchargement…";

    progWrap.style.display = "block";
    const bar = progWrap.querySelector("#dl-bar");
    const txt = progWrap.querySelector("#dl-text");
    const st = progWrap.querySelector("#dl-status");
    st.textContent = `Téléchargement de ${region.code}…`;

    try {
      await downloadRegion(region, (received, total, done) => {
        if (total) {
          const pct = Math.floor((received / total) * 100);
          bar.style.width = pct + "%";
          txt.textContent = `${pct}% (${(received/1024/1024).toFixed(1)} / ${(total/1024/1024).toFixed(1)} Mo)`;
        } else {
          txt.textContent = `${(received/1024/1024).toFixed(1)} Mo téléchargés`;
        }
        if (done) st.textContent = `Téléchargement terminé : ${region.code}`;
      });

      await renderDrawer(regions);
      await updateBadge();

    } catch (e) {
      console.warn(e);
      st.textContent = "Erreur de téléchargement (réessayer).";
      btn.disabled = false;
      sel.disabled = false;
      btn.textContent = "Télécharger";
    }
  };
}

async function resetOffline(){
  // supprime tous les caches + meta
  const keys = await caches.keys();
  for (const k of keys) await caches.delete(k);
  localStorage.removeItem(META_KEY);
  alert("Hors-ligne réinitialisé. La page va se recharger.");
  location.href = "./";
}

async function initUI(){
  const regions = await loadRegions();
  window.OML_REGIONS = regions; // exposé pour debug/usage éventuel
  await renderRegionSelectors(regions);
  await updateBadge();

  // landing visible par défaut si pas de ?pm=
  const pm = getPm();
  if (!pm) {
    document.getElementById("landing").style.display = "block";
    document.getElementById("map").style.display = "none";
  } else {
    document.getElementById("landing").style.display = "none";
  }

  // topbar select → change région
  const topSel = document.getElementById("region-select");
  topSel.onchange = () => {
    const code = topSel.value;
    if (!code) return;
    location.search = `?pm=${code}.pmtiles`;
  };

  // landing open region
  const landGo = document.getElementById("landing-go");
  const landSel = document.getElementById("landing-select");
  landGo.onclick = () => {
    const code = landSel.value;
    location.search = `?pm=${code}.pmtiles`;
  };

  // ouvrir drawer depuis landing
  document.getElementById("landing-offline").onclick = async () => {
    openDrawer();
    await renderDrawer(regions);
  };

  // badge ouvre drawer
  document.getElementById("net-badge").onclick = async () => {
    if (window.omlBasemapOnlineOnly) return;
    openDrawer();
    await renderDrawer(regions);
  };

  // close drawer
  document.getElementById("drawer-close").onclick = closeDrawer;
  document.getElementById("offline-drawer").onclick = (e) => {
    if (e.target.id === "offline-drawer") closeDrawer();
  };

  // reset offline
  document.getElementById("reset-offline").onclick = resetOffline;

  window.addEventListener("online", () => updateBadge());
  window.addEventListener("offline", () => updateBadge());
}

window.addEventListener("DOMContentLoaded", () => {
  initUI().catch(err => {
    console.error(err);
    alert("Erreur initialisation UI offline. Voir console.");
  });
});


// Exposé pour basemaps.js
window.omlUpdateBadge = async function(){
  try {
    const regions = await fetchRegions();
    await updateBadge(regions);
  } catch(e){}
};
