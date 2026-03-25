# Phase 2 — Optimisation (page `optimisation`)

## 1) Compréhension des consignes (Mission2)

Objectif à implémenter : pour un champ réparti sur les `20` parcelles autorisées, choisir pour chaque parcelle une seule “famille” d’éoliennes (un type uniquement) + un nombre (borné par une capacité max liée au diamètre rotor) + une direction d’implantation (angle `0..359°`) afin de maximiser un score de “profit constructeur”.

Paramètres économiques (donnés dans le PDF) :

- Prix de rachat : `80 €/MWh` (indiqué comme `80 €/MW.h`).
- Coût d’entretien : `30 €/MWh` (indiqué comme `30 €/MW.h`).
- Budget total max : `600 000 000 €`.
- Durée max de retour sur investissement (ROI) par parcelle : `20 ans`.

Contraintes principales (à respecter à la soumission/au calcul) :

- Parcelles disponibles : `20` parcelles listées ci-dessous (on peut n’en utiliser qu’une partie).
  - `3H, 3J, 4E, 4H, 5G, 6G, 7C, 8C, 8H, 9E, 9F, 11E, 12E, 13F, 14J, 15J, 16E, 18F, 18G, 18H`
- Capacité max d’éoliennes par parcelle dépend du diamètre rotor `D` (table fournie dans le PDF avec colonnes `D=200,150,135,120,110,80,60,50,30`).
- Sur une parcelle : uniquement `1` type d’éolienne.
- Compatibilité carte terre/mer : une parcelle terrestre n’accepte que des éoliennes `terrestre`, une parcelle maritime (zones bleues) n’accepte que des éoliennes `offshore`.
- Direction d’implantation : angle `0..359°`. La direction correspond à “où va le vent”.
- La direction influence la production (si désalignement, production plus faible).
- ROI par parcelle <= `20 ans`, avec formule donnée dans le PDF.

Prix des éoliennes (image jointe) :

- On intègre un catalogue `turbines[i]` avec :
  - le type `offshore`/`terrestre`,
  - le prix unitaire (installé) lu sur l’image.
- Valeurs à reporter (en €) :
  - `1: 28 400 000 (offshore)`
  - `2: 23 200 000 (offshore)`
  - `3: 15 100 000 (offshore)`
  - `4: 15 000 000 (offshore)`
  - `5: 13 300 000 (offshore)`
  - `6: 14 900 000 (offshore)`
  - `7: 14 500 000 (terrestre)`
  - `8: 8 700 000 (terrestre)`
  - `9: 7 200 000 (terrestre)`
  - `10: 12 400 000 (terrestre)`
  - `11: 6 300 000 (terrestre)`
  - `12: 9 300 000 (terrestre)`
  - `13: 7 800 000 (terrestre)`
  - `14: 4 500 000 (terrestre)`
  - `15: 6 100 000 (terrestre)`
  - `16: 6 000 000 (terrestre)`
  - `17: 4 100 000 (terrestre)`
  - `18: 3 200 000 (terrestre)`
  - `19: 2 300 000 (terrestre)`
  - `20: 1 900 000 (terrestre)`
  - `21: 2 700 000 (terrestre)`
  - `22: 1 300 000 (terrestre)`
  - `23: 700 000 (terrestre)`
  - `24: 1 000 000 (terrestre)`

## 2) Architecture cible (vue d’ensemble)

1. Un script de calcul en Python rigoureusement commentée pour être claire à la relecture dans `phase2/` :
  - `phase2/optimisation.py`
2. Le script produit des artefacts JSON (et éventuellement des images) dans un dossier `phase2/generated/`.
3. Une nouvelle page React `src/pages/Optimisation.tsx` (route `/optimisation`) charge le JSON et rend :
  - une grille des parcelles (les 20 autorisées mises en évidence),
  - pour chaque parcelle sélectionnée : type, nombre, direction, coût, production annuelle, ROI,
  - un récapitulatif (budget total, profit net, production totale, ROI min/max).
4. Un endpoint FastAPI pour déclencher le calcul côté serveur (sinon on utilise un JSON “pré-calculé” commit/produit manuellement).

## 3) Données à construire (phase2/data)

### 3.1 Catalogue des éoliennes (phase2/data/turbines.json)

But : associer à chaque éolienne `i=1..24` :

- `id`: `1..24`
- `install_kind`: `offshore | terrestre` (lié à l’image)
- `price_eur`: prix unitaire installé (lié à l’image)
- `D_m`: diamètre rotor (lié aux rapports phase1/phase2 : chaque rapport d’éolienne doit permettre de récupérer le diamètre rotor)
- un modèle de puissance utilisable pour `P(V)` (au choix parmi :
  - courbe discrète interpolable `P(V)` si les rapports fournissent une table,
  - ou paramètres d’un modèle physique (ex: rendement η + loi `V^3` + coupure) si c’est le format dominant des rapports)
