
// search-online.js (ES module) — Recherche en ligne de communes (geo.api.gouv.fr)
// But : fournir une loupe stable et frugale. Hors connexion : la recherche affiche un message.

async function queryCommunes(q){
  const url = "https://geo.api.gouv.fr/communes?nom=" + encodeURIComponent(q) +
              "&fields=nom,code,centre&boost=population&limit=10";
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return await res.json();
}

function ensureUI(){
  if (!document.getElementById("search-btn")) {
    const btn = document.createElement("button");
    btn.id = "search-btn";
    btn.className = "fab";
    btn.title = "Rechercher une commune (en ligne)";
    btn.textContent = "🔎";
    document.body.appendChild(btn);
  }
  if (!document.getElementById("search-panel")) {
    const panel = document.createElement("div");
    panel.id = "search-panel";
    panel.style.cssText = "position:fixed;left:12px;bottom:80px;right:12px;max-width:520px;background:#fff;padding:10px;border-radius:12px;box-shadow:0 6px 18px rgba(0,0,0,.18);display:none;z-index:9999;";
    panel.innerHTML = `
      <div style="display:flex;gap:8px;align-items:center;">
        <input id="search-input" type="text" placeholder="Commune…" style="flex:1;padding:8px;border:1px solid #ddd;border-radius:10px;" />
        <button id="search-go" style="padding:8px 10px;border:1px solid #ddd;border-radius:10px;background:#f7f7f7;">OK</button>
        <button id="search-close" style="padding:8px 10px;border:1px solid #ddd;border-radius:10px;background:#f7f7f7;">✕</button>
      </div>
      <div id="search-results" style="margin-top:8px;max-height:240px;overflow:auto;font-size:14px;"></div>
      <div id="search-hint" style="margin-top:6px;font-size:12px;color:#666;">Recherche en ligne (hors connexion : indisponible).</div>
    `;
    document.body.appendChild(panel);
  }
}

export function initOnlineCommuneSearch(map){
  ensureUI();

  const btn = document.getElementById("search-btn");
  const panel = document.getElementById("search-panel");
  const input = document.getElementById("search-input");
  const go = document.getElementById("search-go");
  const close = document.getElementById("search-close");
  const results = document.getElementById("search-results");
  const hint = document.getElementById("search-hint");

  const open = () => { panel.style.display="block"; input.focus(); };
  const hide = () => { panel.style.display="none"; };

  btn.onclick = open;
  close.onclick = hide;

  async function run(){
    const q = (input.value||"").trim();
    if (q.length < 2) return;
    results.textContent = "Recherche…";
    try{
      if (!navigator.onLine){
        results.textContent = "Hors connexion : recherche indisponible.";
        return;
      }
      const items = await queryCommunes(q);
      if (!items.length){ results.textContent = "Aucun résultat."; return; }
      results.innerHTML = "";
      for (const c of items){
        const row = document.createElement("div");
        row.style.cssText="padding:6px 4px;border-bottom:1px solid #eee;cursor:pointer;";
        row.textContent = `${c.nom} (${c.code})`;
        row.onclick = () => {
          const center = c.centre?.coordinates;
          if (center?.length === 2){
            map.flyTo({ center, zoom: 13 });
            hide();
          }
        };
        results.appendChild(row);
      }
    } catch(e){
      results.textContent = "Erreur de recherche (connexion ?).";
      console.warn("[Search] error", e);
    }
  }

  go.onclick = run;
  input.onkeydown = (e)=>{ if (e.key==="Enter") run(); };
  hint.textContent = "Recherche en ligne (geo.api.gouv.fr).";
}

// compat éventuelle
window.initOnlineSearch = initOnlineCommuneSearch;
