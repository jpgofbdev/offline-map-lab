# offline-map-lab

# Offline Map Lab

Prototype expérimental de visualisation offline-first de données publiques
basé sur MapLibre GL JS et PMTiles.

## Objectif

Démontrer qu'un fond cartographique vectoriel régional peut être :

- servi sans serveur applicatif
- performant sur mobile
- utilisable en conditions terrain
- basé uniquement sur des données ouvertes

## Architecture

Frontend :
- MapLibre GL JS
- PMTiles protocol

Backend (démo) :
- Fichiers PMTiles servis via HTTP range requests

## Statut

Projet expérimental / démonstrateur technique.

Ce projet n'est pas un outil métier officiel.
