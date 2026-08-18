# 🧮 Glucides Nets — Calculateur pour pompe à insuline

Application web simple pour calculer les **glucides nets** d'un repas, conçue pour les personnes vivant avec le **diabète de type 1** qui utilisent une **pompe à insuline**.

## Utilisation

Ouvre simplement `index.html` dans un navigateur (téléphone, tablette ou ordinateur). Le cœur de l'app fonctionne entièrement localement, sans connexion. Deux fonctions optionnelles demandent un accès réseau ou HTTPS : le scan de code-barres (Open Food Facts) et l'installation en PWA.

### 🌐 Site en ligne

L'app est publiée à l'adresse : **https://frankyray21.github.io/Calcul-glucide/**

### 📱 Installer comme une vraie app (PWA)

Ouvre le site sur ton téléphone puis choisis **« Ajouter à l'écran d'accueil »** — l'app s'installe avec son icône, s'ouvre en plein écran et fonctionne **hors ligne** (service worker). La bannière d'installation apparaît d'elle-même après ton premier aliment ajouté.

Le site est servi par GitHub Pages depuis la branche `gh-pages`; le workflow `.github/workflows/pages.yml` la synchronise automatiquement à chaque poussée sur `main`.

## Navigation

Barre du bas à cinq destinations — **Accueil**, **Favoris**, **➕ Calculer** (bouton central en vedette), **Journal**, **Plus** :

