# Tests du dashboard

Le dashboard (`../dashboard.html`) est un fichier unique autonome ; ses tests
s'appuient sur le JS qu'il embarque (extrait à la volée) + des fixtures FIT.

## Lancer les tests

```bash
# 1. Tests du parseur / modèle / calculs (Node, aucune dépendance)
node tests/test.js

# 2. Test de l'IHM sous jsdom (canvas stubbé)
cd tests && npm install && node test_ui.js
```

## Fixtures FIT (`tests/fixtures/`)

Générées avec l'encodeur officiel Garmin (`pip install garmin-fit-sdk`) :

```bash
python3 tests/make_fixtures.py
```

| Fichier | Contenu |
|---|---|
| `activity_run.fit` | Course à pied 30 min, 1 record/s (FC, cadence, distance, allure, altitude) |
| `activity_ride_gps.fit` | Vélo 1 h avec trace GPS (lat/long) + puissance |
| `monitoring_5days.fit` | 5 jours de monitoring : pas/distance/calories/temps actif **cumulatifs**, FC instantanée, `stress_level`, FC au repos |
| `sleep_2nights.fit` | 2 nuits de `sleep_level` (profils éveillé/léger/profond/REM) |
| `bad.fit` | Fichier corrompu (doit être signalé en erreur sans bloquer les autres) |

Les vrais fichiers `.fit` déposés à la racine du dépôt (branche `main`) sont
également utilisés par les tests quand ils sont présents.
