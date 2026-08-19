\set ON_ERROR_STOP on
grant usage on schema public, auth, storage to authenticated;
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
-- Alice dépose une photo dans SON dossier
insert into storage.objects(bucket_id, name) values ('meal-photos', '11111111-1111-1111-1111-111111111111/repas1.jpg');
select 'alice dépose chez elle' as test, count(*) as n from storage.objects;
-- ...et tente d'en déposer une chez Bob
do $$
begin
  insert into storage.objects(bucket_id, name) values ('meal-photos', '22222222-2222-2222-2222-222222222222/vol.jpg');
  raise notice 'ÉCHEC : dépôt chez autrui accepté';
exception when insufficient_privilege then
  raise notice 'OK : dépôt dans le dossier d''autrui refusé';
end $$;
-- Bob ne voit pas la photo d'Alice
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select 'bob voit la photo d''alice' as test, count(*) as n from storage.objects;
reset role;
