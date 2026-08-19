\set ON_ERROR_STOP on
-- deux comptes
insert into auth.users(id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222') on conflict do nothing;

-- l'application se connecte avec le rôle authenticated, jamais en propriétaire
grant usage on schema public, auth, storage to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select, insert, update, delete on storage.objects to authenticated;

-- ── Alice écrit ────────────────────────────────────────────────────────
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into public.recipes(id, user_id, profile_id, name, carbs)
  values (gen_random_uuid(), auth.uid(), gen_random_uuid(), 'Lasagne d''Alice', 14);
insert into public.entries(id, user_id, profile_id, eaten_at, net)
  values (gen_random_uuid(), auth.uid(), gen_random_uuid(), now(), 42);
select 'alice voit ses recettes' as test, count(*) as n from public.recipes;

-- ── Bob ne doit RIEN voir d'Alice ──────────────────────────────────────
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select 'bob voit les recettes d''alice' as test, count(*) as n from public.recipes;
select 'bob voit le journal d''alice' as test, count(*) as n from public.entries;

-- ── Bob ne peut pas écrire au nom d'Alice ──────────────────────────────
do $$
begin
  insert into public.recipes(id, user_id, profile_id, name)
    values (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', gen_random_uuid(), 'usurpation');
  raise notice 'ÉCHEC : usurpation acceptée';
exception when insufficient_privilege then
  raise notice 'OK : usurpation refusée par la base';
end $$;

-- ── Bob ne peut pas modifier ni supprimer ce qu'il ne voit pas ─────────
with x as (update public.recipes set name = 'piraté' returning 1)
  select 'lignes d''alice modifiées par bob' as test, count(*) as n from x;
with x as (delete from public.recipes returning 1)
  select 'lignes d''alice supprimées par bob' as test, count(*) as n from x;

-- ── Alice retrouve tout ────────────────────────────────────────────────
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select 'alice a toujours sa recette' as test, count(*) as n from public.recipes where name = 'Lasagne d''Alice';

-- ── updated_at posé par le serveur, jamais par le client ───────────────
insert into public.favorites(id, user_id, profile_id, name, updated_at)
  values (gen_random_uuid(), auth.uid(), gen_random_uuid(), 'Horloge folle', '2050-01-01');
select 'horodatage client ignoré' as test,
       (updated_at < now() + interval '1 min') as n
  from public.favorites where name = 'Horloge folle';

-- ── Photos : chemin d'un autre compte refusé ───────────────────────────
reset role;
