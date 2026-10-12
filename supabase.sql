-- ============================================================================
-- proposio · cuentas, guardado en la nube, suscripciones y propuestas compartidas (Supabase)
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

-- Columnas añadidas después (bloque 2): catálogo de servicios y ajustes de precio
alter table public.profiles add column if not exists catalog jsonb not null default '[]'::jsonb;
alter table public.profiles add column if not exists pricing_settings jsonb not null default '{}'::jsonb;
alter table public.profiles drop constraint if exists profiles_catalog_check;
alter table public.profiles add constraint profiles_catalog_check
  check (jsonb_typeof(catalog) = 'array' and pg_column_size(catalog) <= 200000);
alter table public.profiles drop constraint if exists profiles_pricing_settings_check;
alter table public.profiles add constraint profiles_pricing_settings_check
  check (jsonb_typeof(pricing_settings) = 'object' and pg_column_size(pricing_settings) <= 5000);

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

-- ─── Suscripciones (fase 4) ───────────────────────────────────────────────────
-- Solo la escribe la función stripe-webhook (con la clave de servicio, que no está en la web).
-- El usuario solo puede LEER su fila. Así nadie puede darse un plan de pago a sí mismo.
create table if not exists public.subscriptions (
  user_id                uuid primary key references auth.users (id) on delete cascade,
  plan                   text not null default 'free' check (plan in ('free', 'pro', 'business')),
  status                 text not null default 'inactive',
  stripe_customer_id     text unique,
  stripe_subscription_id text unique,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  last_event_at          timestamptz,
  updated_at             timestamptz not null default now()
);

alter table public.subscriptions enable row level security;
revoke all on public.subscriptions from anon, authenticated;
grant select on public.subscriptions to authenticated;

drop policy if exists "subscriptions: select own" on public.subscriptions;
create policy "subscriptions: select own" on public.subscriptions for select to authenticated using (user_id = (select auth.uid()));

drop trigger if exists subscriptions_touch on public.subscriptions;
create trigger subscriptions_touch before update on public.subscriptions
  for each row execute function public.touch_updated_at();

-- Plan que se aplica de verdad: el de pago solo cuenta si la suscripción está al día.
-- (past_due = Stripe está reintentando el cobro; se mantiene el plan mientras tanto)
create or replace function public.effective_plan(p_user uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    (select case when status in ('active', 'trialing', 'past_due') then plan else 'free' end
       from public.subscriptions where user_id = p_user),
    'free')
$$;

-- ─── Periodo y límite mensual ────────────────────────────────────────────────
-- El mes se calcula en el servidor con la hora de España peninsular.
create or replace function public.current_period()
returns text language sql stable set search_path = public as $$
  select to_char(now() at time zone 'Europe/Madrid', 'YYYY-MM')
$$;

-- Límite mensual de propuestas según el plan.
-- Business: "uso razonable", con un tope alto para evitar abusos.
create or replace function public.monthly_limit(p_user uuid)
returns integer language sql stable security definer set search_path = public as $$
  select case public.effective_plan(p_user)
    when 'pro' then 30
    when 'business' then 300
    else 3
  end
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
  return json_build_object(
    'period', per,
    'used', used,
    'limit', public.monthly_limit(uid),
    'already_counted', counted,
    'plan', public.effective_plan(uid),
    'subscription', (
      select json_build_object('plan', plan, 'status', status, 'current_period_end', current_period_end,
                               'cancel_at_period_end', cancel_at_period_end)
        from public.subscriptions where user_id = uid
    )
  );
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
    return json_build_object('allowed', true, 'already_counted', true, 'used', used, 'limit', lim, 'period', per, 'plan', public.effective_plan(uid));
  end if;

  if used >= lim then
    return json_build_object('allowed', false, 'already_counted', false, 'used', used, 'limit', lim, 'period', per, 'plan', public.effective_plan(uid));
  end if;

  insert into public.usage_events (user_id, proposal_id, period) values (uid, p_proposal_id, per);
  return json_build_object('allowed', true, 'already_counted', false, 'used', used + 1, 'limit', lim, 'period', per, 'plan', public.effective_plan(uid));
end $$;

