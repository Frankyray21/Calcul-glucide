-- ═══════════════════════════════════════════════════════════════════════
--  Glucides Nets — schéma de synchronisation
--
--  À exécuter une fois dans l'éditeur SQL du projet Supabase.
--  Le fichier est idempotent : le relancer ne casse rien.
--
--  Principe : chaque ligne appartient à un compte (user_id), et c'est la
--  BASE qui l'impose, pas l'application. Row Level Security est active sur
--  toutes les tables; même une clé publique volée ou un client modifié ne
--  peut lire que les lignes de son propre compte. C'est la seule garantie
--  qui tienne pour des données de santé.
-- ═══════════════════════════════════════════════════════════════════════

-- ── Profils (une personne suivie : toi, ton enfant…) ──────────────────
create table if not exists public.profiles (
  id          uuid primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  allergies   text default '',
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

-- ── Recettes ──────────────────────────────────────────────────────────
create table if not exists public.recipes (
  id          uuid primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  profile_id  uuid not null,
  name        text not null,
  carbs       real not null default 0,
  fiber       real not null default 0,
  polyols     real not null default 0,
  polyol_type text not null default 'half',
  -- Chemin dans le bucket, pas l'image : une photo en base64 dans une
  -- colonne gonflerait chaque synchro de plusieurs centaines de ko
  photo_path  text,
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

-- ── Favoris ───────────────────────────────────────────────────────────
create table if not exists public.favorites (
  id          uuid primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  profile_id  uuid not null,
  name        text not null,
  carbs       real not null default 0,
  fiber       real not null default 0,
  polyols     real not null default 0,
  polyol_type text not null default 'half',
  ratio       real not null default 1,
  grams       real,
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

-- ── Journal des repas ─────────────────────────────────────────────────
create table if not exists public.entries (
  id          uuid primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  profile_id  uuid not null,
  eaten_at    timestamptz not null,
  -- Les aliments du repas sont un détail de l'entrée, jamais interrogés
  -- séparément : une colonne jsonb évite une table de jointure inutile
  items       jsonb not null default '[]'::jsonb,
  net         real not null default 0,
  carbs       real not null default 0,
  fiber       real not null default 0,
  polyols     real not null default 0,
  photo_path  text,
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

-- ── Leçons apprises des corrections ───────────────────────────────────
create table if not exists public.lessons (
  id          uuid primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  profile_id  uuid not null,
  kind        text not null,
  text        text default '',
  ai_name     text default '',
  user_name   text default '',
  ai_per100   real,
  user_per100 real,
  factor      real,
  n           integer not null default 1,
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

-- ── Index : la synchro ne demande que « ce qui a changé depuis » ──────
create index if not exists profiles_sync_idx  on public.profiles  (user_id, updated_at);
create index if not exists recipes_sync_idx   on public.recipes   (user_id, updated_at);
create index if not exists favorites_sync_idx on public.favorites (user_id, updated_at);
create index if not exists entries_sync_idx   on public.entries   (user_id, updated_at);
create index if not exists lessons_sync_idx   on public.lessons   (user_id, updated_at);

-- ── Isolation par compte, imposée par la base ─────────────────────────
do $$
declare t text;
begin
  foreach t in array array['profiles', 'recipes', 'favorites', 'entries', 'lessons']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists own_rows on public.%I', t);
    -- Une seule politique pour lecture, insertion, modification et
    -- suppression : « la ligne est à moi ». with check couvre l'insertion
    -- et empêche d'écrire une ligne au nom de quelqu'un d'autre.
    execute format($p$
      create policy own_rows on public.%I
        for all
        using (auth.uid() = user_id)
        with check (auth.uid() = user_id)
    $p$, t);
  end loop;
end $$;

-- ── updated_at posé par le serveur ────────────────────────────────────
-- L'horloge d'un téléphone peut être fausse de plusieurs heures. Si elle
-- avance, ses écritures gagneraient tous les conflits à venir; si elle
-- retarde, elles seraient ignorées. C'est le serveur qui tranche.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['profiles', 'recipes', 'favorites', 'entries', 'lessons']
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before insert or update on public.%I
         for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- ── Photos ────────────────────────────────────────────────────────────
-- Bucket privé : une photo de repas n'a aucune raison d'être publique.
-- Les fichiers sont rangés sous <user_id>/…, et les politiques exigent
-- que le premier segment du chemin soit celui du compte connecté.
insert into storage.buckets (id, name, public, file_size_limit)
values ('meal-photos', 'meal-photos', false, 5242880)
on conflict (id) do update set public = false, file_size_limit = 5242880;

-- Supabase active déjà RLS sur storage.objects, mais une politique qui
-- repose sur un réglage par défaut n'en est pas une : on l'impose ici.
-- Selon les droits du rôle qui exécute ce fichier, l'ordre peut être
-- refusé — ce n'est pas grave, il est alors déjà actif.
do $$
begin
  execute 'alter table storage.objects enable row level security';
exception when insufficient_privilege then
  raise notice 'RLS sur storage.objects déjà géré par Supabase (droits insuffisants pour le redire)';
end $$;

drop policy if exists own_photos on storage.objects;
create policy own_photos on storage.objects
  for all
  using (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'meal-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ── Effacement du compte ──────────────────────────────────────────────
-- Droit à l'effacement : une seule commande, appelable par la personne
-- elle-même. Les tables partent par cascade sur auth.users.
-- Les photos : l'application doit les supprimer via l'API Storage AVANT
-- d'appeler cette fonction. Effacer les lignes de storage.objects ici ne
-- fait que couper la référence — les fichiers resteraient sur le disque.
-- Le nettoyage ci-dessous est donc un filet, pas la méthode.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare me uuid := auth.uid();
begin
  if me is null then
    raise exception 'non authentifié';
  end if;
  delete from storage.objects
   where bucket_id = 'meal-photos' and (storage.foldername(name))[1] = me::text;
  delete from auth.users where id = me;
end $$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
