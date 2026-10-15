-- 0064_catalog_mutation_gaps.sql
-- Закрытие оставшихся клиентских прямых мутаций каталога (docs/11 §S1, Фаза 3).
--
-- До этой миграции клиент писал напрямую (anon SDK) в `categories`
-- (add/update/status) и `inventory` (available_quantity остатка варианта). Под
-- RLS (Фаза 4) эти пути должны уйти на сервер — здесь добавляются атомарные
-- RPC с actor из подписанной сессии (никогда из клиента), по образцу 0011.
--
-- `variant_stock_update_atomic` трогает ТОЛЬКО `available_quantity`; `held` —
-- custody заказа (docs/21 §3.4), меняется лишь `inventory_reconcile`.
--
-- Source: docs/11 §S1, docs/21 §3.4, docs/03 §4/§12. Вызов — edge catalog-actions.

-- Создание категории: sort_order = max+1, статус ACTIVE. Возвращает проекцию строки.
create or replace function public.category_create_atomic(
  p_store_id uuid,
  p_actor_user_id uuid,
  p_name text,
  p_image_storage_key text default null,
  p_low_stock_threshold int default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_name text;
  v_next int;
  v_row public.categories;
begin
  perform public.catalog_assert_store_owner(p_store_id, p_actor_user_id);

  v_name := btrim(coalesce(p_name, ''));
  if v_name = '' then
    raise exception 'NAME_REQUIRED';
  end if;

  select coalesce(max(sort_order), -1) + 1 into v_next
  from public.categories where store_id = p_store_id;

  begin
    insert into public.categories (
      store_id, name, normalized_name, sort_order, status,
      image_storage_key, low_stock_threshold
    ) values (
      p_store_id, v_name, lower(v_name), v_next, 'ACTIVE',
      nullif(p_image_storage_key, ''), p_low_stock_threshold
    )
    returning * into v_row;
  exception
    when unique_violation then
      raise exception 'DUPLICATE_CATEGORY';
  end;

  return jsonb_build_object('success', true, 'category', to_jsonb(v_row));
end;
$$;

-- Обновление категории: name/normalized_name, обложка, порог остатка. Возвращает
-- прежний ключ обложки (для best-effort очистки Storage вызывающим слоем).
create or replace function public.category_update_atomic(
  p_category_id uuid,
  p_actor_user_id uuid,
  p_patch jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_store_id uuid;
  v_prev_image text;
  v_name text;
begin
  select store_id, image_storage_key into v_store_id, v_prev_image
  from public.categories where id = p_category_id for update;
  if not found then
    raise exception 'CATEGORY_NOT_FOUND';
  end if;
  perform public.catalog_assert_store_owner(v_store_id, p_actor_user_id);

  if p_patch ? 'name' then
    v_name := btrim(coalesce(p_patch->>'name', ''));
    if v_name = '' then
      raise exception 'NAME_REQUIRED';
    end if;
    begin
      update public.categories
      set name = v_name, normalized_name = lower(v_name), updated_at = now()
      where id = p_category_id;
    exception
      when unique_violation then
        raise exception 'DUPLICATE_CATEGORY';
    end;
  end if;

  if p_patch ? 'image_storage_key' then
    update public.categories
    set image_storage_key = nullif(p_patch->>'image_storage_key', ''), updated_at = now()
    where id = p_category_id;
  end if;

  if p_patch ? 'low_stock_threshold' then
    update public.categories
    set low_stock_threshold = nullif(p_patch->>'low_stock_threshold', '')::int, updated_at = now()
    where id = p_category_id;
  end if;

  return jsonb_build_object(
    'success', true,
    'categoryId', p_category_id,
    'imageStorageKey', v_prev_image
  );
end;
$$;

-- Архив/возврат категории (status ACTIVE|ARCHIVED). Привязка товаров не меняется.
create or replace function public.category_set_status_atomic(
  p_category_id uuid,
  p_actor_user_id uuid,
  p_status text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_store_id uuid;
begin
  select store_id into v_store_id
  from public.categories where id = p_category_id for update;
  if not found then
    raise exception 'CATEGORY_NOT_FOUND';
  end if;
  perform public.catalog_assert_store_owner(v_store_id, p_actor_user_id);

  if p_status not in ('ACTIVE', 'ARCHIVED') then
    raise exception 'INVALID_STATUS';
  end if;

  update public.categories
  set status = p_status, updated_at = now()
  where id = p_category_id;

  return jsonb_build_object('success', true, 'categoryId', p_category_id, 'status', p_status);
end;
$$;

-- Продавец правит только доступное количество варианта. `held_quantity` не трогаем
-- (custody заказа; освобождает только inventory_reconcile). Ownership — по магазину.
create or replace function public.variant_stock_update_atomic(
  p_variant_id uuid,
  p_actor_user_id uuid,
  p_available_quantity int
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_store_id uuid;
begin
  select p.store_id into v_store_id
  from public.variants v
  join public.products p on p.id = v.product_id
  where v.id = p_variant_id
  for update of v;
  if not found then
    raise exception 'VARIANT_NOT_FOUND';
  end if;
  perform public.catalog_assert_store_owner(v_store_id, p_actor_user_id);

  update public.inventory
  set available_quantity = greatest(0, coalesce(p_available_quantity, 0)), updated_at = now()
  where variant_id = p_variant_id;
  if not found then
    raise exception 'INVENTORY_NOT_FOUND';
  end if;

  return jsonb_build_object(
    'success', true,
    'variantId', p_variant_id,
    'availableQuantity', greatest(0, coalesce(p_available_quantity, 0))
  );
end;
$$;

-- Закрываем клиентский EXECUTE (default Postgres — PUBLIC). Доверенный путь — edge.
revoke all on function public.category_create_atomic(uuid, uuid, text, text, int) from public, anon, authenticated;
revoke all on function public.category_update_atomic(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.category_set_status_atomic(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.variant_stock_update_atomic(uuid, uuid, int) from public, anon, authenticated;
