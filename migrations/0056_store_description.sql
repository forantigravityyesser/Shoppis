-- 0056_store_description.sql
-- Store description: продавец может задать описание магазина (до 300 символов),
-- покупатель видит его на главной витрины (публичная проекция home-контекста).
--
-- Поле `description` уже существует в public.stores (используется при создании и
-- возвращается в payload'ах 0012), но до сих пор не редактировалось и не входило
-- в покупательскую проекцию (0021/0023). Здесь:
--   1) store_update_profile_atomic принимает `description` (btrim + лимит 300);
--   2) storefront_home_context_read отдаёт `description` в объекте store.
--
-- Пересоздаём функции через `create or replace` с прежними сигнатурами — гранты
-- сохраняются. `storefront_public_context_read` (0021) намеренно не трогаем:
-- описание показывается только на главной (docs/15 §5).

-- ---------------------------------------------------------------------------
-- 1. Профиль магазина: принимает description (docs/12 §5).
-- Канонические поля: name, banner_url, currency, language, support_handle,
-- description.
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 2. Home-контекст витрины: добавляем description в публичную проекцию store.
-- Прочие поля не меняются (0023).
-- ---------------------------------------------------------------------------
create or replace function public.storefront_home_context_read(p_public_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store public.stores;
begin
  if p_public_id is null or btrim(p_public_id) = '' then
    return null;
  end if;

  select * into v_store
  from public.stores
  where public_id = p_public_id
  limit 1;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'store', jsonb_build_object(
      'id', v_store.id,
      'publicId', v_store.public_id,
      'name', v_store.name,
      'description', nullif(btrim(v_store.description), ''),
      'bannerUrl', nullif(v_store.banner_url, ''),
      'status', v_store.status,
      'currencyCode', v_store.currency,
      'currencySymbol', v_store.currency_symbol
    ),
    'categories', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'name', c.name,
          'imageUrl', c.image_storage_key,
          'sortOrder', c.sort_order
        )
        order by c.sort_order asc, c.created_at asc
      )
      from public.categories c
      where c.store_id = v_store.id and c.status = 'ACTIVE'
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.storefront_home_context_read(text) to public;
