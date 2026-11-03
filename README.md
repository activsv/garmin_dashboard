# Garmin Connect (local) — dashboard FIT 100 % hors-ligne

`dashboard.html` est une **page unique et autonome** (HTML + CSS + JS embarqués,
aucune dépendance externe, aucun serveur, aucune donnée envoyée sur le réseau).
Ouvrez-la par simple double-clic dans votre navigateur, puis glissez-déposez vos
fichiers `.fit` Garmin (ou sélectionnez un dossier, ou synchronisez la montre).

## Fonctionnalités

- **Décodage FIT en pur JS dans le navigateur** : header, CRC-16, messages de
  définition, records, champs développeur, compressed timestamps, profil Garmin
  officiel embarqué (généré depuis le SDK). Fichiers corrompus signalés
  individuellement, les autres continuent.
- **Onglets façon Garmin Connect** : Tableau de bord / Activités / Santé /
  Sommeil / Fichiers & import.
- **Tableau de bord** : cartes KPI cliquables avec sparklines (séances, pas,
  calories, distance, FC moyenne/repos, stress, sommeil), carte « Dernière
  activité », graphique de la métrique choisie (moyenne glissante 7 j, seuils
  configurables en pointillés, points hors-seuil, tooltips), clic sur un jour →
  zoom horaire/seconde, bouton « ← Vue globale », sélecteur de période
  (1 j / 7 j / 30 j / 90 j / 1 an / tout / dates libres Du–Au).
- **Activités** : calendrier du mois (jours d'activité cliquables = filtre),
  liste des séances (sport, durée, distance, calories, FC, D+), détail séance :
  KPIs, graphique à la seconde (FC avec zones colorées Z1–Z5, vitesse,
  altitude, cadence, puissance…), tableau des laps, tracé GPS + **export GPX**.
- **Santé** : métriques journalières (pas, calories, distance, temps actif,
  FC moy/min/max, FC au repos, stress), graphique + zoom, tableau des derniers
  jours avec statut OK/ALERTE, graphique « Temps dans les zones de FC » (barres
  empilées), **export CSV** des agrégats journaliers.
- **Sommeil** : nuits détectées (sleep_level), durées, répartition
  profond/léger/REM/éveillé.
- **Fichiers & import** : glisser-déposer multi-fichiers `.fit` ou `.json`,
  « Parcourir », « Sélectionner un dossier » (récursif), **synchronisation
  incrémentale montre → PC** (ne copie que les nouveaux `.fit`, arborescence
  conservée, dossiers mémorisés — nécessite Chrome/Edge), export/import JSON du
  jeu de données, liste des fichiers avec statut + détail par type de message,
  carte « Appareil & profil ».
- **Volume** : sous-échantillonnage LTTB (≤ 1200 points/graphique) pour rester
  fluide sur un an de données à la seconde.
- **Agrégation + dédoublonnage** de tous les fichiers importés en un jeu de
  données chronologique unique.

## Tests

Voir [tests/README.md](tests/README.md) :

```bash
node tests/test.js                 # parseur + modèle + calculs (36 checks, zéro dep)
cd tests && npm install && node test_ui.js   # IHM sous jsdom (34 checks)
python3 tests/make_fixtures.py     # régénère les fixtures FIT de test
```

## Ajouter une métrique

Documenté en commentaire en tête de `dashboard.html` : 1 entrée dans `METRICS`
(+ champ dans `FIT_PROFILE.FIELD_DEFS` si manquant, + calcul dans `dailyAgg()`
si la source est journalière).
