
// basemaps.js (ES module) — Offline Map Lab
// Fonds de plan : PMTiles régional (offline/online) + IGN raster WMTS
// - N'altère pas la source PMTiles ("basemap") : se contente de masquer/afficher les layers.
// - Ajoute des layers raster WMTS IGN à la demande.
// - Expose window.omlBasemapOnlineOnly pour désactiver la console offline quand fond en ligne.

const BASEMAPS = [
  { id:"pmtiles-offline", label:"PMTiles régional (offline)", kind:"pmtiles", onlineOnly:false },
  { id:"pmtiles-online",  label:"PMTiles régional (online)",  kind:"pmtiles", onlineOnly:true  },
  { id:"ign-plan",        label:"IGN Plan (raster)",          kind:"raster_wmts", onlineOnly:true,
    tiles: [
      "https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0" +
      "&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&FORMAT=image/png" +
      "&TILEMATRIXSET=PM_0_19&TILEMATRIX={z}&TILECOL={x}&TILEROW={y}"
    ],
    attribution: "© IGN"
  },
  { id:"ign-ortho",       label:"IGN Ortho (raster)",         kind:"raster_wmts", onlineOnly:true,
    tiles: [
      "https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0" +
      "&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&FORMAT=image/jpeg" +
      "&TILEMATRIXSET=PM_0_19&TILEMATRIX={z}&TILECOL={x}&TILEROW={y}"
    ],
    attribution: "© IGN"
  }
];

function setPmtilesVisibility(map, visible){
  const style = map.getStyle();
  if (!style?.layers) return;
  for (const lyr of style.layers) {
    if (lyr?.source === "basemap") {
      try { map.setLayoutProperty(lyr.id, "visibility", visible ? "visible" : "none"); }
      catch { /* ignore */ }
    }
  }
}

function ensureRasterLayer(map, id, tiles, attribution){
  const srcId = `raster-${id}`;
  const layerId = `raster-layer-${id}`;

  if (!map.getSource(srcId)) {
    map.addSource(srcId, {
      type: "raster",
      tiles,
      tileSize: 256,
      maxzoom: 19,
      attribution: attribution || ""
    });
  }
  if (!map.getLayer(layerId)) {
    map.addLayer({ id: layerId, type:"raster", source: srcId, paint: { "raster-opacity": 1.0 }});
  }
  return layerId;
}

function setRasterVisibility(map, id, visible){
  const layerId = `raster-layer-${id}`;
  if (map.getLayer(layerId)) {
    map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
  }
}

function applyBasemap(map, basemapId){
  const bm = BASEMAPS.find(b => b.id === basemapId) || BASEMAPS[0];

  window.omlBasemapOnlineOnly = !!bm.onlineOnly;

  // PMTiles visible uniquement si kind=pmtiles
  setPmtilesVisibility(map, bm.kind === "pmtiles");

  // Raster : show selected, hide others
  for (const b of BASEMAPS) {
    if (b.kind === "raster_wmts") {
      if (b.id === bm.id) {
        ensureRasterLayer(map, b.id, b.tiles, b.attribution);
        setRasterVisibility(map, b.id, true);
      } else {
        setRasterVisibility(map, b.id, false);
      }
    }
  }

  // Demande à offline.js de rafraîchir le badge (si dispo)
  if (typeof window.omlUpdateBadge === "function") window.omlUpdateBadge();
}

export function initBasemapMenu(map, { selectId="basemap-select" } = {}){
  const sel = document.getElementById(selectId);
  if (!sel) return;

  sel.innerHTML = "";
  for (const b of BASEMAPS) {
    const opt = document.createElement("option");
    opt.value = b.id;
    opt.textContent = b.label;
    sel.appendChild(opt);
  }

  const key = "oml_basemap_choice_v1";
  const saved = localStorage.getItem(key);
  if (saved && BASEMAPS.some(b => b.id === saved)) sel.value = saved;

  const apply = () => applyBasemap(map, sel.value);

  sel.onchange = () => {
    localStorage.setItem(key, sel.value);
    apply();
  };

  if (map.isStyleLoaded()) apply();
  else map.on("load", apply);
}

// compat éventuelle
window.initBasemapMenu = initBasemapMenu;
