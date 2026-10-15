-- 0057_seller_tutorial_state.sql
-- TUT-02 (docs/26 §3.3/§3.6): минимальное серверное хранение состояния обучения
-- продавца на `stores`. Три сущности не смешиваются (docs/26 §3.1):
--   • tutorial state  — прогресс самого сценария обучения (эта миграция);
--   • readiness       — готовность магазина, вычисляется из доменных данных;
--   • growth          — цели по фактическим заказам.
--
-- Содержимое:
--   1) 4 колонки на `stores` + CHECK-констрейнты (включая инвариант status↔step);
--   2) backfill существующих магазинов → welcome='declined' (старые пользователи
--      не получают предложение задним числом — Gate 2);
--   3) общая проекция `_store_projection`, включающая tutorial-поля;
--   4) `store_set_tutorial_state_atomic` — мутация прогресса обучения;
--   5) пересоздание `store_update_profile_atomic`/`store_set_status_atomic` с той же
--      проекцией, чтобы tutorial-поля НЕ терялись в `currentStore` при профильной
--      правке (ловушка проекции §3.6);
--   6) гранты: RPC закрыт для public/anon/authenticated (паттерн 0048), доверенный
--      путь — edge `store-actions` под admin-ключом.
--
-- Субъект состояния — магазин (совместимо с будущей многомагазинностью; сейчас MVP —
-- один магазин на продавца). Отдельной таблицы нет: 4 поля не стоят новой сущности.
--
-- Source: docs/26 §3.3, §3.6, §8.1, §8.2.

-- ---------------------------------------------------------------------------
-- 1. Колонки состояния обучения + CHECK.
-- ---------------------------------------------------------------------------
alter table public.stores
  add column if not exists tutorial_welcome_decision text not null default 'unknown',
  add column if not exists tutorial_status text not null default 'not_started',
  add column if not exists tutorial_step text,
  add column if not exists tutorial_updated_at timestamptz;

alter table public.stores
  drop constraint if exists stores_tutorial_welcome_decision_check,
  add constraint stores_tutorial_welcome_decision_check
    check (tutorial_welcome_decision in ('unknown', 'accepted', 'declined'));

alter table public.stores
  drop constraint if exists stores_tutorial_status_check,
  add constraint stores_tutorial_status_check
    check (tutorial_status in ('not_started', 'in_progress', 'completed', 'dismissed'));

alter table public.stores
  drop constraint if exists stores_tutorial_step_check,
  add constraint stores_tutorial_step_check
    check (tutorial_step is null or tutorial_step in
      ('orientation', 'product-create', 'product-buyer-view', 'storefront', 'finish'));

-- Шаг существует ровно тогда, когда обучение в процессе. Вне `in_progress` — null.
alter table public.stores
  drop constraint if exists stores_tutorial_step_status_invariant,
  add constraint stores_tutorial_step_status_invariant
    check ((tutorial_status = 'in_progress') = (tutorial_step is not null));

-- ---------------------------------------------------------------------------
-- 2. Backfill: существующие магазины не получают предложение задним числом.
-- Новые магазины остаются 'unknown' через default.
-- ---------------------------------------------------------------------------
update public.stores
  set tutorial_welcome_decision = 'declined'
  where tutorial_welcome_decision = 'unknown';

-- ---------------------------------------------------------------------------
-- 3. Общая проекция магазина для admin/store-actions RPC. Единая точка, чтобы
-- проекции profile/status/tutorial не расходились (и не теряли tutorial-поля).
-- ---------------------------------------------------------------------------
create or replace function public._store_projection(p_row public.stores)
returns jsonb
language sql
immutable
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id', p_row.id,
    'owner_user_id', p_row.owner_user_id,
    'owner_telegram_id', p_row.owner_telegram_id,
    'name', p_row.name,
    'description', p_row.description,
    'logo_url', p_row.logo_url,
    'banner_url', p_row.banner_url,
    'support_handle', p_row.support_handle,
    'currency', p_row.currency,
    'currency_symbol', p_row.currency_symbol,
    'language', p_row.language,
    'status', p_row.status,
    'public_id', p_row.public_id,
    'created_at', p_row.created_at,
    'tutorial_welcome_decision', p_row.tutorial_welcome_decision,
    'tutorial_status', p_row.tutorial_status,
    'tutorial_step', p_row.tutorial_step,
    'tutorial_updated_at', p_row.tutorial_updated_at
  );
$$;

