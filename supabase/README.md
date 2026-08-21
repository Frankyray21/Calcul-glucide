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

## 5. (Facultatif) Offrir la lecture IA à des invités

Par défaut, chaque personne doit fournir **sa propre clé API Anthropic**
pour l'analyse photo — compte développeur, carte de crédit, clé à copier.
Personne ne le fera à part toi.

Le proxy déplace la clé sur le serveur : les invités n'ont plus rien à
configurer. En échange, **c'est toi qui paies leurs analyses** (1 à 3 ¢
chacune), d'où la liste d'invités et les plafonds.

```sh
# 1. Les tables : liste d'invités, consommation, plafonds
#    (éditeur SQL → colle ai-proxy.sql → Run)

# 2. Ta clé, côté serveur — elle ne sort plus jamais de Supabase
supabase secrets set ANTHROPIC_API_KEY=sk-ant-…

# 3. La fonction
supabase functions deploy analyze
```

### Inviter quelqu'un

La personne doit d'abord **s'être connectée une fois** à l'app : c'est ce
qui crée son compte. Ensuite, dans l'éditeur SQL :

```sql
insert into public.ai_allowlist (user_id, note, monthly_cap)
select id, 'Grand-maman', 200 from auth.users
 where email = 'exemple@courriel.com';
```

Retirer quelqu'un sans perdre son historique :

```sql
update public.ai_allowlist set active = false
 where user_id = (select id from auth.users where email = '…');
```

Voir la consommation du mois :

```sql
select u.email, a.note, x.calls, a.monthly_cap
  from public.ai_usage x
  join auth.users u on u.id = x.user_id
  left join public.ai_allowlist a on a.user_id = x.user_id
 where x.month = to_char(now(), 'YYYY-MM')
 order by x.calls desc;
```

Il n'y a pas d'écran d'administration dans l'app, et c'est voulu : la
liste d'invités n'est **jamais** lisible ni modifiable depuis le
navigateur. Les deux tables ont RLS active et aucune politique — le rôle
`authenticated` n'y a strictement aucun accès. Seule la fonction Edge, qui
détient la clé `service_role`, les touche.

### Ce que la fonction refuse

Un invité ne doit pas pouvoir se servir de ta clé pour autre chose que
l'app. La requête est validée contre une **liste blanche stricte** — tout
ce qui n'est pas explicitement prévu est refusé :

| Refusé | Pourquoi |
|---|---|
| Un autre modèle que `claude-opus-5` | un modèle plus cher, ou que l'app ne sait pas lire |
| `max_tokens` au-delà de 4096 | borne le coût d'un appel isolé |
| `effort` `xhigh` ou `max` | nettement plus cher |
| `tools`, `system`, `thinking`, `task_budget` | l'app n'en envoie pas; un invité non plus |
| Images par URL | ferait télécharger n'importe quoi par le serveur d'Anthropic |
| Documents PDF, blocs inconnus | hors du besoin de l'app |
| Plus de 4 images, plus de 8 messages, plus de 12 Mo | bornes de taille |

Ces règles sont dans `functions/analyze/guard.ts`, à part du reste pour
être testables seules : `node --experimental-strip-types` suffit à les
rejouer, 22 cas y passent.

### Côté app

Rien à régler. Dès qu'une personne est connectée, l'app tente le proxy;
un refus la fait retomber sur sa clé personnelle si elle en a une, sans
message inutile. Si elle n'en a pas, c'est le message du proxy qui
s'affiche — « pas sur la liste des invités », ou « plafond mensuel
atteint » — plutôt qu'une erreur de clé incompréhensible.

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
