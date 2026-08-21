# Fabriquer la base d'aliments

`foods.json` est la base fouillée par la recherche de l'app. Elle est
téléchargée à la première recherche, puis mise en cache par le service
worker — donc utilisable hors ligne ensuite. Un noyau d'une quarantaine
d'aliments reste dans `index.html` : il doit répondre au tout premier
lancement, avant que `foods.json` ait pu arriver.

## Régénérer

```sh
python3 tools/build-foods.py            # depuis la liste curatée seule
```

## Passer à la base officielle

La vraie base est le **Fichier canadien sur les éléments nutritifs**
(FCÉN) de Santé Canada : noms français, plusieurs milliers d'aliments,
données publiques. Télécharge l'archive CSV depuis
[open.canada.ca](https://open.canada.ca), décompresse-la, puis :

```sh
python3 tools/build-foods.py --cnf chemin/vers/les/csv
```

Le script lit `FOOD NAME.csv` (identifiant + nom français) et
`NUTRIENT AMOUNT.csv` (nutriments 205 = glucides totaux, 291 = fibres).
Le FCÉN passe devant, la liste curatée comble ses manques, et les
doublons sont écartés.

## Ce que le script refuse

Une valeur aberrante ici devient un mauvais calcul de bolus chez
quelqu'un. Chaque entrée doit donc satisfaire :

- glucides entre 0 et 100 g par 100 g;
- fibres entre 0 et 100 g;
- **fibres ≤ glucides** — sur les étiquettes nord-américaines les fibres
  sont comprises dans les glucides totaux; au-delà, la soustraction des
  glucides nets donnerait un négatif;
- nom d'au moins deux caractères, unique après normalisation.

Tout ce qui échoue est écarté et listé en fin d'exécution. Un aliment
absent se voit et se corrige à la main; un aliment faux, non.

L'app applique les mêmes contrôles au chargement : un `foods.json`
remplacé ou tronqué ne peut pas introduire de valeur impossible.

## La liste curatée

`aliments-curated.tsv` — un aliment par ligne, séparé par des
tabulations : `nom`, `glucides`, `fibres`, pour 100 g. Les lignes vides
et celles commençant par `#` sont ignorées.

Ce sont des **valeurs de référence usuelles** (type USDA FoodData Central
/ FCÉN) rassemblées comme socle de dépannage, pas un extrait officiel.
Pour un produit emballé, l'étiquette a toujours priorité — l'app le dit
d'ailleurs sous la recherche.