- si présent : paramètres “direction → baisse de production” ou au moins une hypothèse de baisse (à calibrer avec les rapports)

Plan d’extraction :

- Parcourir les PDFs `phase2/rapports/*` pour identifier quels éoliennes/numéros correspondent à quel fichier.
- Pour chaque fichier, extraire au minimum :
  - “Diamètre rotor”
  - “Puissance nominale”
  - la forme de la courbe puissance (table ou forme analytique)
- Si les PDFs sont difficiles à parser automatiquement :
  - faire une extraction semi-automatique (OCR léger) pour `D` et la puissance nominale,
  - puis consolider manuellement dans `phase2/data/turbines.json`.

### 3.2 Données météo (phase2/data/wind_by_parcel_year)

But : pour chaque année météo et chaque parcelle autorisée, obtenir :

- une liste d’observations (ou une distribution agrégée) avec :
  - vitesse du vent `V` (m/s)
  - direction du vent `dir` (en degrés, convention “où va le vent”)

Chargement :

- Implémenter un loader générique qui lit les fichiers `.txt` contenus dans les archives `phase2/data/Data brut/Groupe*.zip` (structure attendue `.../YYYY/<PARCEL>_YYYY.txt`).
- On agrège ensuite vers une distribution par bin :
  - vitesse : bins de `0.5 m/s` ou `1 m/s` (au choix selon précision)
  - direction : secteurs de `30°` (N, NNE, …) ou angle fin si on veut optimiser l’orientation plus finement.
- L’optimisation doit utiliser la distribution agrégée sur l’ensemble des années disponibles (pas seulement une année).

Sortie :

- `phase2/data/wind_aggregated.json` (parcelles × années × bins (V,dir) → probabilité/compte), construit uniquement depuis `phase2/data/Data brut`.

## 4) Modèle de production (P pour une éolienne sur une parcelle)

### 4.1 Production de base (sans intermittence/stockage)

Entrées :

- `parcel_id`
- éolienne `t` (donc `D` et modèle `P(V)`),
- direction d’implantation `theta` (0..359),
- nombre d’éoliennes `n`.

Étapes :

1. Pour chaque observation météo (ou bin) (V, dir) :
  - calculer le désalignement angulaire : `delta = circular_distance(dir, theta)`.
  - calculer une “vitesse effective” `V_eff = V * f(delta)` où :
    - `f(delta)` vaut `1` si `delta` proche de `0`,
    - décroît avec `delta` (fonction paramétrable : `cos` clamp, ou gaussienne).
2. Calculer `P_t(V_eff)` via le modèle puissance de `t`.
3. Agréger sur :
  - toutes les observations de l’année (ou probabilité par bins),
  - puis moyen sur `24` années (ou sommation selon interprétation consigne).
4. Convertir en énergie annuelle :
  - `E_t(parcel,theta) = sum(P_t(V_eff) * Pr(V,dir) * 8760)` (MW→MWh via facteur).
5. Échelle avec le nombre d’éoliennes :
  - `E_total = n * E_t` (hypothèse linéaire si pas d’effet de sillage demandé explicitement).

Remarque “créativité” :

- Si on souhaite modéliser une perte additionnelle liée au nombre d’éoliennes (proxy sillage / densité), on ajoute :
  - un facteur `g(n)` décroissant (calibré empiriquement).

### 4.2 Intermittence / stockage (pénalisation ou valorisation)

But : intégrer une logique “livrabilité” qui réduit la valeur quand la production varie trop (ou si stockage non disponible).

Approches (choisir une première version simple) :

1. Pénalisation “variabilité” :
  - calculer la variance ou le CV de la production annuelle par bins,
  - convertir en un facteur de “qualité énergie” `q in [0,1]`,
  - utiliser `E_delivered = q * E_total`.
2. Stockage simplifié :
  - supposer un stockage de capacité fixe (paramétrable),
  - appliquer une règle de lissage sur les bins (ex: limiter la baisse si production faible).
3. Coût du stockage :
  - si on augmente `q`, ajouter un CAPEX/OPEX stockage (à partir d’un coût €/MWh de capacité ou €/MWh lissée).

Intégration à l’objectif :

- On définit le “profit net annuel” par :
  - `profit = E_delivered * PrixRachat - E_delivered * CoûtEntretien + bonus_mécanisme - coût_stockage_annuel`
- Le choix exact du mécanisme doit être expliqué dans `plan.md` et paramétré dans le script.

