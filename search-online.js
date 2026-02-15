// search-online.js — Recherche communes EN LIGNE (BAN) + zoom carte
// Usage: import { initOnlineCommuneSearch } from "./search-online.js"; initOnlineCommuneSearch(map);

export function initOnlineCommuneSearch(map, opts = {}) {
  const {
    openBtnId = "search-open",
    drawerId = "search-drawer",
    closeBtnId = "search-close",
    inputId = "search-input",
    resultsId = "search-results",
    statusId = "search-status",
    limit = 8,
    debounceMs = 350
  } = opts;

  const openBtn = document.getElementById(openBtnId);
  const drawer = document.getElementById(drawerId);
  const closeBtn = document.getElementById(closeBtnId);
  const input = document.getElementById(inputId);
  const results = document.getElementById(resultsId);
  const status = document.getElementById(statusId);

  if (!openBtn || !drawer || !closeBtn || !input || !results || !status) {
    console.warn("[search] éléments UI manquants");
    return;
  }

  let t = null;
  let abort = null;

  function setOnlineState() {
    const online = navigator.onLine;
    input.disabled = !online;
    input.placeholder = online ? "Commune (ex: Orléans)" : "Recherche disponible en ligne";
    status.textContent = online ? "" : "Hors-ligne : la recherche nécessite Internet.";
    if (!online) clearResults();
  }

  function clearResults() {
    results.innerHTML = "";
  }

  function openDrawer() {
    drawer.classList.remove("hidden");
    setOnlineState();
    if (!input.disabled) {
      setTimeout(() => input.focus(), 50);
    }
  }

  function closeDrawer() {
    drawer.classList.add("hidden");
    clearResults();
    status.textContent = "";
  }

  openBtn.onclick = openDrawer;
  closeBtn.onclick = closeDrawer;

  // fermer en cliquant sur l'overlay
  drawer.addEventListener("click", (e) => {
    if (e.target === drawer) closeDrawer();
  });

  window.addEventListener("online", setOnlineState);
  window.addEventListener("offline", setOnlineState);

  function normalize(q) {
    return (q || "").trim();
  }

  async function fetchBAN(q) {
    if (abort) abort.abort();
    abort = new AbortController();

    const url = new URL("https://api-adresse.data.gouv.fr/search/");
    url.searchParams.set("q", q);
    url.searchParams.set("type", "municipality");
    url.searchParams.set("autocomplete", "1");
    url.searchParams.set("limit", String(limit));

    const res = await fetch(url.toString(), { signal: abort.signal });
    if (!res.ok) throw new Error("BAN HTTP " + res.status);
    return res.json();
  }

  function renderItems(features) {
    clearResults();

    if (!features || features.length === 0) {
      results.innerHTML = `<div class="search-empty">Aucun résultat</div>`;
      return;
    }

    for (const f of features) {
      const p = f.properties || {};
      const label = p.label || p.name || "Commune";
      const postcode = p.postcode ? ` (${p.postcode})` : "";
      const ctx = p.context ? ` — ${p.context}` : "";

      const item = document.createElement("button");
      item.type = "button";
      item.className = "search-item";
      item.innerHTML = `<div class="search-item-title">${escapeHtml(label)}${escapeHtml(postcode)}</div>
                        <div class="search-item-sub">${escapeHtml(ctx)}</div>`;

      item.onclick = () => {
        // bbox si dispo : [minLon, minLat, maxLon, maxLat]
        const bbox = f.bbox;
        if (Array.isArray(bbox) && bbox.length === 4) {
          map.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: 40, duration: 700 });
        } else if (f.geometry?.coordinates?.length === 2) {
          const [lng, lat] = f.geometry.coordinates;
          map.flyTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 12), duration: 700 });
        }
        closeDrawer();
      };

      results.appendChild(item);
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (m) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[m]));
  }

  input.addEventListener("input", () => {
    setOnlineState();
    const q = normalize(input.value);

    if (t) clearTimeout(t);
    if (!navigator.onLine) return;

    if (q.length < 3) {
      clearResults();
      status.textContent = q.length === 0 ? "" : "Tape au moins 3 caractères…";
      return;
    }

    status.textContent = "Recherche…";
    t = setTimeout(async () => {
      try {
        const data = await fetchBAN(q);
        status.textContent = "";
        renderItems(data.features || []);
      } catch (e) {
        if (e?.name === "AbortError") return;
        console.warn("[search] erreur", e);
        status.textContent = "Erreur recherche (réseau ?)";
        clearResults();
      }
    }, debounceMs);
  });

  // état initial
  setOnlineState();
}
