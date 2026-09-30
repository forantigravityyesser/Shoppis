-- 0012_store_settings_atomic.sql
-- Store settings mutations: partial profile update. Ownership проверяется по
-- actor_user_id, который edge-диспетчер store-actions берёт из серверной сессии
-- (никогда из клиента).
--
-- Source of truth: docs/12 §5. Вызов: client.database.rpc(...) из store-actions.

-- Общий guard: бросает FORBIDDEN, если actor не владеет магазином.
create or replace function public.stores_assert_owner(
  p_store_id uuid,
  p_actor_user_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  select owner_user_id into v_owner from public.stores where id = p_store_id;
  if not found then
    raise exception 'STORE_NOT_FOUND';
  end if;
  if p_actor_user_id is null or v_owner is null or v_owner <> p_actor_user_id then
    raise exception 'FORBIDDEN';
  end if;
end;
$$;

-- Частичное обновление профиля витрины. Меняет только переданные поля блока.
-- Канонические поля: name, banner_url, currency, language, support_handle.
create or replace function public.store_update_profile_atomic(
  p_store_id uuid,
  p_actor_user_id uuid,
  p_patch jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.stores;
  v_name text;
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
        or (p_patch ? 'language') or (p_patch ? 'support_handle');
  if not v_has then
    raise exception 'EMPTY_PATCH';
  end if;

  if p_patch ? 'name' then
    v_name := btrim(coalesce(p_patch->>'name', ''));
    if v_name = '' then
      raise exception 'NAME_REQUIRED';
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
    banner_url = case when p_patch ? 'banner_url' then coalesce(p_patch->>'banner_url', '') else banner_url end,
    currency = case when p_patch ? 'currency' then v_currency else currency end,
    currency_symbol = case when p_patch ? 'currency' then v_currency_symbol else currency_symbol end,
    language = case when p_patch ? 'language' then v_language else language end,
    support_handle = case when p_patch ? 'support_handle' then coalesce(p_patch->>'support_handle', '') else support_handle end,
    updated_at = now()
  where id = p_store_id
  returning * into v_row;

  return jsonb_build_object(
    'id', v_row.id,
    'owner_user_id', v_row.owner_user_id,
    'owner_telegram_id', v_row.owner_telegram_id,
    'name', v_row.name,
    'description', v_row.description,
    'logo_url', v_row.logo_url,
    'banner_url', v_row.banner_url,
    'support_handle', v_row.support_handle,
    'currency', v_row.currency,
    'currency_symbol', v_row.currency_symbol,
    'language', v_row.language,
    'status', v_row.status,
    'public_id', v_row.public_id,
    'created_at', v_row.created_at
  );
end;
$$;

-- Операционное изменение статуса (ACTIVE/PAUSED). Отдельно от profile patch.
create or replace function public.store_set_status_atomic(
  p_store_id uuid,
  p_actor_user_id uuid,
  p_status text
) returns jsonb
language plpgsql
security definer
set search_path = public
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

  return jsonb_build_object(
    'id', v_row.id,
    'owner_user_id', v_row.owner_user_id,
    'owner_telegram_id', v_row.owner_telegram_id,
    'name', v_row.name,
    'description', v_row.description,
    'logo_url', v_row.logo_url,
    'banner_url', v_row.banner_url,
    'support_handle', v_row.support_handle,
    'currency', v_row.currency,
    'currency_symbol', v_row.currency_symbol,
    'language', v_row.language,
    'status', v_row.status,
    'public_id', v_row.public_id,
    'created_at', v_row.created_at
  );
end;
$$;
