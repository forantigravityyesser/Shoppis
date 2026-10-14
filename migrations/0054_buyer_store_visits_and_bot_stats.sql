-- 0054_buyer_store_visits_and_bot_stats.sql
-- Telegram-боты (seller/buyer): серверный список витрин покупателя, активные
-- заказы покупателя и агрегаты статистики для бота продавца.
--
-- Новые объекты:
--   * public.buyer_store_visits — «какие витрины открывал покупатель» и
--     «сколько человек открывало витрину» (уникальные buyer_user_id).
--     Пишется из edge `store-visit` по серверной сессии (секрет SESSION_SECRET),
--     напрямую клиент записать не может.
--   * buyer_store_visit_upsert(p_actor_user_id, p_store_ref) -> jsonb | null
--   * buyer_store_list_read(p_actor_user_id) -> jsonb[]  (витрины покупателя)
--   * buyer_active_orders_read(p_actor_user_id, p_limit) -> jsonb
--   * seller_bot_stats_read(p_actor_user_id, p_store_ref) -> jsonb | null
--
-- Семантика (согласована для ботов):
--   * «Активные заказы» покупателя = NEW, IN_TRANSIT и DELIVERED без
--     зафиксированного исхода (забрали/отказ — завершённые, не показываются).
--   * «Посетители» = уникальные люди (buyer_user_id), включая владельца в
--     записи, но владелец исключён из счётчика (просмотр своей витрины не
--     считается посетителем).
--   * Статистика продавца: заказы считаются все (включая REFUSED/CANCELLED);
--     денежные суммы — только в текущей валюте магазина (как seller_dashboard_read,
--     0053 §3.5); received = delivery_outcome 'RECEIVED';
--     potential = IN_TRANSIT или (DELIVERED и delivery_outcome is null).
--
-- Backfill: таблица наполняется из уже существующих заказов (min/max created_at),
-- чтобы витрины покупателей с историей заказов сразу появились в списке.
--
-- security definer + `public, pg_temp` (конвенция 0032); grants закрыты
-- (паттерн 0048/0053) — доверенный путь только через edge с admin-ключом.

create table if not exists public.buyer_store_visits (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  buyer_user_id uuid not null references public.users(id) on delete cascade,
  first_visited_at timestamptz not null default now(),
  last_visited_at timestamptz not null default now(),
  visits_count integer not null default 1,
  constraint buyer_store_visits_count_check check (visits_count > 0)
);

create unique index if not exists buyer_store_visits_store_buyer_key
  on public.buyer_store_visits (store_id, buyer_user_id);
create index if not exists buyer_store_visits_buyer_last_idx
  on public.buyer_store_visits (buyer_user_id, last_visited_at desc, id desc);
create index if not exists buyer_store_visits_store_idx
  on public.buyer_store_visits (store_id);

-- Backfill из заказов: витрина считается посещённой хотя бы раз.
-- visits_count при backfill неизвестен — ставим 1 (на «уникальных людей» не влияет).
insert into public.buyer_store_visits (
  store_id, buyer_user_id, first_visited_at, last_visited_at, visits_count
)
select
  o.store_id,
  o.buyer_user_id,
  min(o.created_at),
  max(o.created_at),
  1
from public.orders o
group by o.store_id, o.buyer_user_id
on conflict (store_id, buyer_user_id) do nothing;

create or replace function public.buyer_store_visit_upsert(
  p_actor_user_id uuid,
  p_store_ref text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_store public.stores;
begin
  if p_actor_user_id is null or p_store_ref is null or btrim(p_store_ref) = '' then
    return null;
  end if;

  select * into v_store from public.stores where public_id = p_store_ref limit 1;
  if not found then
    begin
      select * into v_store from public.stores where id = p_store_ref::uuid limit 1;
    exception
      when invalid_text_representation then
        return null;
    end;
  end if;
  if not found then
    return null;
  end if;

  insert into public.buyer_store_visits (
    store_id, buyer_user_id, first_visited_at, last_visited_at, visits_count
  ) values (
    v_store.id, p_actor_user_id, now(), now(), 1
  )
  on conflict (store_id, buyer_user_id) do update
    set last_visited_at = now(),
        visits_count = public.buyer_store_visits.visits_count + 1;

  return jsonb_build_object(
    'storeId', v_store.id,
    'publicId', v_store.public_id,
    'name', v_store.name,
    'currencySymbol', v_store.currency_symbol
  );
end;
$$;

create or replace function public.buyer_store_list_read(
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if p_actor_user_id is null then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'publicId', t.public_id,
      'name', t.name,
      'lastVisitedAt', t.last_visited_at
    )
    order by t.last_visited_at desc, t.visit_id desc
  ), '[]'::jsonb)
  into v_result
  from (
    select
      s.public_id,
      s.name,
      v.last_visited_at,
      v.id as visit_id
    from public.buyer_store_visits v
    join public.stores s on s.id = v.store_id
    where v.buyer_user_id = p_actor_user_id
    order by v.last_visited_at desc, v.id desc
    limit 20
  ) t;

  return v_result;
end;
$$;

