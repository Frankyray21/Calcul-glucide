-- ═══════════════════════════════════════════════════════════════════════
--  Doublure de test — À N'EXÉCUTER JAMAIS SUR LE PROJET SUPABASE
--
--  Supabase fournit auth.users, auth.uid(), storage.objects et les rôles.
--  Ce fichier les recrée en minimal pour pouvoir rejouer schema.sql puis
--  isolation.sql et storage.sql sur un PostgreSQL local, et vérifier
--  soi-même que l'isolation entre comptes tient.
--
--    createdb essai
--    psql -d essai -f test-stub.sql
--    psql -d essai -f schema.sql
--    psql -d essai -f isolation.sql
--    psql -d essai -f storage.sql
-- ═══════════════════════════════════════════════════════════════════════
create schema if not exists auth;
create schema if not exists storage;
do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
do $$ begin create role anon; exception when duplicate_object then null; end $$;

create table if not exists auth.users (id uuid primary key);

-- Chez Supabase, auth.uid() lit l'identifiant du jeton JWT. Ici on le
-- simule par un réglage de session, ce qui permet de changer de compte
-- au milieu d'un test.
create or replace function auth.uid() returns uuid language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create table if not exists storage.buckets (
  id text primary key, name text, public boolean, file_size_limit bigint);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text, name text, owner uuid);

-- Même comportement que chez Supabase : le nom de fichier est retiré,
-- seuls les dossiers sont renvoyés.
create or replace function storage.foldername(name text) returns text[]
  language plpgsql immutable as $$
  declare parts text[];
  begin
    select string_to_array(name, '/') into parts;
    return parts[1:array_length(parts, 1) - 1];
  end $$;