-- ─── Propuestas compartidas por enlace (el cliente las ve y las acepta) ───────
-- Cada propuesta compartida tiene un enlace secreto (token aleatorio de 32 caracteres).
-- El cliente no tiene cuenta: solo puede ver y aceptar a través de las funciones
-- view_shared_proposal() y accept_shared_proposal(), que exigen conocer el token.
create table if not exists public.shared_proposals (
  token                text primary key default replace(gen_random_uuid()::text, '-', ''),
  user_id              uuid not null default auth.uid() references auth.users (id) on delete cascade,
  proposal_id          text not null check (char_length(proposal_id) between 1 and 64),
  title                text not null default '' check (char_length(title) <= 200),
  client_name          text not null default '' check (char_length(client_name) <= 200),
  -- Copia congelada de la propuesta tal como la verá el cliente
  snapshot             jsonb not null check (jsonb_typeof(snapshot) = 'object' and pg_column_size(snapshot) <= 1500000),
  -- Importes para recalcular el total en el servidor: base, descuento, impuesto y extras
  pricing              jsonb not null default '{}'::jsonb check (jsonb_typeof(pricing) = 'object' and pg_column_size(pricing) <= 20000),
  status               text not null default 'sent' check (status in ('sent', 'accepted')),
  revoked              boolean not null default false,
  shared_at            timestamptz not null default now(),
  view_count           integer not null default 0,
  first_viewed_at      timestamptz,
  last_viewed_at       timestamptz,
  accepted_at          timestamptz,
  accepted_name        text,
  accepted_extras      jsonb,
  accepted_total_cents bigint,
  created_at           timestamptz not null default now(),
  unique (user_id, proposal_id)
);

create index if not exists shared_proposals_user_idx on public.shared_proposals (user_id, shared_at desc);

alter table public.shared_proposals enable row level security;

-- Permisos por columna: el dueño puede crear y actualizar el contenido, pero NUNCA
-- tocar los datos de visitas ni de aceptación (solo las funciones del servidor).
revoke all on public.shared_proposals from anon, authenticated;
grant select, delete on public.shared_proposals to authenticated;
grant insert (user_id, proposal_id, title, client_name, snapshot, pricing) on public.shared_proposals to authenticated;
grant update (title, client_name, snapshot, pricing, revoked) on public.shared_proposals to authenticated;

drop policy if exists "shared: select own" on public.shared_proposals;
drop policy if exists "shared: insert own" on public.shared_proposals;
drop policy if exists "shared: update own" on public.shared_proposals;
drop policy if exists "shared: delete own" on public.shared_proposals;
create policy "shared: select own" on public.shared_proposals for select to authenticated using (user_id = (select auth.uid()));
-- Solo se puede compartir una propuesta que ya contó en el cupo mensual (como descargarla)
create policy "shared: insert own" on public.shared_proposals for insert to authenticated with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.usage_events u
     where u.user_id = (select auth.uid()) and u.proposal_id = shared_proposals.proposal_id
  )
);
create policy "shared: update own" on public.shared_proposals for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "shared: delete own" on public.shared_proposals for delete to authenticated using (user_id = (select auth.uid()));

-- Una propuesta aceptada no se puede cambiar: el cliente aceptó esa versión exacta.
create or replace function public.guard_shared_proposal()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.status = 'accepted' and (new.snapshot is distinct from old.snapshot or new.pricing is distinct from old.pricing) then
    raise exception 'already_accepted' using errcode = 'P0001';
  end if;
  if new.snapshot is distinct from old.snapshot then
    new.shared_at := now(); -- nueva versión enviada
  end if;
  return new;
end $$;

drop trigger if exists shared_proposals_guard on public.shared_proposals;
create trigger shared_proposals_guard before update on public.shared_proposals
  for each row execute function public.guard_shared_proposal();

-- Al borrar una propuesta, su enlace deja de existir (clave foránea en cascada y, por si acaso, un disparador).
alter table public.shared_proposals drop constraint if exists shared_proposals_proposal_fk;
alter table public.shared_proposals
  add constraint shared_proposals_proposal_fk
  foreign key (user_id, proposal_id) references public.proposals (user_id, id) on delete cascade;

create or replace function public.delete_shared_on_proposal_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.shared_proposals where user_id = old.user_id and proposal_id = old.id;
  return old;
end $$;

drop trigger if exists proposals_delete_shared on public.proposals;
create trigger proposals_delete_shared after delete on public.proposals
  for each row execute function public.delete_shared_on_proposal_delete();

