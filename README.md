# Offline Map Lab

Prototype de visualisation cartographique offline basé sur :

- MapLibre GL JS
- PMTiles (par région)
- Service Worker (cache shell + PMTiles Range 206)
- Android Chrome uniquement

---

## Architecture

### Shell offline
Le Service Worker met en cache :

- index.html
- style.css
- offline.js
- regions.json
- maplibre-gl.js
- maplibre-gl.css
- pmtiles.js

Ces fichiers permettent à l’application de redémarrer en mode avion.

---

### PMTiles offline

Chaque région correspond à un fichier `.pmtiles`.

Lorsqu’une région est téléchargée :

- Le fichier complet est stocké dans CacheStorage.
- Les requêtes Range sont servies localement (206).
- Le fond est utilisé en local même si le réseau est disponible.

---

## Tests obligatoires après modification

1. Télécharger CVL
2. Mode avion
3. Fermer Chrome
4. Rouvrir l’URL
5. Zoom / pan

Même test avec PACA.

---

## Réinitialisation

Un bouton "Réinitialiser hors-ligne" permet :

- suppression des caches
- suppression des PMTiles
- reset complet

---

## Caddy requis

Headers nécessaires :

- Access-Control-Allow-Origin: *
- Access-Control-Allow-Headers: Range
- Access-Control-Expose-Headers: Content-Range, Content-Length, Accept-Ranges
- Accept-Ranges: bytes

---

## Périmètre volontairement limité

- Android Chrome uniquement
- Pas d’iOS
- Pas d’API dynamique
- Pas d’authentification
- Pas de mise à jour automatique des PMTiles

---

Projet volontairement minimaliste pour garantir la robustesse terrain.
