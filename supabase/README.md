# Synchronisation entre appareils — mise en place

L'app fonctionne sans rien de tout ceci : sans compte, tout reste sur
l'appareil. Ce dossier ne sert qu'à activer la synchronisation.

## 1. Créer le projet

Sur [supabase.com](https://supabase.com), nouveau projet.

**Choisis la région `Canada (Central)`.** Ce sont des données de santé :
les garder au Canada évite les obligations de communication hors Québec
prévues par la Loi 25. La région ne se change pas après coup.

## 2. Créer les tables

Éditeur SQL → colle le contenu de [`schema.sql`](schema.sql) → *Run*.

Le fichier est **idempotent** : le relancer après une modification ne
casse rien et ne perd aucune donnée.

Il crée cinq tables (`profiles`, `recipes`, `favorites`, `entries`,
`lessons`), le bucket privé `meal-photos`, et surtout les politiques
**Row Level Security** : c'est la base elle-même qui empêche un compte de
lire les lignes d'un autre. L'application n'a aucun moyen de contourner
ça, même modifiée.

## 3. Régler l'authentification

*Authentication → Providers* : garde **Email** actif, désactive
« Confirm email » seulement si tu veux tester vite (à réactiver ensuite).

*Authentication → URL Configuration* : ajoute l'adresse du site dans
**Redirect URLs**, sinon le lien reçu par courriel ne ramènera nulle part :

```
https://frankyray21.github.io/Calcul-glucide/
```

## 4. Brancher l'app

*Project Settings → API*, copie deux valeurs dans l'onglet **Plus** de
l'app, section « Compte et synchronisation » :

| Valeur | Où la trouver |
|---|---|
| **Project URL** | `https://xxxx.supabase.co` |
| **anon public** | la clé `anon`, **jamais** la clé `service_role` |

La clé `anon` est faite pour vivre dans une page web : seule elle ne donne
accès à rien, c'est RLS qui décide. La clé `service_role` contourne RLS —
si elle se retrouve dans le navigateur, n'importe qui peut lire les
données de tous les comptes. Ne la copie nulle part.

## Vérifier que l'isolation tient

Le schéma a été testé sur PostgreSQL 16 avec deux comptes :

| Vérification | Résultat |
|---|---|
| Bob lit les recettes d'Alice | 0 ligne |
| Bob lit le journal d'Alice | 0 ligne |
| Bob insère une ligne au nom d'Alice | refusé par la base |
| Bob modifie / supprime en masse | 0 ligne touchée |
| `updated_at` envoyé par le client (an 2050) | remplacé par l'heure du serveur |
| Alice dépose une photo dans le dossier de Bob | refusé par la base |
| Bob liste les photos d'Alice | 0 objet |

Pour les rejouer toi-même sur un PostgreSQL local — jamais sur le projet
Supabase :

```sh
createdb essai
psql -d essai -f test-stub.sql   # recrée ce que Supabase fournit
psql -d essai -f schema.sql
psql -d essai -f isolation.sql
psql -d essai -f storage.sql
```

## Ce que ça implique

Tant que l'app reste privée (toi et ta famille), les obligations légales
sont légères. **Le jour où tu ouvres l'inscription à d'autres familles**,
tu héberges des données de santé de tiers : politique de confidentialité,
consentement explicite, droit d'accès et d'effacement, registre des
incidents de confidentialité, personne responsable désignée (Loi 25 au
Québec, LPRPDE au fédéral).

Le droit à l'effacement est déjà là — `delete_my_account()` supprime le
compte et tout ce qui s'y rattache — mais un bouton ne remplace pas les
autres obligations.
