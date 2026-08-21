-- ═══════════════════════════════════════════════════════════════════════
--  Glucides Nets — proxy de lecture IA (facultatif)
--
--  À exécuter APRÈS schema.sql, seulement si tu veux offrir l'analyse
--  photo à d'autres personnes sans qu'elles aient leur propre clé API.
--  C'est TOI qui paies leurs analyses : d'où la liste d'invités.
--
--  Ces deux tables ne sont jamais écrites depuis l'application. Aucune
--  politique n'accorde quoi que ce soit au rôle « authenticated » : RLS
--  est active et refuse tout par défaut. Seule la fonction Edge, qui
--  utilise la clé service_role, les lit et les écrit — et toi, depuis
--  l'éditeur de Supabase.
-- ═══════════════════════════════════════════════════════════════════════

-- ── Qui a le droit de passer par ta clé ───────────────────────────────
create table if not exists public.ai_allowlist (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  note         text default '',
  -- Plafond mensuel par personne. Même une personne de confiance ne doit
  -- pas pouvoir faire exploser la facture : une boucle ou un appareil
  -- perdu suffirait.
  monthly_cap  integer not null default 300,
  active       boolean not null default true,
  added_at     timestamptz not null default now()
);

-- ── Ce qui a été consommé, pour appliquer le plafond et voir venir ────
create table if not exists public.ai_usage (
  user_id      uuid not null references auth.users(id) on delete cascade,
  month        text not null,              -- « 2026-08 »
  calls        integer not null default 0,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  updated_at   timestamptz not null default now(),
  primary key (user_id, month)
);

-- Refus par défaut : RLS active, aucune politique. Le rôle authenticated
-- n'a donc AUCUN accès, en lecture comme en écriture.
alter table public.ai_allowlist enable row level security;
alter table public.ai_usage enable row level security;
revoke all on public.ai_allowlist from anon, authenticated;
revoke all on public.ai_usage from anon, authenticated;

-- ── Compter un appel et rendre l'état du plafond ──────────────────────
-- Appelée par la fonction Edge avec la clé service_role. Le comptage et
-- la vérification sont faits dans la MÊME instruction : deux appels
-- simultanés ne peuvent pas passer tous les deux au-dessus du plafond.
create or replace function public.ai_consume(p_user uuid)
returns table (allowed boolean, used integer, cap integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cap integer;
  v_active boolean;
  v_month text := to_char(now(), 'YYYY-MM');
  v_used integer;
begin
  select monthly_cap, active into v_cap, v_active
    from public.ai_allowlist where user_id = p_user;

  if v_cap is null or not v_active then
    return query select false, 0, 0;
    return;
  end if;

  insert into public.ai_usage as u (user_id, month, calls)
       values (p_user, v_month, 1)
  on conflict (user_id, month) do update
          set calls = u.calls + 1, updated_at = now()
    returning u.calls into v_used;

  if v_used > v_cap then
    -- Plafond dépassé : on garde le compteur incrémenté (la tentative a
    -- eu lieu) mais on refuse l'appel.
    return query select false, v_used, v_cap;
  else
    return query select true, v_used, v_cap;
  end if;
end $$;

-- ── Enregistrer les jetons réellement consommés ───────────────────────
create or replace function public.ai_record_tokens(p_user uuid, p_in bigint, p_out bigint)
returns void
language sql
security definer
set search_path = public
as $$
  update public.ai_usage
     set input_tokens = input_tokens + p_in,
         output_tokens = output_tokens + p_out,
         updated_at = now()
   where user_id = p_user and month = to_char(now(), 'YYYY-MM');
$$;

revoke all on function public.ai_consume(uuid) from public, anon, authenticated;
revoke all on function public.ai_record_tokens(uuid, bigint, bigint) from public, anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════
--  Inviter quelqu'un
--
--  La personne doit d'abord s'être connectée une fois à l'app (c'est ce
--  qui crée son compte). Ensuite, ici :
--
--    insert into public.ai_allowlist (user_id, note, monthly_cap)
--    select id, 'Grand-maman', 200 from auth.users
--     where email = 'exemple@courriel.com';
--
--  Retirer quelqu'un, sans perdre son historique de consommation :
--
--    update public.ai_allowlist set active = false
--     where user_id = (select id from auth.users where email = '…');
--
--  Voir la consommation du mois :
--
--    select u.email, a.note, x.calls, a.monthly_cap
--      from public.ai_usage x
--      join auth.users u on u.id = x.user_id
--      left join public.ai_allowlist a on a.user_id = x.user_id
--     where x.month = to_char(now(), 'YYYY-MM')
--     order by x.calls desc;
-- ═══════════════════════════════════════════════════════════════════════
