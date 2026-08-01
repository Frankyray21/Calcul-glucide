# 🧮 Glucides Nets — Calculateur pour pompe à insuline

Application web simple pour calculer les **glucides nets** d'un repas, conçue pour les personnes vivant avec le **diabète de type 1** qui utilisent une **pompe à insuline**.

## Utilisation

Ouvrez simplement `index.html` dans un navigateur (téléphone, tablette ou ordinateur). Le cœur de l'app fonctionne entièrement localement, sans connexion. Deux fonctions optionnelles demandent un accès réseau ou HTTPS : le scan de code-barres (Open Food Facts) et l'installation en PWA.

### 🌐 Site en ligne

L'app est publiée à l'adresse : **https://frankyray21.github.io/Calcul-glucide/**

### 📱 Installer comme une vraie app (PWA)

Ouvrez le site sur votre téléphone puis choisissez **« Ajouter à l'écran d'accueil »** — l'app s'installe avec son icône, s'ouvre en plein écran et fonctionne **hors ligne** (service worker).

Le site est servi par GitHub Pages depuis la branche `gh-pages`; le workflow `.github/workflows/pages.yml` la synchronise automatiquement à chaque poussée sur `main`.

## Onglets

### 🍽️ Repas
1. **📷 Scannez le code-barres** d'un produit emballé — nom, glucides, fibres et polyols sont récupérés automatiquement depuis **Open Food Facts** (Internet requis; saisie manuelle du code possible si la caméra n'est pas disponible).
2. Ou cherchez un aliment dans la **base intégrée** (valeurs par 100 g), ou entrez les valeurs de l'étiquette.
3. Ajustez la portion (règle de trois automatique) et ajoutez au repas — le **total à entrer dans la pompe** s'affiche en gros en bas de l'écran.
4. Cochez « Enregistrer dans mes favoris » pour vos aliments fréquents.
5. Quand le repas est terminé : **✅ Enregistrer au journal**.

### 📖 Recettes
- **⭐ Recettes populaires intégrées** : 14 plats courants (spaghetti sauce à la viande, pâté chinois, tourtière, poutine, macaroni au fromage, chili, sushi…) avec valeurs moyennes par 100 g issues des plats composés USDA/FCÉN — touchez, entrez le poids de la portion, c'est ajouté au repas. Votre version maison peut différer : pour un calcul exact, utilisez la recette par ingrédients.
- **🧑‍🍳 Recette par ingrédients** : ajoutez chaque ingrédient pesé (depuis la base ou à la main), indiquez le poids final du plat cuit, et l'app calcule elle-même les valeurs par 100 g (en tenant compte de l'évaporation à la cuisson).
- Créez vos recettes avec **photo** (prise directement avec la caméra, compressée et stockée localement).
- Chaque carte affiche les **g nets / 100 g** et les **g nets par gramme**.
- Au repas : touchez la recette, entrez le **poids de votre portion**, c'est calculé et ajouté automatiquement.
- **📤 Partagez** une recette par le menu de partage du téléphone (ou copie dans le presse-papiers).

### 📈 Outil interactif
- **Relation glucides ↔ grammes** : choisissez un aliment ou une recette, glissez le curseur (ou touchez le graphique) pour voir les glucides nets de 0 à 500 g.
- Tableau des portions courantes (50 à 250 g).
- **Calcul inverse** 🎯 : entrez une cible en glucides nets et l'app indique le poids exact à servir.

### 📅 Journal
- Chaque repas enregistré est daté et listé par jour, avec le total quotidien.
- **Graphique des 7 derniers jours** (glucides nets par jour) et moyenne par jour actif — utile pour les rendez-vous en clinique du diabète.
- **↻ Rechargez** un repas passé en un geste (pratique pour les repas récurrents).
- **💾 Export / import** : sauvegardez toutes vos données (recettes, favoris, journal) dans un fichier JSON pour les transférer sur un autre appareil.

## Design et onboarding

- **Direction artistique** : style coloré et convivial (inspiré de mySugr), jamais clinique. Vert de marque `#16A34A` pour le décor et les gros éléments; `#15803D` pour les textes colorés et boutons (contraste WCAG AA vérifié); accent chaud ambre pour le bandeau hors ligne. Le compteur principal reste en **encre neutre à fort contraste (AAA)** — la couleur ne porte jamais un avis médical.
- **Ton** : français québécois, chaleureux et direct, tutoiement partout.
- **Onboarding** (premier lancement) : 4 écrans en moins de 90 s — bienvenue, comment ça marche, **avertissement médical obligatoire et bloquant** (case à cocher + « J'ai compris », stocké localement, jamais réaffiché), puis préparation hors ligne avec barre de progression déterminée. Les écrans de présentation se sautent; l'avertissement, non.
- **Permission caméra juste-à-temps** : jamais demandée au démarrage — un écran d'amorce explique le bénéfice au moment du premier scan de code-barres.
- **Installation PWA après engagement** : la bannière n'apparaît qu'après le premier aliment ajouté au repas (l'événement `beforeinstallprompt` est capturé et gardé; sur iOS, instructions manuelles).
- **Accessibilité** : corps de texte à 17 px (jamais sous 16 px), cibles tactiles d'au moins 48 px (utilisables avec des gants), gros boutons − / + pour les portions, `:focus-visible`, `aria-live="polite"` sur le compteur et les toasts, `prefers-reduced-motion` respecté, mode sombre automatique, jamais la couleur seule pour un état (toujours icône ou libellé).

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
- Le scan de code-barres interroge **Open Food Facts**, base collaborative mondiale de produits alimentaires. Les données proviennent des étiquettes soumises par la communauté : vérifiez-les contre l'étiquette réelle du produit.
- Pour un produit emballé, **l'étiquette du produit réel a toujours priorité** sur toute base de données (les recettes varient d'une marque à l'autre et changent avec le temps).

## Vie privée

Toutes les données (repas, favoris, recettes, photos) sont stockées **localement** dans le navigateur (localStorage). Rien n'est envoyé sur Internet.

## ⚠️ Avertissement

Cet outil est une **aide au calcul seulement**. Il ne remplace pas l'avis de votre équipe de soins en diabète. Vérifiez toujours les valeurs entrées dans votre pompe et suivez les recommandations de votre professionnel de la santé.
