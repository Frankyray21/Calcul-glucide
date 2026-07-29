# 🧮 Glucides Nets — Calculateur pour pompe à insuline

Application web simple pour calculer les **glucides nets** d'un repas, conçue pour les personnes vivant avec le **diabète de type 1** qui utilisent une **pompe à insuline**.

## Utilisation

Ouvrez simplement `index.html` dans un navigateur (téléphone, tablette ou ordinateur). Aucune installation ni connexion Internet requise — tout fonctionne localement.

1. Entrez les valeurs de l'étiquette nutritionnelle de chaque aliment (glucides, fibres, polyols).
2. Ajustez la portion si vous mangez plus ou moins que la portion de l'étiquette.
3. Ajoutez chaque aliment au repas.
4. Le **total à entrer dans la pompe** s'affiche en gros en bas de l'écran.

## Formule de calcul

```
Glucides nets = Glucides totaux − Fibres − (Polyols ÷ 2)
```

- **Fibres** : au Canada et aux États-Unis, les fibres sont incluses dans les glucides totaux de l'étiquette. Comme elles n'affectent pas la glycémie, elles sont soustraites à 100 %.
- **Polyols** (sucres-alcools : maltitol, sorbitol, xylitol…) : absorbés à environ 50 %, on soustrait donc la moitié.
- **Érythritol** : non absorbé, soustrait à 100 % (choisir « Érythritol » dans le menu).

## Fonctionnalités

- 🍽️ Composition d'un repas avec plusieurs aliments
- ⚖️ Ajustement de portion (règle de trois automatique)
- ⭐ Favoris enregistrés localement pour les aliments fréquents
- 💾 Le repas en cours est conservé même si la page est fermée (localStorage)
- 🌙 Mode sombre automatique
- 📱 Interface pensée pour le téléphone

## ⚠️ Avertissement

Cet outil est une **aide au calcul seulement**. Il ne remplace pas l'avis de votre équipe de soins en diabète. Vérifiez toujours les valeurs entrées dans votre pompe et suivez les recommandations de votre professionnel de la santé.
