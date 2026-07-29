# 🧮 Glucides Nets — Calculateur pour pompe à insuline

Application web simple pour calculer les **glucides nets** d'un repas, conçue pour les personnes vivant avec le **diabète de type 1** qui utilisent une **pompe à insuline**.

## Utilisation

Ouvrez simplement `index.html` dans un navigateur (téléphone, tablette ou ordinateur). Aucune installation ni connexion Internet requise — tout fonctionne localement.

## Onglets

### 🍽️ Repas
1. Cherchez un aliment dans la **base intégrée** (valeurs par 100 g) ou entrez les valeurs de l'étiquette nutritionnelle.
2. Ajustez la portion si vous mangez plus ou moins que la portion de référence (règle de trois automatique).
3. Ajoutez chaque aliment au repas — le **total à entrer dans la pompe** s'affiche en gros en bas de l'écran.
4. Cochez « Enregistrer dans mes favoris » pour retrouver vos aliments fréquents en un clic.

### 📖 Recettes
- Créez vos recettes maison avec **photo** (prise directement avec la caméra du téléphone).
- Les stats sont enregistrées **par 100 g** : glucides, fibres, polyols — l'app affiche aussi les **g nets / 100 g** et les **g nets par gramme**.
- Au moment du repas : touchez la recette, entrez le **poids de votre portion**, et les glucides nets sont calculés et ajoutés au repas automatiquement.
- Astuce pour créer une recette : additionnez les glucides et fibres de tous les ingrédients, pesez le plat final, puis calculez par 100 g (total ÷ poids × 100).
- Les photos sont compressées (~480 px, JPEG) et stockées localement sur l'appareil.

### 📈 Outil interactif
- **Relation glucides ↔ grammes** : choisissez un aliment de la base ou une de vos recettes, puis glissez le curseur (ou touchez directement le graphique) pour voir les glucides nets correspondant à n'importe quel poids de 0 à 500 g.
- Tableau des portions courantes (50 à 250 g) avec glucides nets, glucides totaux et fibres.
- **Calcul inverse** 🎯 : entrez une cible en glucides nets (ex. : 30 g) et l'app indique le poids exact à servir — pratique pour peser une portion qui correspond au bolus voulu.

## Formule de calcul

```
Glucides nets = Glucides totaux − Fibres − (Polyols ÷ 2)
```

- **Fibres** : au Canada et aux États-Unis, les fibres sont incluses dans les glucides totaux de l'étiquette. Comme elles ne sont pas absorbées sous forme de glucose, elles sont soustraites.
- **Polyols** (sucres-alcools : maltitol, sorbitol, xylitol…) : absorbés à environ 50 %, on soustrait donc la moitié.
- **Érythritol** : non absorbé, soustrait à 100 % (choisir « Érythritol » dans le menu).
- Ces règles correspondent aux recommandations usuelles de **Diabète Canada** et de l'**American Diabetes Association** pour le calcul des glucides. Certaines équipes de soins recommandent de ne soustraire les fibres que lorsqu'elles dépassent 5 g par portion — suivez la méthode enseignée par la vôtre.

## Sources des données

- Les valeurs nutritionnelles de la base d'aliments intégrée proviennent de **USDA FoodData Central** (SR Legacy / Foundation Foods), cohérentes avec le **Fichier canadien sur les éléments nutritifs (FCÉN)** de Santé Canada. Elles sont exprimées par 100 g de l'aliment tel que décrit (cru ou cuit, précisé dans le nom).
- Pour un produit emballé, **l'étiquette du produit réel a toujours priorité** sur la base intégrée (les recettes varient d'une marque à l'autre).

## Vie privée

Toutes les données (repas, favoris, recettes, photos) sont stockées **localement** dans le navigateur (localStorage). Rien n'est envoyé sur Internet.

## ⚠️ Avertissement

Cet outil est une **aide au calcul seulement**. Il ne remplace pas l'avis de votre équipe de soins en diabète. Vérifiez toujours les valeurs entrées dans votre pompe et suivez les recommandations de votre professionnel de la santé.
