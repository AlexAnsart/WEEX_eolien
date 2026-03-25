# Méthode d'optimisation - Phase 2

Ce document explique la logique de `phase2/optimisation.py`.

## 1. But de la méthode

L'objectif est de choisir, pour les parcelles autorisées par le `constraint-set`, une implantation d'éoliennes qui maximise le profit annuel, tout en respectant les contraintes du sujet. Le budget global ne doit pas dépasser 600 M€, le ROI par parcelle doit rester inférieur ou égal à 20 ans, le nombre d'éoliennes par parcelle est limité selon le diamètre de rotor, la compatibilité terre/mer doit être respectée (pas d'offshore sur terre, pas de terrestre en mer), et une seule technologie d'éolienne est autorisée par parcelle.

Le script produit principalement deux sorties. La première est `public/generated/optimisation_result.json`, qui contient le résultat final d'optimisation. La seconde est `phase2/data/wind_aggregated.json`, qui conserve les données météo agrégées pour assurer la traçabilité des calculs.

---

## 2. Données utilisées

## 2.1 Catalogue d'éoliennes

Le catalogue d'éoliennes est lu depuis `phase2/data/turbines.json`. Les champs utilisés sont l'identifiant (`id`), le type d'installation (`install_kind`), le coût (`price_eur`) et le diamètre (`D_m`), ainsi que les paramètres de la courbe de puissance (`rated_power_mw`, `cut_in_mps`, `rated_speed_mps`, `cut_out_mps`).

Un point de contrôle est appliqué sur le diamètre. La valeur `D_m` doit appartenir strictement aux classes du tableau de capacité (`{200, 150, 135, 120, 110, 80, 60, 50, 30}`). Si ce n'est pas le cas, le script s'arrête avec une erreur afin d'éviter une incohérence entre les turbines testées et les capacités maximales autorisées.

## 2.2 Données météo

La source météo unique est l'ensemble des archives `phase2/data/Data brut/Groupe*.zip`. Le script parcourt tous les ZIP, lit les fichiers au format `XXL_YYYY.txt`, conserve uniquement les 20 parcelles autorisées et vérifie qu'à chaque année correspondent bien les 20 parcelles attendues. Dans l'état actuel, la période exploitée va de 1995 à 2018.

---

## 3. Contraintes physiques et d'implantation

## 3.1 Capacité max par parcelle