revoke all on function public._store_projection(public.stores) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Мутация прогресса обучения. Частичный patch; итоговое состояние валидируется
-- (значения enum + инвариант status↔step). Идемпотентна (PUT-семантика).
-- ---------------------------------------------------------------------------
create or replace function public.store_set_tutorial_state_atomic(
  p_store_id uuid,
  p_actor_user_id uuid,
  p_patch jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.stores;
  v_welcome text;
  v_status text;
  v_step text;
begin
  perform public.stores_assert_owner(p_store_id, p_actor_user_id);

  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'INVALID_TUTORIAL_STATE';
  end if;
  if not ((p_patch ? 'welcome_decision') or (p_patch ? 'status') or (p_patch ? 'step')) then
    raise exception 'INVALID_TUTORIAL_STATE';
  end if;

  select * into v_row from public.stores where id = p_store_id;

  if p_patch ? 'welcome_decision' then
    v_welcome := p_patch->>'welcome_decision';
    if v_welcome is null or v_welcome not in ('unknown', 'accepted', 'declined') then
      raise exception 'INVALID_TUTORIAL_STATE';
    end if;
  else
    v_welcome := v_row.tutorial_welcome_decision;
  end if;

  if p_patch ? 'status' then
    v_status := p_patch->>'status';
    if v_status is null or v_status not in ('not_started', 'in_progress', 'completed', 'dismissed') then
      raise exception 'INVALID_TUTORIAL_STATE';
    end if;
  else
    v_status := v_row.tutorial_status;
  end if;

  if p_patch ? 'step' then
    v_step := p_patch->>'step';
    if v_step is not null and v_step not in
      ('orientation', 'product-create', 'product-buyer-view', 'storefront', 'finish') then
      raise exception 'INVALID_TUTORIAL_STATE';
    end if;
  else
    v_step := v_row.tutorial_step;
  end if;

  if (v_status = 'in_progress') <> (v_step is not null) then
    raise exception 'INVALID_TUTORIAL_STATE';
  end if;

  update public.stores set
    tutorial_welcome_decision = v_welcome,
    tutorial_status = v_status,
    tutorial_step = v_step,
    tutorial_updated_at = now(),
    updated_at = now()
  where id = p_store_id
  returning * into v_row;

  return public._store_projection(v_row);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Пересоздаём profile/status с общей проекцией (иначе tutorial-поля теряются).
-- Тело профильной мутации — версия 0056 (с description); тела не меняем.
-- ---------------------------------------------------------------------------
create or replace function public.store_update_profile_atomic(
  p_store_id uuid,
  p_actor_user_id uuid,
  p_patch jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.stores;
  v_name text;
  v_description text;
  v_currency text;
  v_currency_symbol text;
  v_language text;
  v_has boolean;
begin
  perform public.stores_assert_owner(p_store_id, p_actor_user_id);

  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'EMPTY_PATCH';
  end if;

  v_has := (p_patch ? 'name') or (p_patch ? 'banner_url') or (p_patch ? 'currency')
        or (p_patch ? 'language') or (p_patch ? 'support_handle')
        or (p_patch ? 'description');
  if not v_has then
    raise exception 'EMPTY_PATCH';
  end if;

  if p_patch ? 'name' then
    v_name := btrim(coalesce(p_patch->>'name', ''));
    if v_name = '' then
      raise exception 'NAME_REQUIRED';
    end if;
  end if;

  if p_patch ? 'description' then
    v_description := btrim(coalesce(p_patch->>'description', ''));
    if char_length(v_description) > 300 then
      raise exception 'DESCRIPTION_TOO_LONG';
    end if;
  end if;

  if p_patch ? 'currency' then
    v_currency := p_patch->>'currency';
    if v_currency not in ('USD', 'RUB', 'BYN') then
      raise exception 'INVALID_CURRENCY';
    end if;
    v_currency_symbol := case v_currency
      when 'USD' then '$'
      when 'RUB' then '₽'
      when 'BYN' then 'Br'
    end;
  end if;

  if p_patch ? 'language' then
    v_language := p_patch->>'language';
    if v_language not in ('ru', 'en') then
      raise exception 'INVALID_LANGUAGE';
    end if;
  end if;

  update public.stores set
    name = case when p_patch ? 'name' then v_name else name end,
    description = case when p_patch ? 'description' then v_description else description end,
    banner_url = case when p_patch ? 'banner_url' then coalesce(p_patch->>'banner_url', '') else banner_url end,
    currency = case when p_patch ? 'currency' then v_currency else currency end,
    currency_symbol = case when p_patch ? 'currency' then v_currency_symbol else currency_symbol end,
    language = case when p_patch ? 'language' then v_language else language end,
    support_handle = case when p_patch ? 'support_handle' then coalesce(p_patch->>'support_handle', '') else support_handle end,
    updated_at = now()
  where id = p_store_id
  returning * into v_row;

  return public._store_projection(v_row);
end;
$$;

create or replace function public.store_set_status_atomic(
  p_store_id uuid,
  p_actor_user_id uuid,
  p_status text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.stores;
begin
  perform public.stores_assert_owner(p_store_id, p_actor_user_id);

  if p_status not in ('ACTIVE', 'PAUSED') then
    raise exception 'INVALID_STATUS';
  end if;

  update public.stores set
    status = p_status,
    updated_at = now()
  where id = p_store_id
  returning * into v_row;

  return public._store_projection(v_row);
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Гранты: новый RPC недоступен клиентским ролям (доверенный путь — edge).
-- ---------------------------------------------------------------------------
revoke all on function public.store_set_tutorial_state_atomic(uuid, uuid, jsonb)
  from public, anon, authenticated;