- **🏠 Accueil** : profil actif (changement en un geste), résumé du repas en cours, **📤 partage du repas** (texto/courriel au parent, à la garderie ou à l'école — liste des aliments et total en glucides), actions rapides (scanner, chercher, favoris).
- **👥 Profils (onglet Plus)** : un compte gère plusieurs personnes (ton enfant, toi…). Chaque profil garde **ses propres repas, favoris, recettes et journal**, isolés sur l'appareil, avec prénom et allergies/intolérances affichées à l'accueil. L'outil interactif et l'à-propos vivent aussi dans Plus.
- La **fiche aliment** (maquette « Glucides calculés ») affiche en vedette le résultat calculé en direct pour la quantité entrée, un **cœur ♥ pour garder l'aliment en favori**, les raccourcis ½ / 1 / 2 portions / Perso., et la carte « Référence nutritionnelle » (par portion, par 100 grammes, par gramme).

## Onglets

### 🍽️ Repas
1. **📷 Scanne ou photographie un produit** — un seul bouton, et l'app **s'adapte à ce qu'elle voit** : un code-barres est détecté en direct (ou lu sur la photo, même via ses chiffres imprimés) → recherche **Open Food Facts**; un tableau de valeur nutritive → **lecture directement sur l'appareil** (OCR Tesseract embarqué, gratuit, sans compte ni clé — ~5 Mo téléchargés à la première analyse puis mis en cache, donc utilisable hors ligne ensuite), qui extrait glucides, fibres, polyols et portion des tableaux canadiens/américains/européens. Dans les deux cas s'ouvre une **fiche produit pleine hauteur** avec les glucides nets **par portion (en grand), par 100 g et par gramme**, et les raccourcis « ½ / 1 / 2 portions » — pensée pour évaluer vite les glucides au repas ou à la garderie. Saisie manuelle du code et import d'une photo existante possibles. En option, la **lecture IA Claude** (bouton ✨, clé API Anthropic personnelle) prend le relais pour les photos difficiles **et sait analyser une assiette ou un plat en photo** : chaque aliment détecté devient une carte modifiable (nom, poids estimé, glucides, et le **nombre d'unités** quand l'aliment se compte — « 4 biscuits », « 2 tranches » — sinon la mesure maison équivalente) avec le total estimé, à vérifier puis ajouter au repas d'un geste. Pour préciser l'estimation : une **fourchette honnête** (« entre 38 et 52 g ») accompagne chaque total; un **garde-fou de plausibilité** recoupe chaque aliment avec la base USDA/FCÉN intégrée et signale les valeurs improbables; un fil **« 💬 Discuter du résultat »** permet de parler de l'estimation sans quitter l'écran — **préciser** ce que l'IA n'a pas pu voir (« c'est du couscous, pas du riz », « la portion était plus grosse ») met aussitôt les cartes et le total à jour, et **comprendre** (« pourquoi ce total ? », « comment tu as estimé le poids ? ») fait expliquer le calcul chiffré sans rien modifier; l'IA y pose aussi **sa question de clarification** quand une seule précision changerait beaucoup le résultat (« Riz ou couscous ? »); un bouton permet d'ajouter une **photo sous un autre angle** (la vue de côté renseigne la hauteur des portions); et surtout l'app **retient tes corrections** : chaque fois que tu rectifies un aliment mal identifié, un poids ou une densité de glucides avant d'ajouter le repas, la leçon est mémorisée et redonnée à l'IA à chaque analyse suivante (« tu avais dit *petit-beurre*, c'était *Petit Écolier* », « tes poids sont trop bas d'environ 25 % pour cette personne »). Tu peux aussi **lui apprendre une consigne à la main** et **oublier une leçon** devenue fausse, dans l'onglet Plus. Enfin, à la fin du repas, la **photo des restes** soustrait ce qui n'a pas été mangé — les poids affichés deviennent ce qui a réellement été avalé, idéal pour un enfant qui ne finit pas son assiette. Dans tous les cas les valeurs sont des **estimations à vérifier**, corrigeables à la main.
2. Ou cherche un aliment dans la **base intégrée** (valeurs par 100 g), ou entre les valeurs de l'étiquette.
3. **🥄 Mesures maison** : sans balance (assiette, garderie), choisis le type d'aliment (liquide, riz/pâtes cuits, céréales, fruits coupés…) et touche une mesure — 1 c. à thé, 1 c. à soupe, ¼ à 1½ tasse (canadienne, 250 ml) — l'équivalent en grammes s'inscrit dans la quantité (approximations usuelles USDA/FCÉN; le choix du type est mémorisé).
4. Ajuste la portion (règle de trois automatique) et ajoute au repas — le **total à entrer dans la pompe** s'affiche en gros en bas de l'écran. La fiche d'un produit scanné affiche aussi sa **photo** (trouvée sur Open Food Facts) pour confirmer d'un coup d'œil que c'est le bon produit.
   - **Expiration automatique** : un repas commencé mais jamais enregistré est vidé de lui-même après **3 h sans nouvel ajout** (à l'ouverture de l'app), pour que les items du déjeuner ne faussent pas le total du souper. Un toast permet d'annuler le vidage.
4. Coche « Enregistrer dans mes favoris » pour tes aliments fréquents.
5. Quand le repas est terminé : **✅ Enregistrer au journal**.

### 📖 Recettes
- **⭐ Recettes populaires intégrées** : 14 plats courants (spaghetti sauce à la viande, pâté chinois, tourtière, poutine, macaroni au fromage, chili, sushi…) avec valeurs moyennes par 100 g issues des plats composés USDA/FCÉN — touche, entre le poids de la portion, c'est ajouté au repas. Ta version maison peut différer : pour un calcul exact, utilise la recette par ingrédients.
- **🧑‍🍳 Recette par ingrédients** : ajoute chaque ingrédient pesé (depuis la base ou à la main), indique le poids final du plat cuit, et l'app calcule elle-même les valeurs par 100 g (en tenant compte de l'évaporation à la cuisson).
- Crée tes recettes avec **photo** (prise directement avec la caméra, compressée et stockée localement).
- Chaque carte affiche les **g nets / 100 g** et les **g nets par gramme**.
- Au repas : touche la recette, entre le **poids de ta portion**, c'est calculé et ajouté automatiquement.
- **📤 Partage** une recette par le menu de partage du téléphone (ou copie dans le presse-papiers).

### 📈 Outil interactif
- **Relation glucides ↔ grammes** : choisis un aliment ou une recette, glisse le curseur (ou touche le graphique) pour voir les glucides nets de 0 à 500 g.
- Tableau des portions courantes (50 à 250 g).
- **Calcul inverse** 🎯 : entre une cible en glucides nets et l'app indique le poids exact à servir.

### 📅 Journal
- Chaque repas enregistré est daté et listé par jour, avec le total quotidien.
- **Graphique des 7 derniers jours** (glucides nets par jour) et moyenne par jour actif — utile pour les rendez-vous en clinique du diabète.
- **↻ Recharge** un repas passé en un geste (pratique pour les repas récurrents).
- **💾 Export / import** : sauvegarde toutes tes données (recettes, favoris, journal) dans un fichier JSON pour les transférer sur un autre appareil.

## Version de l'app

La version courante est **v2.9.2**, affichée dans le pied de page de l'app (`#app-version` dans `index.html`).

**Règle à chaque mise à jour publiée** : incrémenter le numéro aux **deux** endroits, sinon les utilisateurs installés gardent l'ancienne version en cache :
1. le pied de page d'`index.html` (`Glucides Nets vX.Y.Z`);
2. le nom du cache dans `sw.js` (`var CACHE = 'glucides-nets-vX.Y.Z'`) — c'est le changement de ce nom qui force le service worker à télécharger la nouvelle version.

## Design et onboarding

- **Direction artistique** : style coloré et convivial (inspiré de mySugr), jamais clinique. Bleu de marque `#2563EB` pour le décor et les gros éléments; `#1D4ED8` pour les textes colorés et boutons (contraste WCAG AA vérifié); mode sombre en bleu nuit (`#07111F`) avec bleu signal `#4D9FFF`; accent chaud ambre pour le bandeau hors ligne. Le compteur principal reste en **encre neutre à fort contraste (AAA)** — la couleur ne porte jamais un avis médical.
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
- Ces règles correspondent aux recommandations usuelles de **Diabète Canada** et de l'**American Diabetes Association** pour le calcul des glucides. Certaines équipes de soins recommandent de ne soustraire les fibres que lorsqu'elles dépassent 5 g par portion — suis la méthode enseignée par la tienne.

## Sources des données

- Les valeurs nutritionnelles de la base d'aliments intégrée proviennent de **USDA FoodData Central** (SR Legacy / Foundation Foods), cohérentes avec le **Fichier canadien sur les éléments nutritifs (FCÉN)** de Santé Canada. Elles sont exprimées par 100 g de l'aliment tel que décrit (cru ou cuit, précisé dans le nom).
- Le scan de code-barres interroge **Open Food Facts**, base collaborative mondiale de produits alimentaires. Les données proviennent des étiquettes soumises par la communauté : vérifie-les contre l'étiquette réelle du produit.
- Pour un produit emballé, **l'étiquette du produit réel a toujours priorité** sur toute base de données (les recettes varient d'une marque à l'autre et changent avec le temps).

## Vie privée

Toutes les données (repas, favoris, recettes, photos de recettes, clé API éventuelle) sont stockées **localement** dans le navigateur (localStorage). La lecture d'étiquette par défaut (OCR) se fait **entièrement sur l'appareil** — la photo ne quitte jamais le téléphone. Deux fonctions optionnelles font des appels réseau : le scan de code-barres interroge **Open Food Facts** (seul le code-barres est envoyé), et la lecture IA optionnelle envoie **la photo de l'étiquette à Anthropic** (avec ta clé API) uniquement au moment de l'analyse. Rien d'autre ne quitte l'appareil.

## ⚠️ Avertissement

Cet outil est une **aide au calcul seulement**. Il ne remplace pas l'avis de ton équipe de soins en diabète. Vérifie toujours les valeurs entrées dans ta pompe et suis les recommandations de ton professionnel de la santé.
