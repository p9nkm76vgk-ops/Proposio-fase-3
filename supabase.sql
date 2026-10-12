-- ============================================================================
-- proposio · Fase 3: cuentas y guardado en la nube (Supabase)
--
-- Cómo usarlo: en tu proyecto de Supabase, abre "SQL Editor", pega TODO este
-- archivo y pulsa "Run". Se puede ejecutar más de una vez sin romper nada.
--
-- Seguridad: todas las tablas tienen RLS (seguridad por filas). Cada usuario solo
-- puede leer y modificar sus propias filas, aunque alguien manipule la app.
-- El contador mensual solo se puede modificar a través de la función
-- register_export(), que comprueba el límite en el servidor.
-- ============================================================================

-- ─── Propuestas ──────────────────────────────────────────────────────────────
create table if not exists public.proposals (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id          text not null check (char_length(id) between 1 and 64),
  title       text not null default '' check (char_length(title) <= 200),
  client_name text not null default '' check (char_length(client_name) <= 200),
  data        jsonb not null check (jsonb_typeof(data) = 'object' and pg_column_size(data) <= 1500000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists proposals_user_updated_idx on public.proposals (user_id, updated_at desc);

-- ─── Perfil: tus datos, diseño y textos guardados ────────────────────────────
create table if not exists public.profiles (
  user_id      uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  professional jsonb not null default '{}'::jsonb check (pg_column_size(professional) <= 10000),
  design       jsonb not null default '{}'::jsonb check (pg_column_size(design) <= 800000),
  snippets     jsonb not null default '{}'::jsonb check (pg_column_size(snippets) <= 300000),
  updated_at   timestamptz not null default now()
);

-- ─── Uso mensual: una fila por propuesta descargada y mes ─────────────────────
-- No depende de la tabla de propuestas: borrar una propuesta no devuelve el cupo.
create table if not exists public.usage_events (
  user_id     uuid not null references auth.users (id) on delete cascade,
  proposal_id text not null check (char_length(proposal_id) between 1 and 64),
  period      text not null check (period ~ '^[0-9]{4}-[0-9]{2}$'),
  created_at  timestamptz not null default now(),
  primary key (user_id, period, proposal_id)
);

-- ─── Fecha de modificación automática ────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists proposals_touch on public.proposals;
create trigger proposals_touch before update on public.proposals
  for each row execute function public.touch_updated_at();

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Límite de propuestas guardadas por usuario (evita abusos del almacenamiento)
create or replace function public.check_proposals_quota()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Volver a guardar una propuesta existente no cuenta como nueva
  if exists (select 1 from public.proposals where user_id = new.user_id and id = new.id) then
    return new;
  end if;
  if (select count(*) from public.proposals where user_id = new.user_id) >= 500 then
    raise exception 'proposals_quota_exceeded' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists proposals_quota on public.proposals;
create trigger proposals_quota before insert on public.proposals
  for each row execute function public.check_proposals_quota();

-- ─── Seguridad por filas (RLS) ───────────────────────────────────────────────
alter table public.proposals    enable row level security;
alter table public.profiles     enable row level security;
alter table public.usage_events enable row level security;

-- Los visitantes sin sesión (rol anon) no tienen acceso a nada.
revoke all on public.proposals, public.profiles, public.usage_events from anon;
grant select, insert, update, delete on public.proposals, public.profiles to authenticated;
grant select on public.usage_events to authenticated;
revoke insert, update, delete on public.usage_events from authenticated;

drop policy if exists "proposals: select own" on public.proposals;
drop policy if exists "proposals: insert own" on public.proposals;
drop policy if exists "proposals: update own" on public.proposals;
drop policy if exists "proposals: delete own" on public.proposals;
create policy "proposals: select own" on public.proposals for select to authenticated using (user_id = (select auth.uid()));
create policy "proposals: insert own" on public.proposals for insert to authenticated with check (user_id = (select auth.uid()));
create policy "proposals: update own" on public.proposals for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "proposals: delete own" on public.proposals for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists "profiles: select own" on public.profiles;
drop policy if exists "profiles: insert own" on public.profiles;
drop policy if exists "profiles: update own" on public.profiles;
drop policy if exists "profiles: delete own" on public.profiles;
create policy "profiles: select own" on public.profiles for select to authenticated using (user_id = (select auth.uid()));
create policy "profiles: insert own" on public.profiles for insert to authenticated with check (user_id = (select auth.uid()));
create policy "profiles: update own" on public.profiles for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "profiles: delete own" on public.profiles for delete to authenticated using (user_id = (select auth.uid()));

-- Uso: solo lectura de las propias filas. Escribir solo es posible con register_export().
drop policy if exists "usage: select own" on public.usage_events;
create policy "usage: select own" on public.usage_events for select to authenticated using (user_id = (select auth.uid()));

-- ─── Periodo y límite mensual ────────────────────────────────────────────────
-- El mes se calcula en el servidor con la hora de España peninsular.
create or replace function public.current_period()
returns text language sql stable set search_path = public as $$
  select to_char(now() at time zone 'Europe/Madrid', 'YYYY-MM')
$$;

-- Fase 4: aquí se leerá el plan del usuario. De momento, todos tienen el plan gratuito.
create or replace function public.monthly_limit(p_user uuid)
returns integer language sql stable set search_path = public as $$
  select 3
$$;

create or replace function public.get_usage(p_proposal_id text default null)
returns json language plpgsql stable security definer set search_path = public as $$
declare
  uid     uuid := auth.uid();
  per     text := public.current_period();
  used    integer;
  counted boolean := false;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  select count(*) into used from public.usage_events where user_id = uid and period = per;
  if p_proposal_id is not null then
    select exists (
      select 1 from public.usage_events where user_id = uid and period = per and proposal_id = p_proposal_id
    ) into counted;
  end if;
  return json_build_object('period', per, 'used', used, 'limit', public.monthly_limit(uid), 'already_counted', counted);
end $$;

create or replace function public.register_export(p_proposal_id text)
returns json language plpgsql volatile security definer set search_path = public as $$
declare
  uid  uuid := auth.uid();
  per  text := public.current_period();
  lim  integer;
  used integer;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not exists (select 1 from public.proposals where user_id = uid and id = p_proposal_id) then
    raise exception 'proposal_not_found' using errcode = 'P0002';
  end if;

  -- Evita que dos descargas simultáneas superen el límite
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));

  lim := public.monthly_limit(uid);
  select count(*) into used from public.usage_events where user_id = uid and period = per;

  if exists (select 1 from public.usage_events where user_id = uid and period = per and proposal_id = p_proposal_id) then
    return json_build_object('allowed', true, 'already_counted', true, 'used', used, 'limit', lim, 'period', per);
  end if;

  if used >= lim then
    return json_build_object('allowed', false, 'already_counted', false, 'used', used, 'limit', lim, 'period', per);
  end if;

  insert into public.usage_events (user_id, proposal_id, period) values (uid, p_proposal_id, per);
  return json_build_object('allowed', true, 'already_counted', false, 'used', used + 1, 'limit', lim, 'period', per);
end $$;

-- ─── Borrar la cuenta y todos sus datos (derecho de supresión) ────────────────
-- Al borrar el usuario, sus propuestas, perfil y uso se borran en cascada.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  delete from auth.users where id = uid;
end $$;

-- Solo los usuarios con sesión pueden usar las funciones.
revoke all on function public.get_usage(text)          from public, anon;
revoke all on function public.register_export(text)    from public, anon;
revoke all on function public.delete_my_account()      from public, anon;
revoke all on function public.check_proposals_quota()  from public, anon, authenticated;
grant execute on function public.get_usage(text)       to authenticated;
grant execute on function public.register_export(text) to authenticated;
grant execute on function public.delete_my_account()   to authenticated;