create or replace function public.buyer_active_orders_read(
  p_actor_user_id uuid,
  p_limit int default 20
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_limit int := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_total int := 0;
  v_orders jsonb := '[]'::jsonb;
begin
  if p_actor_user_id is null then
    return jsonb_build_object('orders', '[]'::jsonb, 'total', 0);
  end if;

  select count(*) into v_total
  from public.orders o
  where o.buyer_user_id = p_actor_user_id
    and (
      o.status in ('NEW', 'IN_TRANSIT')
      or (o.status = 'DELIVERED' and o.delivery_outcome is null)
    );

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', t.id,
      'publicOrderNumber', t.public_order_number,
      'status', t.status,
      'createdAt', t.created_at,
      'totalMinor', t.total_minor,
      'currencySymbol', coalesce(t.currency_symbol_snapshot, t.store_currency_symbol),
      'storeName', t.store_name,
      'storePublicId', t.store_public_id
    )
    order by t.created_at desc, t.id desc
  ), '[]'::jsonb)
  into v_orders
  from (
    select
      o.id,
      o.public_order_number,
      o.status,
      o.created_at,
      o.total_minor,
      o.currency_symbol_snapshot,
      s.currency_symbol as store_currency_symbol,
      s.name as store_name,
      s.public_id as store_public_id
    from public.orders o
    join public.stores s on s.id = o.store_id
    where o.buyer_user_id = p_actor_user_id
      and (
        o.status in ('NEW', 'IN_TRANSIT')
        or (o.status = 'DELIVERED' and o.delivery_outcome is null)
      )
    order by o.created_at desc, o.id desc
    limit v_limit
  ) t;

  return jsonb_build_object('orders', v_orders, 'total', v_total);
end;
$$;

create or replace function public.seller_bot_stats_read(
  p_actor_user_id uuid,
  p_store_ref text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_store public.stores;
  v_currency text;
  v_visitors int;
  v_orders_total int;
  v_orders_new int;
  v_orders_in_transit int;
  v_orders_delivered int;
  v_orders_history int;
  v_orders_total_minor bigint;
  v_received_minor bigint;
  v_potential_minor bigint;
begin
  if p_actor_user_id is null or p_store_ref is null or btrim(p_store_ref) = '' then
    return null;
  end if;

  select * into v_store from public.stores where public_id = p_store_ref limit 1;
  if not found then
    begin
      select * into v_store from public.stores where id = p_store_ref::uuid limit 1;
    exception
      when invalid_text_representation then
        return null;
    end;
  end if;
  if not found then
    return null;
  end if;

  -- A store the actor does not own is indistinguishable from a missing one.
  if v_store.owner_user_id is null or v_store.owner_user_id <> p_actor_user_id then
    return null;
  end if;

  v_currency := v_store.currency;

  select count(distinct v.buyer_user_id) into v_visitors
  from public.buyer_store_visits v
  where v.store_id = v_store.id
    and v.buyer_user_id <> v_store.owner_user_id;

  select
    count(*),
    count(*) filter (where o.status = 'NEW'),
    count(*) filter (where o.status = 'IN_TRANSIT'),
    count(*) filter (where o.status = 'DELIVERED'),
    count(*) filter (where o.status in ('REFUSED', 'CANCELLED')),
    coalesce(sum(o.total_minor) filter (where o.currency_code = v_currency), 0),
    coalesce(sum(o.total_minor) filter (where o.delivery_outcome = 'RECEIVED'), 0),
    coalesce(sum(o.total_minor) filter (
      where o.currency_code = v_currency
        and (
          o.status = 'IN_TRANSIT'
          or (o.status = 'DELIVERED' and o.delivery_outcome is null)
        )
    ), 0)
  into
    v_orders_total,
    v_orders_new,
    v_orders_in_transit,
    v_orders_delivered,
    v_orders_history,
    v_orders_total_minor,
    v_received_minor,
    v_potential_minor
  from public.orders o
  where o.store_id = v_store.id;

  return jsonb_build_object(
    'store', jsonb_build_object(
      'id', v_store.id,
      'publicId', v_store.public_id,
      'name', v_store.name,
      'currencyCode', v_currency,
      'currencySymbol', v_store.currency_symbol
    ),
    'visitors', v_visitors,
    'orders', jsonb_build_object(
      'total', v_orders_total,
      'new', v_orders_new,
      'inTransit', v_orders_in_transit,
      'delivered', v_orders_delivered,
      'history', v_orders_history
    ),
    'money', jsonb_build_object(
      'ordersTotalMinor', v_orders_total_minor,
      'receivedMinor', v_received_minor,
      'potentialMinor', v_potential_minor
    )
  );
end;
$$;

-- Grants: закрыть прямой клиентский доступ (0048/0053 pattern). Доверенный путь —
-- edge-функции ботов с admin-ключом.
revoke all on function public.buyer_store_visit_upsert(uuid, text) from public, anon, authenticated;
revoke all on function public.buyer_store_list_read(uuid) from public, anon, authenticated;
revoke all on function public.buyer_active_orders_read(uuid, int) from public, anon, authenticated;
revoke all on function public.seller_bot_stats_read(uuid, text) from public, anon, authenticated;