## 5) Contraintes à respecter dans l’optimisation

### 5.1 Compatibilité parcelle ↔ turbine (capacité par diamètre D)

- On construit la matrice `cap[p][D]` depuis le tableau du PDF.
- On mappe `turbines[t].D_m` vers un diamètre discret `D ∈ {200,150,135,120,110,80,60,50,30}` :
  - soit parce que `D_m` des rapports est exactement l’un de ces chiffres,
  - soit en “nearest rounding” vers la classe la plus proche (avec validation).
- La capacité max pour une turbine `t` sur une parcelle `p` :
  - `cap_max[p,t] = cap[p][D_class(t)]`.
- Si `cap_max[p,t] == 0` alors l’option est interdite.

### 5.2 Un seul type par parcelle

- La décision par parcelle est un choix d’option `o` qui contient :
  - `type_id`,
  - `theta`,
  - `n` (nombre d’éoliennes).
- Aucun mélange de types sur la même parcelle.

### 5.3 Budget global

- `sum(option.cost_total) <= 600_000_000`.
- `option.cost_total = n * turbines[type_id].price_eur` (et éventuellement ajouts si stockage/offshore demande un supplément distinct).

### 5.4 ROI max 20 ans (par parcelle)

- Calcul ROI selon la formule du PDF :
  - `RSI = Price_eol_totale_par_parcelle / (Prod_par_an * PrixRachat - Cout)`
- Où :
  - `Prod_par_an` est l’énergie annuelle livrée (MWh/an),
  - `Cout` = entretien annuel.
- Contrainte : `RSI <= 20`.
- En pratique :
  - si `Cout = Prod_par_an * CoûtEntretien`, on obtient `RSI = n*price / (Prod_par_an * (80-30))` (si on garde ce modèle).
- Le script doit exposer :
  - `buyback_price_eur_per_mwh`
  - `maintenance_cost_eur_per_mwh`
  - (optionnel) multiplicateur offshore pour l’entretien.

## 6) Algorithme d’optimisation (conseillé)

But : explorer l’espace de solutions tout en respectant les contraintes discrètes.

Discrétisation de la direction :

- Direction `theta` autorisée en `0..359`.
- Pour calculer efficacement, on discrétise `theta` :
  - option V1 : `theta` dans les 12 secteurs (pas de 30°), aligné avec la discrétisation de la météo.
  - option V2 : pas plus fin (ex: pas de 5°) si performances OK.

Étapes de calcul côté script :

1. Charger :
  - `turbines.json`
  - `wind_aggregated.json` (multi-années)
  - capacité parcelle `cap[p][D]`
2. Pour chaque parcelle `p` et turbine `t` compatible :
  - pré-calculer `E_t(p,theta)` pour chaque `theta` discrétisé,
  - en déduire le profit annuel `profit_t(p,theta,n=1)` et la ROI pour `n` variable.
3. Générer les “options” pour chaque parcelle :
  - chaque option = `(type_id, theta, n)` avec :
    - `cost_total`,
    - `E_delivered`,
    - `ROI`,
    - `profit_net_annuel` (ou `profit_net_sur_20ans` si on choisit une variante NPV).
  - filtrer les options qui violent :
    - `n <= cap_max[p,t]`
    - `ROI <= 20`
4. Optimisation globale :
  - variable binaire `x[p,o] ∈ {0,1}` = “choisir l’option o pour la parcelle p”
  - contrainte : somme `x[p,o] <= 1` (ou `==1` si on oblige de remplir, sinon inclure une option `o=none`).
  - contrainte : budget global.
  - objectif : maximiser la somme profit_net (ou maximiser l’énergie si on veut rester aligné avec le scoring d’origine).

Résolution :

- V1 (rapide à implémenter) : greedy + recherche locale (meilleur compromis si pas de dépendances).
- V2 (plus propre) : MILP/CP-SAT avec OR-Tools si on peut ajouter une dépendance python dans `phase2/requirements` (ou au niveau projet).

## 7) Script `phase2/optimisation.py` (livrable)

Interface CLI :

- `python phase2/optimisation.py --scenario 1 --output public/generated/optimisation_result.json`
- arguments utiles :
  - `--constraint-set` (implantation 1..7 si les contraintes changent)
  - `--theta-step` (par défaut 30°)
  - `--use-storage-mode {none,penalty,storage_simple}`

Sorties attendues (JSON) :

