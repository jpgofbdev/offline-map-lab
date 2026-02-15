// gps.js — GPS button + view persistence (par région)
// Dépend de maplibre-gl.js déjà chargé

function getRegionCodeFromPm(pm) {
  if (!pm) return "default";
  try {
    // pm peut être "CVL.pmtiles" ou une URL complète
    const name = pm.includes("://") ? new URL(pm).pathname.split("/").pop() : pm;
    return (name || "default").replace(/\.pmtiles$/i, "") || "default";
  } catch {
    return (pm || "default").replace(/\.pmtiles$/i, "") || "default";
  }
}

export function initViewPersistence(map, regionCode) {
  const key = `oml_view_${regionCode}`;

  // Sauvegarde après chaque déplacement/zoom
  map.on("moveend", () => {
    const c = map.getCenter();
    const z = map.getZoom();
    const payload = { lng: +c.lng.toFixed(6), lat: +c.lat.toFixed(6), zoom: +z.toFixed(2), ts: Date.now() };
    try { localStorage.setItem(key, JSON.stringify(payload)); } catch {}
  });
}

export function loadSavedView(regionCode) {
  const key = `oml_view_${regionCode}`;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (typeof v?.lng !== "number" || typeof v?.lat !== "number" || typeof v?.zoom !== "number") return null;
    return v;
  } catch {
    return null;
  }
}

export function initGPS(map, opts = {}) {
    if (!("geolocation" in navigator)) {
  btn.disabled = true;
  btn.dataset.state = "error";
  btn.title = "GPS indisponible (géolocalisation bloquée sur cet appareil/navigateur)";
  btn.setAttribute("aria-label", btn.title);
  return null;
}

  const {
    buttonId = "gps-btn",
    enableHighAccuracy = true,
    timeout = 12000,
    maximumAge = 5000
  } = opts;

  const btn = document.getElementById(buttonId);
  if (!btn) {
    console.warn(`[GPS] Bouton #${buttonId} introuvable`);
    return;
  }

  // On utilise GeolocateControl (robuste, maintenable)
  const geo = new maplibregl.GeolocateControl({
    positionOptions: { enableHighAccuracy, timeout, maximumAge },
    trackUserLocation: true,          // permet toggle suivi
    showUserLocation: true,
    showAccuracyCircle: true,
    fitBoundsOptions: { maxZoom: 16 } // évite de zoomer trop fort
  });

  // On l’ajoute à la map (mais on cachera son bouton via CSS)
  map.addControl(geo, "top-right");

  let tracking = false;

  const setState = (state, title) => {
    btn.dataset.state = state; // off | searching | on | error
    if (title) {
      btn.title = title;
      btn.setAttribute("aria-label", title);
    }
  };

  setState("off", "GPS : centrer sur ma position");

  btn.addEventListener("click", () => {
    // GeolocateControl gère permission + watch + erreurs
    // trigger() : centre (et active/désactive le suivi si trackUserLocation=true)
    setState("searching", tracking ? "GPS : arrêt du suivi…" : "GPS : localisation…");
    geo.trigger();
  });

  geo.on("geolocate", (e) => {
    // e.coords.accuracy disponible
    setState(tracking ? "on" : "off", tracking ? "GPS : suivi activé (appuyer pour arrêter)" : "GPS : position trouvée");
  });

  geo.on("error", (err) => {
    // err.code/err.message
    setState("error", "GPS : erreur ou permission refusée");
    console.warn("[GPS] error", err);
    // Revenir à un état neutre après un moment
    setTimeout(() => setState(tracking ? "on" : "off", tracking ? "GPS : suivi activé" : "GPS : centrer sur ma position"), 2500);
  });

  // Événements de suivi (MapLibre les émet comme Mapbox GL)
  geo.on("trackuserlocationstart", () => {
    tracking = true;
    setState("on", "GPS : suivi activé (appuyer pour arrêter)");
  });

  geo.on("trackuserlocationend", () => {
    tracking = false;
    setState("off", "GPS : centrer sur ma position");
  });

  return geo;
}

// Petit helper si tu veux l’utiliser ailleurs
export const GPSHelpers = { getRegionCodeFromPm };
