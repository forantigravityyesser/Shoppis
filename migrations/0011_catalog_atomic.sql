-- 0011_catalog_atomic.sql
-- Atomic catalog CRUD: product create/update/delete, variant create, category
-- delete, product status. Каждая функция — одна транзакция; владение магазином
-- проверяется по actor_user_id, который edge-диспетчер catalog-actions берёт из
-- серверной сессии (никогда из клиента).
--
-- Source of truth: docs/03 §4-12. Вызов: client.database.rpc(...) из catalog-actions.

-- Общий guard: бросает FORBIDDEN, если actor не владеет магазином.
create or replace function public.catalog_assert_store_owner(
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

-- Создание товара со всеми дочерними сущностями одной транзакцией.
create or replace function public.product_create_atomic(
  p_store_id uuid,
  p_actor_user_id uuid,
  p_product jsonb,
  p_images jsonb default '[]'::jsonb,
  p_attributes jsonb default '[]'::jsonb,
  p_link_attributes jsonb default '[]'::jsonb,
  p_variants jsonb default '[]'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_id uuid;
  v_title text;
  v_description text;
  v_status text;
  v_category uuid;
  v_original bigint;
  v_discount int;
  v_elem jsonb;
  v_ord bigint;
  v_variant_id uuid;
  v_price_mode text;
  v_qty int;
begin
  perform public.catalog_assert_store_owner(p_store_id, p_actor_user_id);

  v_title := btrim(coalesce(p_product->>'title', ''));
  if v_title = '' then
    raise exception 'TITLE_REQUIRED';
  end if;

  v_description := coalesce(p_product->>'description', '');
  v_status := coalesce(nullif(p_product->>'status', ''), 'ACTIVE');
  if v_status not in ('ACTIVE', 'ARCHIVED') then
    raise exception 'INVALID_STATUS';
  end if;
  v_category := nullif(p_product->>'category_id', '')::uuid;
  v_original := greatest(0, coalesce((p_product->>'original_amount_minor')::bigint, 0));
  v_discount := least(100, greatest(0, coalesce((p_product->>'discount_percent')::int, 0)));

  insert into public.products (
    store_id, category_id, title, description, status,
    original_amount_minor, discount_percent, archived_at
  ) values (
    p_store_id, v_category, v_title, v_description, v_status,
    v_original, v_discount,
    case when v_status = 'ARCHIVED' then now() else null end
  )
  returning id into v_product_id;

  if jsonb_typeof(p_images) = 'array' then
    for v_elem, v_ord in
      select value, ordinality
      from jsonb_array_elements(p_images) with ordinality as t(value, ordinality)
    loop
      insert into public.product_images (product_id, storage_key, thumb_storage_key, sort_order)
      values (
        v_product_id,
        v_elem->>'storage_key',
        nullif(v_elem->>'thumb_storage_key', ''),
        (v_ord - 1)::int
      );
    end loop;
  end if;

  if jsonb_typeof(p_attributes) = 'array' then
    for v_elem, v_ord in
      select value, ordinality
      from jsonb_array_elements(p_attributes) with ordinality as t(value, ordinality)
    loop
      insert into public.product_attributes (product_id, name, value, sort_order)
      values (v_product_id, v_elem->>'name', v_elem->>'value', (v_ord - 1)::int);
    end loop;
  end if;

  if jsonb_typeof(p_link_attributes) = 'array' then
    for v_elem, v_ord in
      select value, ordinality
      from jsonb_array_elements(p_link_attributes) with ordinality as t(value, ordinality)
    loop
      insert into public.product_link_attributes (product_id, name, value, sort_order)
      values (v_product_id, v_elem->>'name', v_elem->>'value', (v_ord - 1)::int);
    end loop;
  end if;

  if jsonb_typeof(p_variants) = 'array' then
    if exists (
      select 1
      from (
        select lower(btrim(e->>'value')) as n
        from jsonb_array_elements(p_variants) as t(e)
      ) x
      group by n having count(*) > 1
    ) then
      raise exception 'DUPLICATE_VARIANT';
    end if;

    for v_elem, v_ord in
      select value, ordinality
      from jsonb_array_elements(p_variants) with ordinality as t(value, ordinality)
    loop
      v_price_mode := coalesce(nullif(v_elem->>'price_mode', ''), 'USE_PRODUCT_PRICE');
      v_qty := greatest(0, coalesce((v_elem->>'available_quantity')::int, 0));

      insert into public.variants (
        product_id, name, value, normalized_value, sort_order, status,
        price_mode, custom_original_amount_minor, custom_discount_percent
      ) values (
        v_product_id,
        coalesce(nullif(v_elem->>'name', ''), 'Вариант'),
        v_elem->>'value',
        lower(btrim(v_elem->>'value')),
        (v_ord - 1)::int,
        'ACTIVE',
        v_price_mode,
        nullif(v_elem->>'custom_original_amount_minor', '')::bigint,
        nullif(v_elem->>'custom_discount_percent', '')::smallint
      )
      returning id into v_variant_id;

      insert into public.inventory (variant_id, available_quantity, held_quantity)
      values (v_variant_id, v_qty, 0);
    end loop;
  end if;

  return jsonb_build_object('success', true, 'productId', v_product_id);
end;
$$;

-- Обновление товара. Варианты обрабатываются неразрушающим diff/upsert:
--   * элемент с id  -> обновление существующего варианта (и остатка);
--   * элемент без id -> новый вариант;
--   * существующие ACTIVE, отсутствующие в патче -> ARCHIVED (инвентарь и
--     истории заказов сохраняются; checkout уже требует status = ACTIVE).
create or replace function public.product_update_atomic(
  p_product_id uuid,
  p_actor_user_id uuid,
  p_patch jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product record;
  v_variants jsonb;
  v_elem jsonb;
  v_ord bigint;
  v_ids uuid[];
  v_variant_id uuid;
  v_normalized text;
  v_qty int;
  v_price_mode text;
  v_status text;
  v_active_count int;
begin
  select id, store_id, status into v_product
  from public.products where id = p_product_id for update;
  if not found then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;
  perform public.catalog_assert_store_owner(v_product.store_id, p_actor_user_id);

  if p_patch ? 'title' then
    if btrim(coalesce(p_patch->>'title', '')) = '' then
      raise exception 'TITLE_REQUIRED';
    end if;
    update public.products set title = btrim(p_patch->>'title') where id = p_product_id;
  end if;
  if p_patch ? 'description' then
    update public.products set description = coalesce(p_patch->>'description', '') where id = p_product_id;
  end if;
  if p_patch ? 'category_id' then
    update public.products
    set category_id = nullif(p_patch->>'category_id', '')::uuid
    where id = p_product_id;
  end if;
  if p_patch ? 'original_amount_minor' then
    update public.products
    set original_amount_minor = greatest(0, coalesce((p_patch->>'original_amount_minor')::bigint, 0))
    where id = p_product_id;
  end if;
  if p_patch ? 'discount_percent' then
    update public.products
    set discount_percent = least(100, greatest(0, coalesce((p_patch->>'discount_percent')::int, 0)))
    where id = p_product_id;
  end if;
  if p_patch ? 'status' then
    v_status := nullif(p_patch->>'status', '');
    if v_status not in ('ACTIVE', 'ARCHIVED') then
      raise exception 'INVALID_STATUS';
    end if;
    update public.products
    set status = v_status,
        archived_at = case when v_status = 'ARCHIVED' then now() else null end
    where id = p_product_id;
  end if;

  if p_patch ? 'images' then
    delete from public.product_images where product_id = p_product_id;
    if jsonb_typeof(p_patch->'images') = 'array' then
      for v_elem, v_ord in
        select value, ordinality
        from jsonb_array_elements(p_patch->'images') with ordinality as t(value, ordinality)
      loop
        insert into public.product_images (product_id, storage_key, thumb_storage_key, sort_order)
        values (
          p_product_id,
          v_elem->>'storage_key',
          nullif(v_elem->>'thumb_storage_key', ''),
          (v_ord - 1)::int
        );
      end loop;
    end if;
  end if;

  if p_patch ? 'attributes' then
    delete from public.product_attributes where product_id = p_product_id;
    if jsonb_typeof(p_patch->'attributes') = 'array' then
      for v_elem, v_ord in
        select value, ordinality
        from jsonb_array_elements(p_patch->'attributes') with ordinality as t(value, ordinality)
      loop
        insert into public.product_attributes (product_id, name, value, sort_order)
        values (p_product_id, v_elem->>'name', v_elem->>'value', (v_ord - 1)::int);
      end loop;
    end if;
  end if;

  if p_patch ? 'link_attributes' then
    delete from public.product_link_attributes where product_id = p_product_id;
    if jsonb_typeof(p_patch->'link_attributes') = 'array' then
      for v_elem, v_ord in
        select value, ordinality
        from jsonb_array_elements(p_patch->'link_attributes') with ordinality as t(value, ordinality)
      loop
        insert into public.product_link_attributes (product_id, name, value, sort_order)
        values (p_product_id, v_elem->>'name', v_elem->>'value', (v_ord - 1)::int);
      end loop;
    end if;
  end if;

  if p_patch ? 'variants' then
    v_variants := case
      when jsonb_typeof(p_patch->'variants') = 'array' then p_patch->'variants'
      else '[]'::jsonb
    end;

    -- дубликаты нормализованного значения внутри патча → внятный код
    if exists (
      select 1
      from (
        select lower(btrim(e->>'value')) as n
        from jsonb_array_elements(v_variants) as t(e)
      ) x
      group by n having count(*) > 1
    ) then
      raise exception 'DUPLICATE_VARIANT';
    end if;

    -- id существующих вариантов, которые нужно сохранить
    select coalesce(array_agg((e->>'id')::uuid), '{}'::uuid[])
    into v_ids
    from jsonb_array_elements(v_variants) as t(e)
    where nullif(e->>'id', '') is not null;

    -- отсутствующие в патче ACTIVE-варианты архивируем (не удаляем)
    update public.variants
    set status = 'ARCHIVED', updated_at = now()
    where product_id = p_product_id
      and status = 'ACTIVE'
      and not (id = any (v_ids));

    for v_elem, v_ord in
      select value, ordinality
      from jsonb_array_elements(v_variants) with ordinality as t(value, ordinality)
    loop
      v_variant_id := nullif(v_elem->>'id', '')::uuid;
      v_price_mode := coalesce(nullif(v_elem->>'price_mode', ''), 'USE_PRODUCT_PRICE');
      v_normalized := coalesce(lower(btrim(v_elem->>'value')), '');
      v_qty := greatest(0, coalesce((v_elem->>'available_quantity')::int, 0));

      if v_variant_id is not null
         and exists (select 1 from public.variants where id = v_variant_id and product_id = p_product_id)
      then
        update public.variants
        set name = coalesce(nullif(v_elem->>'name', ''), 'Вариант'),
            value = v_elem->>'value',
            normalized_value = v_normalized,
            sort_order = (v_ord - 1)::int,
            status = 'ACTIVE',
            price_mode = v_price_mode,
            custom_original_amount_minor = nullif(v_elem->>'custom_original_amount_minor', '')::bigint,
            custom_discount_percent = nullif(v_elem->>'custom_discount_percent', '')::smallint,
            updated_at = now()
        where id = v_variant_id;

        if v_elem ? 'available_quantity' then
          update public.inventory
          set available_quantity = v_qty, updated_at = now()
          where variant_id = v_variant_id;
        end if;
      else
        insert into public.variants (
          product_id, name, value, normalized_value, sort_order, status,
          price_mode, custom_original_amount_minor, custom_discount_percent
        ) values (
          p_product_id,
          coalesce(nullif(v_elem->>'name', ''), 'Вариант'),
          v_elem->>'value',
          v_normalized,
          (v_ord - 1)::int,
          'ACTIVE',
          v_price_mode,
          nullif(v_elem->>'custom_original_amount_minor', '')::bigint,
          nullif(v_elem->>'custom_discount_percent', '')::smallint
        )
        returning id into v_variant_id;

        insert into public.inventory (variant_id, available_quantity, held_quantity)
        values (v_variant_id, v_qty, 0);
      end if;
    end loop;
  end if;

  update public.products set updated_at = now() where id = p_product_id;

  -- инвариант ADR-06.8: ACTIVE-товар обязан иметь ≥1 ACTIVE-вариант
  select status into v_status from public.products where id = p_product_id;
  if v_status = 'ACTIVE' then
    select count(*) into v_active_count
    from public.variants where product_id = p_product_id and status = 'ACTIVE';
    if v_active_count = 0 then
      raise exception 'NO_ACTIVE_VARIANT';
    end if;
  end if;

  return jsonb_build_object('success', true, 'productId', p_product_id);
end;
$$;

-- Быстрое добавление одного варианта: variant + inventory + (для первого)
-- базовая цена/скидка товара — одной транзакцией.
create or replace function public.variant_create_atomic(
  p_product_id uuid,
  p_actor_user_id uuid,
  p_variant jsonb,
  p_base_original_amount_minor bigint default null,
  p_base_discount_percent smallint default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store_id uuid;
  v_next int;
  v_variant_id uuid;
  v_qty int;
  v_price_mode text;
begin
  select store_id into v_store_id from public.products where id = p_product_id for update;
  if not found then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;
  perform public.catalog_assert_store_owner(v_store_id, p_actor_user_id);

  select coalesce(max(sort_order), -1) + 1 into v_next
  from public.variants where product_id = p_product_id;

  v_price_mode := coalesce(nullif(p_variant->>'price_mode', ''), 'USE_PRODUCT_PRICE');
  v_qty := greatest(0, coalesce((p_variant->>'available_quantity')::int, 0));

  insert into public.variants (
    product_id, name, value, normalized_value, sort_order, status,
    price_mode, custom_original_amount_minor, custom_discount_percent
  ) values (
    p_product_id,
    coalesce(nullif(p_variant->>'name', ''), 'Вариант'),
    p_variant->>'value',
    lower(btrim(p_variant->>'value')),
    v_next,
    'ACTIVE',
    v_price_mode,
    nullif(p_variant->>'custom_original_amount_minor', '')::bigint,
    nullif(p_variant->>'custom_discount_percent', '')::smallint
  )
  returning id into v_variant_id;

  insert into public.inventory (variant_id, available_quantity, held_quantity)
  values (v_variant_id, v_qty, 0);

  -- первый вариант (единственный у товара) задаёт базовую цену/скидку
  if p_base_original_amount_minor is not null
     and (select count(*) from public.variants where product_id = p_product_id) = 1
  then
    update public.products
    set original_amount_minor = greatest(0, p_base_original_amount_minor),
        discount_percent = least(100, greatest(0, coalesce(p_base_discount_percent, 0))),
        updated_at = now()
    where id = p_product_id;
  end if;

  return jsonb_build_object('success', true, 'productId', p_product_id, 'variantId', v_variant_id);
end;
$$;

-- Смена статуса товара с серверным guard'ом ADR-06.8.
create or replace function public.product_set_status_atomic(
  p_product_id uuid,
  p_actor_user_id uuid,
  p_status text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store_id uuid;
  v_active int;
begin
  select store_id into v_store_id from public.products where id = p_product_id for update;
  if not found then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;
  perform public.catalog_assert_store_owner(v_store_id, p_actor_user_id);

  if p_status not in ('ACTIVE', 'ARCHIVED') then
    raise exception 'INVALID_STATUS';
  end if;

  if p_status = 'ACTIVE' then
    select count(*) into v_active
    from public.variants where product_id = p_product_id and status = 'ACTIVE';
    if v_active = 0 then
      raise exception 'NO_ACTIVE_VARIANT';
    end if;
  end if;

  update public.products
  set status = p_status,
      archived_at = case when p_status = 'ARCHIVED' then now() else null end,
      updated_at = now()
  where id = p_product_id;

  return jsonb_build_object('success', true, 'productId', p_product_id, 'status', p_status);
end;
$$;

-- Удаление товара (только из архива). Возвращает storage-ключи фото,
-- чтобы вызывающий очистил Storage. Каскад удаляет детей.
create or replace function public.product_delete_atomic(
  p_product_id uuid,
  p_actor_user_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product record;
  v_images jsonb;
begin
  select id, store_id, status into v_product
  from public.products where id = p_product_id for update;
  if not found then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;
  perform public.catalog_assert_store_owner(v_product.store_id, p_actor_user_id);

  if v_product.status <> 'ARCHIVED' then
    raise exception 'NOT_ARCHIVED';
  end if;

  select coalesce(
    jsonb_agg(jsonb_build_object(
      'storage_key', storage_key,
      'thumb_storage_key', thumb_storage_key
    )),
    '[]'::jsonb
  )
  into v_images
  from public.product_images
  where product_id = p_product_id;

  delete from public.products where id = p_product_id;

  return jsonb_build_object('success', true, 'productId', p_product_id, 'images', v_images);
end;
$$;

-- Удаление категории: товары теряют привязку (category_id = null), категория
-- удаляется. Возвращает ключ обложки для очистки Storage.
create or replace function public.category_delete_atomic(
  p_category_id uuid,
  p_actor_user_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store_id uuid;
  v_image text;
begin
  select store_id, image_storage_key into v_store_id, v_image
  from public.categories where id = p_category_id for update;
  if not found then
    raise exception 'CATEGORY_NOT_FOUND';
  end if;
  perform public.catalog_assert_store_owner(v_store_id, p_actor_user_id);

  update public.products
  set category_id = null, updated_at = now()
  where category_id = p_category_id;

  delete from public.categories where id = p_category_id;

  return jsonb_build_object(
    'success', true,
    'categoryId', p_category_id,
    'imageStorageKey', v_image
  );
end;
$$;
