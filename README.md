# Offline Map Lab

Prototype de visualisation cartographique offline basé sur :

- MapLibre GL JS
- PMTiles (par région)
- Service Worker (cache shell + PMTiles Range 206)
- Android Chrome uniquement

---

## Architecture

### Shell offline sw 
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

# Architecture -- Offline Map Lab

## Vue générale

                    ┌─────────────────────────────┐
                    │        Android Chrome       │
                    │        (Utilisateur)        │
                    └──────────────┬──────────────┘
                                   │
                                   ▼
                    ┌─────────────────────────────┐
                    │        index.html           │
                    │  (MapLibre + UI + Offline)  │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
                    ▼                             ▼
          ┌─────────────────┐          ┌──────────────────┐
          │ Service Worker  │          │   MapLibre GL    │
          │ (sw.js)         │          │ + PMTiles lib    │
          └──────┬──────────┘          └─────────┬────────┘
                 │                                 │
                 │                                 │
                 ▼                                 ▼
       ┌────────────────────┐           ┌─────────────────────┐
       │ CacheStorage       │           │  https://tiles...   │
       │ - App shell        │           │  VPS OVH (Caddy)    │
       │ - PMTiles régions  │           │  Fichiers .pmtiles  │
       └────────────────────┘           └─────────────────────┘

------------------------------------------------------------------------

## Flux en ligne

1.  L'utilisateur ouvre `index.html`
2.  MapLibre charge le fichier `.pmtiles`
3.  Caddy sert les données avec support `Range (206)`
4.  Si région téléchargée → Service Worker sert le fichier local

------------------------------------------------------------------------

## Flux hors-ligne (mode avion)

1.  Service Worker sert `index.html` depuis le cache
2.  Service Worker sert `maplibre-gl.js`, `pmtiles.js`, etc.
3.  Service Worker intercepte les requêtes `.pmtiles`
4.  Réponse locale via `Blob.slice()` (Range 206 simulé)

Aucune requête réseau nécessaire.

------------------------------------------------------------------------

## Caches utilisés

  Cache                Contenu            Rôle
  -------------------- ------------------ ---------------------
  oml-shell-v1         HTML + JS + CSS    Redémarrage offline
  offline-map-lab-v1   Fichiers PMTiles   Fonds régionaux

------------------------------------------------------------------------

## Principe clé

> Si une région est téléchargée, elle est toujours servie en local, même
> si le réseau est disponible.

------------------------------------------------------------------------

## Hypothèses de conception

-   Android Chrome uniquement
-   Pas d'iOS
-   Pas d'authentification
-   Pas de mise à jour automatique des PMTiles
-   Fichiers stables (1 an)

------------------------------------------------------------------------

## Test de robustesse

1.  Télécharger une région
2.  Mode avion
3.  Fermer Chrome
4.  Rouvrir l'URL
5.  Zoom / pan

La carte doit fonctionner sans réseau.

------------------------------------------------------------------------

## Points sensibles

-   Service Worker (gestion Range 206)
-   Headers Caddy (Accept-Ranges, CORS)
-   Espace stockage mobile