1. `optimisation_result.json` :
  - `scenario`
  - `objective_model_version`
  - `summary` :
    - `total_cost_eur`
    - `budget_limit_eur`
    - `total_energy_mwh_per_year` (ou total sur 24 ans)
    - `total_profit_eur_per_year`
    - `roi_min_years` / `roi_max_years`
  - `placements[]` :
    - `parcel_id`
    - `type_id`
    - `install_kind`
    - `theta_deg`
    - `n_turbines`
    - `capacity_max`
    - `energy_mwh_per_year`
    - `cost_total_eur`
    - `roi_years`
    - `feasible: true/false`
2. `optimisation_map.json` (optionnel) :
  - structure optimisée pour le rendu côté React.

Sorties optionnelles :

- un rendu image `public/generated/optimisation_map.png` si on veut un export rapide.

## 8) Frontend : page “optimisation”

Routage :

- Ajout d’un lien dans `src/components/Navbar.tsx` vers `/optimisation`.
- Ajout d’une route dans `src/App.tsx`.

Composant page :

- Nouveau fichier : `src/pages/Optimisation.tsx`.

UX attendue :

1. En-tête :
  - titre “Optimisation”
  - boutons : “Charger résultat”, “Rafraîchir calcul” (si endpoint API), “Exporter”.
2. Résumé (3-5 cartes) :
  - budget utilisé / budget max
  - production totale (MWh/an)
  - profit net total (€/an)
  - ROI min/max sur les parcelles utilisées
3. Grille parcelles :
  - réutiliser la grille `19x12` style `AnalyseMeteo` mais en ne colorant que les `20` parcelles autorisées.
  - sur chaque parcelle sélectionnée :
    - badge du type (`Eolienne X`)
    - indication `n` (nombre)
    - orientation (petite flèche/rotation visuelle)
4. Panneau de détails :
  - clic sur une parcelle → affiche :
    - type, n, theta
    - énergie annuelle, coût total, ROI
    - explication courte (ex: “option choisie car meilleur profit/ROI pour cette parcelle sous contrainte budget”).
5. Table récap (utile pour vérification) :
  - colonnes : `Parcelle | Type | n | theta | Capacité max | Coût | Energie | ROI | Feasible`

Chargement données :

- V1 : fetch statique de `/generated/optimisation_result.json`.
- V2 : appel à un endpoint API (si on ajoute `/api/optimisation/run`) renvoyant le JSON.

Design :

- Reprendre les patterns existants :
  - container max largeur `max-w-7xl`
  - classes “glass-card”
  - typographie “font-display”
  - disposition “grid gap-6 …”.

## 9) Backend / API (option recommandé)

Pourquoi :

- Permettre un clic “Rafraîchir calcul” sans re-build manuelle.

Implémentation proposée :

- Ajouter dans `backend/main.py` un endpoint :
  - `POST /api/optimisation/run` (ou `GET /api/optimisation/result` après calcul)
- L’endpoint appelle :
  - `python phase2/optimisation.py --scenario ...`
- Le calcul peut être :
  - synchrone (si rapide)
  - ou asynchrone avec cache (si lent).

Fichiers produits :

- Endpoint renvoie directement le JSON ou renvoie un URL de chargement.

## 10) Validation & tests

Tests unitaires (python) :

- Vérifier que chaque placement :
  - respecte `n <= cap_max[p,t]`
  - a `ROI <= 20` (avec la formule choisie)
  - calcule un coût cohérent avec `n*price`.
- Vérifier budget global.
- Vérifier “1 type par parcelle” (structure des placements).

Tests “sanity” :

- Si on désactive l’option stockage/intermittence, le modèle doit redevenir monotone : plus de turbines (si ROI/budget autorisent) → énergie et profit augmentent.

Tests UI (si le projet a déjà une infra) :

- rendu grille et table : le nombre de lignes correspond au nombre de placements.

## 11) Milestones (ordre d’implémentation conseillé)

1. Écrire `phase2/data/turbines.json` (au minimum : `D`, `prix`, `install_kind`, et un `P(V)` exploitable).
2. Écrire loader météo multi-années depuis `phase2/data/Data brut/Groupe*.zip` et créer `phase2/data/wind_aggregated.json` sur l'ensemble des années disponibles.
   - Utiliser ensuite cette distribution multi-années dans le calcul de production.
3. Implémenter `phase2/optimisation.py` avec :
  - modèle production + ROI + budget,
  - génération d’options,
  - optimisation globale (V1 greedy/local search).
4. Produire `public/generated/optimisation_result.json` et valider manuellement la cohérence.
5. Créer `src/pages/Optimisation.tsx`, brancher route + navbar, et brancher un chargement sur le JSON généré.
6. Optionnel :
  - ajouter l’endpoint FastAPI,
  - améliorer l’algorithme (OR-Tools) si V1 ne converge pas assez.