La matrice de capacité (`CAPACITY_BY_PARCEL`) est codée dans le script à partir du tableau de la Mission 2. Le principe est direct: pour une parcelle donnée, le diamètre de la turbine détermine immédiatement la capacité maximale autorisée, et cette capacité borne la valeur de `n` (nombre d'éoliennes) dans les options testées.

## 3.2 Compatibilité offshore/terrestre

Le script déclare explicitement les parcelles marines (zones bleues): `{"7C", "8C", "8H", "14J", "15J"}`. La règle de compatibilité est ensuite appliquée de façon stricte: une parcelle marine n'accepte que des éoliennes offshore, tandis qu'une parcelle terrestre n'accepte que des éoliennes terrestres.

## 3.3 Contrainte avifaune (Contrainte 1)

Le script gère deux jeux de contraintes via l'argument `--constraint-set`:

- `constraint-set=1`: configuration de base (20 parcelles de la mission 2).
- `constraint-set=2`: même configuration avec exclusion des parcelles en zone de protection avifaune.

Dans l'implémentation actuelle, les parcelles suivantes sont exclues pour `constraint-set=2` :

- `4E`, `3J`, `16E`, `18F`, `18G`, `18H`

## 3.4 Contrainte transport terrestre (cumulative)

Les parcelles terrestres sont maintenant filtrées par une contrainte d'accessibilité routière, en plus des contraintes existantes.

Les paramètres sont lus dans `phase2/data/transport_constraints.json` et appliqués uniquement aux éoliennes terrestres :

- Distance camion ↔ champ: au moins un accès à moins de `500 m`.
- Rayon de braquage: on calcule `R = E / sin(a)` avec `a = 40°` et `E = longueur de pale`.
- Ponts: le poids estimé du convoi doit rester inférieur à la limite de tonnage du pont, si une limite existe.

La longueur de pale est estimée par `D_m / 2` (diamètre rotor / 2), et le poids du convoi est estimé via un modèle simple paramétrable (`base_mass_t` + facteur par mètre de pale) dans le même fichier JSON.

Si une option terrestre ne respecte pas une de ces conditions, elle n'est pas générée dans la liste des options candidates avant l'optimisation globale.

### 3.4.1 Protocole de mesure des cartes transport

Pour rendre la contrainte traçable, les valeurs ne sont plus codées "à la main" directement dans `transport_constraints.json`.

- Les mesures brutes sont centralisées dans `phase2/data/transport_measurements.json`.
- Chaque map (`MAP_*.png`) possède :
  - `scale_bar_px` : longueur en pixels de la barre 0-2 km.
  - par parcelle : `distance_px`, `min_curve_radius_px`, `bridge_limit_t`.
- La conversion est faite automatiquement par `phase2/build_transport_constraints.py` :
  - `meter_per_pixel = 2000 / scale_bar_px`
  - `distance_to_access_road_m = distance_px * meter_per_pixel`
  - `min_curve_radius_m = min_curve_radius_px * meter_per_pixel`
- Le script régénère `phase2/data/transport_constraints.json` avec :
  - les valeurs converties en mètres,
  - une section `traceability_by_parcel` (map source, échelle, mesures px).

Cette étape permet de justifier chaque valeur de contrainte par la carte d'origine et de recalculer facilement si les mesures sont affinées.

---

## 4. Comment la météo sur 20 ans est utilisée

Le calcul ne se fait pas sur une seule année brute.  
On construit d'abord une distribution de vent par parcelle en agrégeant toutes les années.

## 4.1 Construction de la distribution

Pour chaque parcelle, la distribution est construite avec un binning discret en vitesse (pas de 0,5 m/s) et en direction (secteurs de 30°). Chaque bin stocke un effectif (`count`) et une probabilité (`probability`). Cette étape fournit une signature météo de long terme, plus robuste qu'une estimation basée sur une seule année.

## 4.2 Énergie attendue d'une turbine

Pour une turbine `t` et un angle d'implantation `theta`:

`E_base(theta) = somme_bins( P_t(V_eff) * Pr(bin) * 8760 )`

Dans cette expression, `Pr(bin)` est la probabilité du bin, `V_eff` est la vitesse effective corrigée par le désalignement angulaire, et `P_t` est la puissance de la turbine pour cette vitesse. La somme pondérée sur tous les bins permet ainsi d'obtenir une énergie annuelle moyenne attendue.

---

## 5. Modèle de production

## 5.1 Effet de la direction

Le script calcule l'écart angulaire `delta` entre la direction du vent et l'orientation du champ. Il applique ensuite un facteur directionnel défini par `f(delta) = max(0, cos(delta))^p`, avec `p = 1.8` comme paramètre de sensibilité. La vitesse effective est alors donnée par `V_eff = V * f(delta)`, ce qui pénalise naturellement les situations de désalignement.

## 5.2 Courbe de puissance turbine (simplifiée)

La courbe de puissance est modélisée par morceaux. La puissance est nulle sous `cut_in` et au-dessus de `cut_out`, elle atteint la puissance nominale à partir de `rated_speed`, et une interpolation cubique est utilisée entre `cut_in` et `rated_speed` pour décrire la montée en charge.

## 5.3 Effet du nombre d'éoliennes (proxy sillage)

L'effet de sillage est pris en compte via un facteur de perte simplifié: `wake_factor(n) = max(floor, 1 - alpha*(n-1))`, avec `alpha = 0.0022944` (calibré pour coller au modèle de calcul du site) et `floor = 0.70`. L'énergie associée à une option est ensuite calculée par `E_option = n * E_base(theta) * wake_factor(n)`, ce qui reflète à la fois l'augmentation du nombre de turbines et la dégradation progressive du rendement unitaire.

---

## 6. Modèle économique et filtre ROI

Pour une option `(parcelle, turbine, theta, n)`, le coût d'investissement est `cost = n * price_eur`, le revenu annuel est `annual_revenue = E_option * 80`, la maintenance annuelle est `annual_maintenance = E_option * 30`, le profit annuel est `annual_profit = annual_revenue - annual_maintenance`, et le retour sur investissement est `ROI = cost / annual_profit`.

Une option n'est conservée que si trois conditions sont simultanément satisfaites: `annual_profit > 0`, `ROI <= 20`, et `n` ne dépasse pas la capacité maximale de la parcelle pour le diamètre considéré.

---

## 7. Optimisation globale sous budget

Le problème final est résolu par programmation dynamique, sous une forme proche d'un knapsack multi-étapes. L'idée est de traiter les 20 parcelles autorisées séquentiellement: pour la parcelle `i`, on choisit exactement une option parmi une liste d'alternatives candidates (turbine + angle `theta` + nombre `n`), ou bien l'option "none" qui signifie “ne rien installer”. Le critère à maximiser est la somme des profits annuels nets (`profit_net_eur_per_year`) de toutes les parcelles.

Avant de lancer la programmation dynamique, les options par parcelle sont déjà préparées dans le code via `build_options_for_parcel(...)`. Pour chaque parcelle, le code filtre d'abord les combinaisons incohérentes (compatibilité terrestre/offshore, cohérence capacité max par diamètre) puis énumère toutes les turbines compatibles. Pour chaque turbine, il parcourt tous les angles `theta` possibles (de `0` à `360` par pas `cfg.theta_step_deg`) et toutes les tailles `n` possibles jusqu’à la capacité maximale (`cap_max`). Pour chaque triple `(turbine, theta, n)`, l’énergie annuelle par turbine est calculée puis mise à l’échelle par `n` et pénalisée par le sillage via `wake_factor(n)`. À partir de cette énergie, le code calcule `cost_total_eur`, `annual_revenue`, `annual_maintenance`, puis `annual_profit` et enfin le `roi = cost / annual_profit`. Une option n’est ajoutée à la liste que si `annual_profit > 0` et `roi <= cfg.roi_limit_years`. Enfin, la liste est triée par profit décroissant (et, en cas d’égalité, par coût décroissant) puis tronquée à un maximum `cfg.max_options_per_parcel` afin de limiter le coût computationnel de la DP.

La contrainte budgétaire est ensuite gérée par discrétisation. Dans `Config`, le budget maximal est `cfg.budget_limit_eur = 600_000_000` et la quantification vaut `cfg.budget_quantization_eur = 100_000`. Le nombre d’états budgétaires est donc `budget_steps = budget_limit_eur // budget_quantization_eur` (dans ce cas 6000). La DP travaille avec un indice `b` qui représente un budget “discrétisé”, et non pas un montant exact. Très important: pour chaque option candidate, son coût discrétisé est calculé par `c = int(opt["cost_total_eur"] // cfg.budget_quantization_eur)` (division entière). L’algorithme impose ensuite `nb = b + c <= budget_steps`. Cela garantit la contrainte au niveau de la grille discrète, avec un léger effet d’approximation dû au `//` (les coûts sont arrondis vers le bas avant d’être additionnés).

Dans `optimize_global(...)`, la programmation dynamique maintient un tableau 1D `dp` de taille `budget_steps + 1`. La signification de `dp[b]` est: “profit annuel maximal atteignable après avoir traité un certain nombre de parcelles, en consommant un budget discrétisé égal à l’indice `b`”. Le tableau est initialisé avec une valeur très négative (`-1e30`) pour représenter “impossible”, puis `dp[0] = 0.0` (on commence avec 0 parcelle traitée et 0 budget consommé). Pour reconstruire ensuite le scénario, deux tableaux 2D sont alloués: `choice[i][nb]` stocke l’indice de l’option choisie pour la parcelle `i` lorsqu’on arrive au budget `nb`, et `previous_budget[i][nb]` stocke l’indice de budget précédent `b` ayant permis cette transition.

Les options traitées pour chaque parcelle sont dans `all_options[parcel]`. Ce dictionnaire est construit en préfixant la liste de candidats par une option “none” de coût total `0` et de profit annuel `0.0`, marquée par `{"none": True}`. Concrètement, cela garantit que la DP peut toujours décider de ne rien prendre pour une parcelle, et que le résultat final respectera “au plus une option par parcelle” (car on choisit une seule option par transition).

La transition DP se fait ensuite en boucles imbriquées. Pour chaque parcelle `i` (ordre donné par la liste des parcelles autorisées du `constraint-set` actif), on crée un tableau `nxt` initialisé avec `-1e30`. Puis pour chaque indice budget `b`, si `dp[b]` est invalide on passe. Sinon, on teste toutes les options `opt` de `all_options[parcel]`. Pour chaque option, on calcule son coût discrétisé `c` puis le nouvel indice `nb = b + c`. Si `nb` dépasse `budget_steps`, on ignore l’option. Sinon, le profit candidat vaut `v = dp[b] + float(opt["profit_net_eur_per_year"])`. Si `v` améliore la meilleure valeur connue pour `nxt[nb]`, alors `nxt[nb]` est mis à jour, et on mémorise pour cette amélioration `choice[i][nb] = opt_idx` et `previous_budget[i][nb] = b`. Après avoir parcouru toutes les options, on remplace `dp = nxt` et on passe à la parcelle suivante.

Une fois toutes les parcelles traitées, l’algorithme ne force pas l’utilisation du budget maximal: il choisit simplement le budget discrétisé `end_budget` qui maximise `dp[b]` (donc le profit annuel total le plus élevé parmi tous les budgets autorisés par la grille). On récupère alors une solution faisable en reconstruisant le choix optionnel à rebours.

La reconstruction (backtracking) part de `b = end_budget` et parcourt les parcelles de la dernière à la première. À l’étape `i`, on lit `opt_idx = choice[i][b]`. Si `opt_idx < 0`, cela signifie qu’on n’a pas défini de choix valide pour cet état et on ignore. Sinon, on récupère l’option correspondante dans `all_options[parcels[i]][opt_idx]`. Si l’option est `none`, on ne l’ajoute pas à la liste `selected`; sinon, on ajoute l’option (turbine, `theta`, `n`, coût et profit) à la solution. Enfin, on remonte vers l’état précédent en faisant `b = previous_budget[i][b]` (avec une garde `if b < 0: b = 0` pour éviter des indices négatifs). À la fin, `selected` est inversé pour retrouver l’ordre des parcelles.

Cette construction garantit automatiquement deux propriétés: au plus une option est choisie par parcelle (car on fait exactement une transition par parcelle), et un budget global compatible avec la contrainte discrétisée (au niveau de la grille discrète, compte tenu de l’arrondi vers le bas `//`).

---

## 8. Rôle de `wind_aggregated.json`

Ce fichier sert principalement à tracer et contrôler l'agrégation météo, ainsi qu'à faciliter les vérifications et la visualisation. Le cœur de l'optimisation n'utilise ensuite que la distribution reconstruite en mémoire.

---

## 9. Limites connues et interprétation

La méthode est cohérente avec le sujet et robuste sur 20 ans, mais elle reste un modèle d'ingénierie simplifié. En particulier, la courbe `P(V)` n'est pas une courbe constructeur complète, le modèle de sillage est volontairement simplifié et la pénalisation directionnelle repose sur un paramétrage explicite.

En contrepartie, cette approche est explicable, rapide à exécuter et suffisamment stable pour comparer des scénarios d'implantation de façon reproductible.