-- El cliente abre el enlace: devuelve la propuesta y anota la visita.
create or replace function public.view_shared_proposal(p_token text)
returns json language plpgsql volatile security definer set search_path = public as $$
declare
  r public.shared_proposals;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{32}$' then
    return null;
  end if;
  select * into r from public.shared_proposals where token = p_token and not revoked;
  if not found then
    return null;
  end if;
  -- Si quien abre el enlace es el propio autor (con su sesión), no cuenta como visita del cliente
  if auth.uid() is distinct from r.user_id then
    update public.shared_proposals
       set view_count = view_count + 1,
           first_viewed_at = coalesce(first_viewed_at, now()),
           last_viewed_at = now()
     where token = p_token
    returning * into r;
  end if;
  return json_build_object(
    'snapshot', r.snapshot,
    'pricing', r.pricing,
    'status', r.status,
    'shared_at', r.shared_at,
    'accepted_at', r.accepted_at,
    'accepted_name', r.accepted_name,
    'accepted_extras', r.accepted_extras,
    'accepted_total_cents', r.accepted_total_cents
  );
end $$;

-- El cliente acepta: el total se recalcula aquí, con los extras que existan de verdad.
-- p_version es la fecha de envío (shared_at) de la versión que el cliente estaba viendo: si el autor
-- la ha actualizado mientras tanto, no se acepta y el cliente debe revisar la versión nueva.
drop function if exists public.accept_shared_proposal(text, text, text[]);
create or replace function public.accept_shared_proposal(p_token text, p_name text, p_extras text[] default '{}', p_version timestamptz default null)
returns json language plpgsql volatile security definer set search_path = public as $$
declare
  r          public.shared_proposals;
  clean_name text := btrim(coalesce(p_name, ''));
  selected   jsonb;
  extras_sum bigint;
  base       bigint;
  rate       numeric;
  total      bigint;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{32}$' then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if char_length(clean_name) < 2 or char_length(clean_name) > 120 then
    raise exception 'invalid_name' using errcode = 'P0001';
  end if;

  select * into r from public.shared_proposals where token = p_token and not revoked for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if r.status <> 'accepted' and p_version is not null and r.shared_at <> p_version then
    raise exception 'outdated' using errcode = 'P0001';
  end if;
  if r.status = 'accepted' then
    -- Aceptar dos veces no cambia nada
    return json_build_object('status', 'accepted', 'accepted_at', r.accepted_at, 'accepted_name', r.accepted_name,
                             'accepted_extras', r.accepted_extras, 'accepted_total_cents', r.accepted_total_cents);
  end if;

  select coalesce(jsonb_agg(e), '[]'::jsonb), coalesce(sum((e ->> 'cents')::bigint), 0)
    into selected, extras_sum
    from jsonb_array_elements(coalesce(r.pricing -> 'extras', '[]'::jsonb)) as e
   where e ->> 'id' = any (coalesce(p_extras, '{}'));

  base := coalesce((r.pricing ->> 'base_subtotal')::bigint, 0) - coalesce((r.pricing ->> 'discount')::bigint, 0) + extras_sum;
  rate := nullif(r.pricing ->> 'tax_rate', '')::numeric;
  total := base + case when rate is null then 0 else round(base * rate / 100) end;

  update public.shared_proposals
     set status = 'accepted', accepted_at = now(), accepted_name = clean_name,
         accepted_extras = selected, accepted_total_cents = total
   where token = p_token;

  return json_build_object('status', 'accepted', 'accepted_at', now(), 'accepted_name', clean_name,
                           'accepted_extras', selected, 'accepted_total_cents', total);
end $$;

revoke all on function public.view_shared_proposal(text)                 from public;
revoke all on function public.accept_shared_proposal(text, text, text[], timestamptz) from public;
revoke all on function public.guard_shared_proposal()                    from public, anon, authenticated;
revoke all on function public.delete_shared_on_proposal_delete()         from public, anon, authenticated;
grant execute on function public.view_shared_proposal(text)                 to anon, authenticated;
grant execute on function public.accept_shared_proposal(text, text, text[], timestamptz) to anon, authenticated;

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
  -- Primero hay que cancelar la suscripción, para no seguir cobrando a una cuenta borrada
  if public.effective_plan(uid) <> 'free'
     and exists (select 1 from public.subscriptions where user_id = uid and cancel_at_period_end = false) then
    raise exception 'active_subscription' using errcode = 'P0001';
  end if;
  delete from auth.users where id = uid;
end $$;

-- Solo los usuarios con sesión pueden usar las funciones.
revoke all on function public.get_usage(text)          from public, anon;
revoke all on function public.register_export(text)    from public, anon;
revoke all on function public.delete_my_account()      from public, anon;
revoke all on function public.check_proposals_quota()  from public, anon, authenticated;
revoke all on function public.effective_plan(uuid)       from public, anon, authenticated;
revoke all on function public.monthly_limit(uuid)        from public, anon, authenticated;
grant execute on function public.get_usage(text)       to authenticated;
grant execute on function public.register_export(text) to authenticated;
grant execute on function public.delete_my_account()   to authenticated;
