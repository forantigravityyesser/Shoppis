-- 0037_variant_effective_price_independent.sql
--
-- docs/20 §4.3 (INV-HARDEN-02): цена и скидка варианта — НЕЗАВИСИМЫЕ оси.
-- Раньше CUSTOM_PRICE применял custom-цену И custom-скидку только когда
-- custom_original_amount_minor IS NOT NULL, поэтому custom только по одной оси
-- замораживал/игнорировал вторую. Теперь:
--   effective original = CUSTOM_PRICE ? coalesce(custom_original, product.original) : product.original
--   effective discount = CUSTOM_PRICE ? coalesce(custom_discount, product.discount) : product.discount
-- Функции пересоздаются с теми же сигнатурами (grants/ownership сохраняются);
-- product_create_atomic / product_update_atomic / variant_create_atomic не меняются.
--
-- Apply as a whole via the admin SQL path. Then record:
--   npm run migrations:record -- 0037

-- create_order_atomic (source: 0004_checkout.sql)
create or replace function public.create_order_atomic(
  p_store_id uuid,
  p_buyer_user_id uuid,
  p_idempotency_key text,
  p_full_name text,
  p_phone text,
  p_address text,
  p_telegram_username text,
  p_items jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_existing uuid;
  v_order_id uuid;
  v_store record;
  v_item jsonb;
  v_variant record;
  v_inv record;
  v_qty int;
  v_original bigint;
  v_discount smallint;
  v_unit bigint;
  v_line bigint;
  v_subtotal bigint := 0;
  v_currency text;
  v_number text;
  v_image text;
  v_linking jsonb;
  v_count int := 0;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_CART';
  end if;

  if p_idempotency_key is not null and p_idempotency_key <> '' then
    select order_id into v_existing
    from public.order_idempotency
    where buyer_user_id = p_buyer_user_id and idempotency_key = p_idempotency_key;

    if v_existing is not null then
      select jsonb_build_object(
        'success', true,
        'orderId', o.id,
        'orderNumber', o.public_order_number,
        'subtotalMinor', o.subtotal_minor,
        'totalMinor', o.total_minor,
        'currencyCode', o.currency_code,
        'idempotent', true
      )
      into v_result
      from public.orders o
      where o.id = v_existing;
      return v_result;
    end if;
  end if;

  select id, status, currency, currency_symbol, owner_telegram_id
  into v_store
  from public.stores
  where id = p_store_id;

  if not found then
    raise exception 'STORE_NOT_FOUND';
  end if;
  if v_store.status <> 'ACTIVE' then
    raise exception 'STORE_PAUSED';
  end if;

  v_currency := coalesce(v_store.currency, 'USD');
  v_number := 'SH-' || to_char(now(), 'YYMMDD') || '-' ||
    upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));

  insert into public.orders (
    public_order_number, store_id, buyer_user_id,
    buyer_full_name_snapshot, buyer_phone_snapshot, buyer_address_snapshot,
    buyer_telegram_username_snapshot, status, currency_code, subtotal_minor, total_minor
  ) values (
    v_number, p_store_id, p_buyer_user_id,
    p_full_name, p_phone, p_address,
    p_telegram_username, 'NEW', v_currency, 0, 0
  )
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := coalesce((v_item->>'quantity')::int, 0);
    if v_qty <= 0 then
      raise exception 'INVALID_QUANTITY';
    end if;

    select va.id, va.product_id, va.name, va.value, va.status as variant_status,
           va.price_mode, va.custom_original_amount_minor, va.custom_discount_percent,
           p.title, p.description, p.status as product_status, p.store_id,
           p.original_amount_minor, p.discount_percent
    into v_variant
    from public.variants va
    join public.products p on p.id = va.product_id
    where va.id = (v_item->>'variantId')::uuid
    for update of va;

    if not found then
      raise exception 'VARIANT_NOT_FOUND';
    end if;
    if v_variant.store_id <> p_store_id then
      raise exception 'FOREIGN_VARIANT';
    end if;
    if v_variant.product_status <> 'ACTIVE' or v_variant.variant_status <> 'ACTIVE' then
      raise exception 'PRODUCT_NOT_ACTIVE';
    end if;

    select * into v_inv from public.inventory where variant_id = v_variant.id for update;
    if not found then
      raise exception 'INVENTORY_NOT_FOUND';
    end if;
    if v_inv.available_quantity < v_qty then
      raise exception 'INSUFFICIENT_STOCK';
    end if;

    if v_variant.price_mode = 'CUSTOM_PRICE' then
      v_original := coalesce(v_variant.custom_original_amount_minor, v_variant.original_amount_minor);
      v_discount := coalesce(v_variant.custom_discount_percent, v_variant.discount_percent, 0);
    else
      v_original := v_variant.original_amount_minor;
      v_discount := coalesce(v_variant.discount_percent, 0);
    end if;
    v_unit := round(v_original::numeric * (100 - v_discount) / 100)::bigint;
    v_line := v_unit * v_qty;

    select pi.storage_key into v_image
    from public.product_images pi
    where pi.product_id = v_variant.product_id
    order by pi.sort_order asc
    limit 1;

    select coalesce(
      jsonb_agg(jsonb_build_object('name', a.name, 'value', a.value) order by a.sort_order),
      '[]'::jsonb
    )
    into v_linking
    from public.product_link_attributes a
    where a.product_id = v_variant.product_id;

    insert into public.order_items (
      order_id, product_id, variant_id,
      product_title_snapshot, product_description_snapshot, product_image_snapshot,
      linking_attributes_snapshot, variant_name_snapshot, variant_value_snapshot,
      quantity, original_unit_price_minor, discount_percent, unit_price_minor, line_total_minor,
      currency_code
    ) values (
      v_order_id, v_variant.product_id, v_variant.id,
      v_variant.title, v_variant.description, v_image,
      v_linking, v_variant.name, v_variant.value,
      v_qty, v_original, v_discount, v_unit, v_line,
      v_currency
    );

    update public.inventory
    set available_quantity = available_quantity - v_qty,
        held_quantity = held_quantity + v_qty,
        updated_at = now()
    where variant_id = v_variant.id;

    insert into public.inventory_movements (
      variant_id, order_id, movement_type, quantity, from_bucket, to_bucket,
      actor_type, actor_user_id, reason_code
    ) values (
      v_variant.id, v_order_id, 'ORDER_RESERVE', v_qty, 'AVAILABLE', 'HELD',
      'buyer', p_buyer_user_id, 'ORDER_CREATED'
    );

    v_subtotal := v_subtotal + v_line;
    v_count := v_count + 1;
  end loop;

  update public.orders
  set subtotal_minor = v_subtotal,
      total_minor = v_subtotal,
      updated_at = now()
  where id = v_order_id;

  insert into public.order_status_history (
    order_id, from_status, to_status, actor_type, actor_user_id, reason_code
  ) values (
    v_order_id, null, 'NEW', 'buyer', p_buyer_user_id, null
  );

  if p_idempotency_key is not null and p_idempotency_key <> '' then
    insert into public.order_idempotency (idempotency_key, buyer_user_id, order_id)
    values (p_idempotency_key, p_buyer_user_id, v_order_id)
    on conflict (buyer_user_id, idempotency_key) do nothing;
  end if;

  return jsonb_build_object(
    'success', true,
    'orderId', v_order_id,
    'orderNumber', v_number,
    'subtotalMinor', v_subtotal,
    'totalMinor', v_subtotal,
    'currencyCode', v_currency,
    'currencySymbol', v_store.currency_symbol,
    'sellerTelegramId', v_store.owner_telegram_id,
    'itemCount', v_count,
    'idempotent', false
  );
end;
$$;

-- storefront_home_products_read (source: 0023_storefront_home_split_read.sql)
create or replace function public.storefront_home_products_read(
  p_public_id text,
  p_cursor text default null,
  p_limit int default 6
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store public.stores;
  -- Hard cap for the public RPC: client asks 6/12/24 → as-is; asks 5000 → 24.
  v_limit int := least(greatest(coalesce(p_limit, 6), 1), 24);
  v_cursor_ts timestamptz;
  v_cursor_id uuid;
  v_result jsonb;
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

  -- PAUSED store is not a product surface: empty page (defense-in-depth with the
  -- frontend `enabled` gate). HOME-FIX-03.
  if v_store.status <> 'ACTIVE' then
    return jsonb_build_object('products', '[]'::jsonb, 'nextCursor', null);
  end if;

  -- Keyset cursor "<epoch_microseconds>:<id>"; malformed → first page.
  if p_cursor is not null and btrim(p_cursor) <> '' then
    begin
      v_cursor_ts := to_timestamp(split_part(p_cursor, ':', 1)::bigint / 1000000.0);
      v_cursor_id := split_part(p_cursor, ':', 2)::uuid;
    exception
      when others then
        v_cursor_ts := null;
        v_cursor_id := null;
    end;
  end if;

  with base as (
    select
      p.id,
      p.title,
      c.id as category_id,
      img.image_url,
      p.created_at,
      -- Effective price of the first active variant; fallback to product pricing
      -- when the product has no active variant (should not happen for ACTIVE).
      coalesce(v.original_amount_minor, p.original_amount_minor) as original_amount_minor,
      coalesce(v.discount_percent, p.discount_percent) as discount_percent,
      coalesce(stock.available, false) as available
    from public.products p
    -- Visible category: an ARCHIVED category is not public, so the card is
    -- uncategorized on the storefront (product.category_id is NOT mutated).
    left join public.categories c
      on c.id = p.category_id and c.status = 'ACTIVE'
    -- Lightest image: thumb first, fallback to full.
    left join lateral (
      select coalesce(nullif(pi.thumb_storage_key, ''), nullif(pi.storage_key, '')) as image_url
      from public.product_images pi
      where pi.product_id = p.id
      order by pi.sort_order asc
      limit 1
    ) img on true
    -- First active variant (sort_order, then created_at) determines the price.
    left join lateral (
      select
        case
          when vv.price_mode = 'CUSTOM_PRICE'
            then coalesce(vv.custom_original_amount_minor, p.original_amount_minor)
          else p.original_amount_minor
        end as original_amount_minor,
        case
          when vv.price_mode = 'CUSTOM_PRICE'
            then coalesce(vv.custom_discount_percent, p.discount_percent)
          else p.discount_percent
        end as discount_percent
      from public.variants vv
      where vv.product_id = p.id and vv.status = 'ACTIVE'
      order by vv.sort_order asc, vv.created_at asc
      limit 1
    ) v on true
    -- Sold out: all active variants have available_quantity = 0. Card stays visible.
    left join lateral (
      select bool_or(inv.available_quantity > 0) as available
      from public.variants vv
      join public.inventory inv on inv.variant_id = vv.id
      where vv.product_id = p.id and vv.status = 'ACTIVE'
    ) stock on true
    where p.store_id = v_store.id
      and p.status = 'ACTIVE'
      and (
        v_cursor_ts is null
        or (p.created_at, p.id) < (v_cursor_ts, v_cursor_id)
      )
    order by p.created_at desc, p.id desc
    limit v_limit + 1
  ),
  numbered as (
    select *, row_number() over (order by created_at desc, id desc) as rn
    from base
  )
  select jsonb_build_object(
    'products', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', id,
          'title', title,
          'categoryId', category_id,
          'imageUrl', image_url,
          -- Effective price only: round(original * (100 - discount) / 100) in minor
          -- units. Home cards intentionally expose no originalPrice / discount
          -- (those belong to Product Detail). docs/15 §3.9, §7.4.
          'price', ((original_amount_minor * (100 - discount_percent)) + 50) / 100,
          'available', available
        )
        order by created_at desc, id desc
      )
      from numbered
      where rn <= v_limit
    ), '[]'::jsonb),
    -- Cursor points at the LAST row of this page; the next page is the rows
    -- strictly after it. The limit+1 probe row only signals that a next page exists.
    'nextCursor', case
      when exists (select 1 from numbered where rn = v_limit + 1)
      then (
        select (extract(epoch from created_at) * 1000000)::bigint::text || ':' || id::text
        from numbered
        where rn = v_limit
      )
      else null
    end
  )
  into v_result;

  return v_result;
end;
$$;

-- storefront_product_detail_read (source: 0030_related_products_limit.sql)
create or replace function public.storefront_product_detail_read(
  p_public_id text,
  p_product_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store public.stores;
  v_product public.products;
  v_result jsonb;
begin
  if p_public_id is null or btrim(p_public_id) = '' or p_product_id is null then
    return null;
  end if;

  select * into v_store
  from public.stores
  where public_id = p_public_id
  limit 1;

  if not found then
    return null;
  end if;

  select * into v_product
  from public.products
  where id = p_product_id
    and store_id = v_store.id
  limit 1;

  if not found then
    return null;
  end if;

  if v_product.status <> 'ACTIVE' then
    return null;
  end if;

  select jsonb_build_object(
    'store', jsonb_build_object(
      'id', v_store.id,
      'publicId', v_store.public_id,
      'name', v_store.name,
      'currencyCode', v_store.currency,
      'currencySymbol', v_store.currency_symbol,
      'status', v_store.status
    ),
    'product', jsonb_build_object(
      'id', v_product.id,
      'title', v_product.title,
      'description', v_product.description,
      'categoryId', (
        select c.id
        from public.categories c
        where c.id = v_product.category_id and c.status = 'ACTIVE'
      )
    ),
    'images', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'url', pi.storage_key,
          'thumbUrl', nullif(pi.thumb_storage_key, ''),
          'sortOrder', pi.sort_order
        )
        order by pi.sort_order asc, pi.created_at asc
      )
      from public.product_images pi
      where pi.product_id = v_product.id
    ), '[]'::jsonb),
    'linkAttributes', coalesce((
      select jsonb_agg(
        jsonb_build_object('name', pla.name, 'value', pla.value)
        order by pla.sort_order asc
      )
      from public.product_link_attributes pla
      where pla.product_id = v_product.id
    ), '[]'::jsonb),
    'attributes', coalesce((
      select jsonb_agg(
        jsonb_build_object('name', pa.name, 'value', pa.value)
        order by pa.sort_order asc
      )
      from public.product_attributes pa
      where pa.product_id = v_product.id
    ), '[]'::jsonb),
    'variants', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', t.id,
          'name', t.name,
          'value', t.value,
          'price', ((t.original_amount_minor * (100 - t.discount_percent)) + 50) / 100,
          'originalPrice', case when t.discount_percent > 0 then t.original_amount_minor else null end,
          'availableQuantity', t.available_quantity,
          'available', t.available_quantity > 0
        )
        order by t.sort_order asc, t.created_at asc
      )
      from (
        select
          vv.id,
          vv.name,
          vv.value,
          vv.sort_order,
          vv.created_at,
          case
            when vv.price_mode = 'CUSTOM_PRICE'
              then coalesce(vv.custom_original_amount_minor, v_product.original_amount_minor)
            else v_product.original_amount_minor
          end as original_amount_minor,
          case
            when vv.price_mode = 'CUSTOM_PRICE'
              then coalesce(vv.custom_discount_percent, v_product.discount_percent)
            else v_product.discount_percent
          end as discount_percent,
          coalesce(inv.available_quantity, 0) as available_quantity
        from public.variants vv
        left join public.inventory inv on inv.variant_id = vv.id
        where vv.product_id = v_product.id
          and vv.status = 'ACTIVE'
      ) t
    ), '[]'::jsonb),
    'rating', (
      select jsonb_build_object(
        'average', coalesce(round(avg(r.rating)::numeric, 1), 0),
        'count', count(*)
      )
      from public.reviews r
      where r.product_id = v_product.id
        and r.status = 'ACTIVE'
    ),
    'questionsCount', (
      select count(*)
      from public.questions q
      where q.product_id = v_product.id
        and q.status = 'ACTIVE'
    ),
    -- "Похожее" = explicit direct links (bidirectional, non-transitive), newest first.
    'relatedProducts', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', rc.id,
          'title', rc.title,
          'imageUrl', rc.image_url,
          'price', ((rc.original_amount_minor * (100 - rc.discount_percent)) + 50) / 100,
          'originalPrice', case when rc.discount_percent > 0 then rc.original_amount_minor else null end,
          'available', rc.available
        )
        order by rc.link_created_at desc
      )
      from (
        select
          p.id,
          p.title,
          l.created_at as link_created_at,
          img.image_url,
          coalesce(v.original_amount_minor, p.original_amount_minor) as original_amount_minor,
          coalesce(v.discount_percent, p.discount_percent) as discount_percent,
          coalesce(stock.available, false) as available
        from public.product_links l
        join public.products p
          on p.id = case
            when l.product_id = v_product.id then l.related_product_id
            else l.product_id
          end
        left join lateral (
          select coalesce(nullif(pi.thumb_storage_key, ''), nullif(pi.storage_key, '')) as image_url
          from public.product_images pi
          where pi.product_id = p.id
          order by pi.sort_order asc
          limit 1
        ) img on true
        left join lateral (
          select
            case
              when vv.price_mode = 'CUSTOM_PRICE'
                then coalesce(vv.custom_original_amount_minor, p.original_amount_minor)
              else p.original_amount_minor
            end as original_amount_minor,
            case
              when vv.price_mode = 'CUSTOM_PRICE'
                then coalesce(vv.custom_discount_percent, p.discount_percent)
              else p.discount_percent
            end as discount_percent
          from public.variants vv
          where vv.product_id = p.id and vv.status = 'ACTIVE'
          order by vv.sort_order asc, vv.created_at asc
          limit 1
        ) v on true
        left join lateral (
          select bool_or(inv.available_quantity > 0) as available
          from public.variants vv
          join public.inventory inv on inv.variant_id = vv.id
          where vv.product_id = p.id and vv.status = 'ACTIVE'
        ) stock on true
        where (l.product_id = v_product.id or l.related_product_id = v_product.id)
          and p.store_id = v_store.id
          and p.status = 'ACTIVE'
          and p.id <> v_product.id
        order by link_created_at desc
        limit 8
      ) rc
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

-- storefront_catalog_products_read (source: 0033_storefront_catalog_hardening.sql)
create or replace function public.storefront_catalog_products_read(
  p_public_id text,
  p_category_id uuid default null,
  p_search text default null,
  p_min_price int default null,
  p_max_price int default null,
  p_cursor text default null,
  p_limit int default 12
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store public.stores;
  -- Hard cap for the public RPC: client asks 12/24 -> as-is; asks 5000 -> 24.
  v_limit int := least(greatest(coalesce(p_limit, 12), 1), 24);
  v_cursor_ts timestamptz;
  v_cursor_id uuid;
  -- Escape ILIKE wildcards so search is literal. Backslash first, then % and _.
  -- nullif before replace keeps the "blank -> no filter" behaviour (replace(null) = null).
  v_search text := replace(
    replace(replace(nullif(btrim(coalesce(p_search, '')), ''), '\', '\\'), '%', '\%'),
    '_', '\_'
  );
  v_empty jsonb := jsonb_build_object('products', '[]'::jsonb, 'nextCursor', null);
  v_result jsonb;
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

  -- Paused/closed store is not a public product surface (parity with 0023 Home).
  if v_store.status <> 'ACTIVE' then
    return v_empty;
  end if;

  -- Unknown / foreign / archived category -> empty result, not an error. This keeps the
  -- catalog multi-shop safe: a category id from another store never matches.
  if p_category_id is not null and not exists (
    select 1
    from public.categories c
    where c.id = p_category_id
      and c.store_id = v_store.id
      and c.status = 'ACTIVE'
  ) then
    return v_empty;
  end if;

  -- Inverted range -> empty (the UI slider also guards min <= max).
  if p_min_price is not null and p_max_price is not null and p_min_price > p_max_price then
    return v_empty;
  end if;

  -- Keyset cursor "<epoch_microseconds>:<id>"; malformed -> first page.
  if p_cursor is not null and btrim(p_cursor) <> '' then
    begin
      v_cursor_ts := to_timestamp(split_part(p_cursor, ':', 1)::bigint / 1000000.0);
      v_cursor_id := split_part(p_cursor, ':', 2)::uuid;
    exception
      when others then
        v_cursor_ts := null;
        v_cursor_id := null;
    end;
  end if;

  with base as (
    select
      p.id,
      p.title,
      c.id as category_id,
      img.image_url,
      p.created_at,
      -- Effective price of the first active variant (minor units); product fallback when
      -- the product has no active variant. Same formula/rounding as Storefront Home.
      ((coalesce(v.original_amount_minor, p.original_amount_minor)
        * (100 - coalesce(v.discount_percent, p.discount_percent))) + 50) / 100 as effective_price_minor,
      coalesce(stock.available, false) as available
    from public.products p
    -- Visible category: an ARCHIVED category is not public, so the card is
    -- uncategorized on the storefront (product.category_id is NOT mutated).
    left join public.categories c
      on c.id = p.category_id and c.status = 'ACTIVE'
    -- Lightest image: thumb first, fallback to full.
    left join lateral (
      select coalesce(nullif(pi.thumb_storage_key, ''), nullif(pi.storage_key, '')) as image_url
      from public.product_images pi
      where pi.product_id = p.id
      order by pi.sort_order asc
      limit 1
    ) img on true
    -- First active variant (sort_order, then created_at) determines the price.
    left join lateral (
      select
        case
          when vv.price_mode = 'CUSTOM_PRICE'
            then coalesce(vv.custom_original_amount_minor, p.original_amount_minor)
          else p.original_amount_minor
        end as original_amount_minor,
        case
          when vv.price_mode = 'CUSTOM_PRICE'
            then coalesce(vv.custom_discount_percent, p.discount_percent)
          else p.discount_percent
        end as discount_percent
      from public.variants vv
      where vv.product_id = p.id and vv.status = 'ACTIVE'
      order by vv.sort_order asc, vv.created_at asc
      limit 1
    ) v on true
    -- Sold out: all active variants have available_quantity = 0. Card stays visible.
    left join lateral (
      select bool_or(inv.available_quantity > 0) as available
      from public.variants vv
      join public.inventory inv on inv.variant_id = vv.id
      where vv.product_id = p.id and vv.status = 'ACTIVE'
    ) stock on true
    where p.store_id = v_store.id
      and p.status = 'ACTIVE'
      and (p_category_id is null or p.category_id = p_category_id)
      -- Literal search: wildcards are escaped in v_search, explicit escape char.
      and (v_search is null or p.title ilike '%' || v_search || '%' escape '\')
  ),
  filtered as (
    select *
    from base
    where (p_min_price is null or effective_price_minor >= p_min_price)
      and (p_max_price is null or effective_price_minor <= p_max_price)
      and (v_cursor_ts is null or (created_at, id) < (v_cursor_ts, v_cursor_id))
    order by created_at desc, id desc
    limit v_limit + 1
  ),
  numbered as (
    select *, row_number() over (order by created_at desc, id desc) as rn
    from filtered
  )
  select jsonb_build_object(
    'products', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', id,
          'title', title,
          'categoryId', category_id,
          'imageUrl', image_url,
          -- Effective price only: round(original * (100 - discount) / 100) in minor
          -- units. Catalog cards expose no originalPrice / discount (Product Detail
          -- owns those). docs/17 §2.
          'price', effective_price_minor,
          'available', available
        )
        order by created_at desc, id desc
      )
      from numbered
      where rn <= v_limit
    ), '[]'::jsonb),
    -- Cursor points at the LAST row of this page; the next page is the rows
    -- strictly after it. The limit+1 probe row only signals that a next page exists.
    'nextCursor', case
      when exists (select 1 from numbered where rn = v_limit + 1)
      then (
        select (extract(epoch from created_at) * 1000000)::bigint::text || ':' || id::text
        from numbered
        where rn = v_limit
      )
      else null
    end
  )
  into v_result;

  return v_result;
end;
$$;

-- storefront_catalog_price_bounds_read (source: 0033_storefront_catalog_hardening.sql)
create or replace function public.storefront_catalog_price_bounds_read(p_public_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store public.stores;
  v_min bigint;
  v_max bigint;
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

  -- Paused/closed store has no public price surface (parity with 0023 Home).
  if v_store.status <> 'ACTIVE' then
    return null;
  end if;

  -- Store-wide bounds over ACTIVE products, using the same effective-price semantics
  -- as the catalog cards (first ACTIVE variant, CUSTOM_PRICE override, product fallback).
  -- Static in the MVP: not recomputed per filter / category (docs/17 §2.2).
  select min(t.effective_price_minor), max(t.effective_price_minor)
  into v_min, v_max
  from (
    select
      ((coalesce(v.original_amount_minor, p.original_amount_minor)
        * (100 - coalesce(v.discount_percent, p.discount_percent))) + 50) / 100 as effective_price_minor
    from public.products p
    left join lateral (
      select
        case
          when vv.price_mode = 'CUSTOM_PRICE'
            then coalesce(vv.custom_original_amount_minor, p.original_amount_minor)
          else p.original_amount_minor
        end as original_amount_minor,
        case
          when vv.price_mode = 'CUSTOM_PRICE'
            then coalesce(vv.custom_discount_percent, p.discount_percent)
          else p.discount_percent
        end as discount_percent
      from public.variants vv
      where vv.product_id = p.id and vv.status = 'ACTIVE'
      order by vv.sort_order asc, vv.created_at asc
      limit 1
    ) v on true
    where p.store_id = v_store.id
      and p.status = 'ACTIVE'
  ) t;

  return jsonb_build_object(
    'minPrice', v_min,
    'maxPrice', v_max
  );
end;
$$;

-- storefront_favorite_products_read (source: 0035_storefront_favorite_products_read.sql)
create or replace function public.storefront_favorite_products_read(
  p_public_id text,
  p_ids uuid[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store public.stores;
  v_ids uuid[];
  v_empty jsonb := jsonb_build_object('products', '[]'::jsonb);
  v_result jsonb;
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

  -- Paused/closed store is not a public product surface (parity with 0023/0033).
  if v_store.status <> 'ACTIVE' then
    return v_empty;
  end if;

  if p_ids is null or cardinality(p_ids) = 0 then
    return v_empty;
  end if;

  -- Public RPC: cap the id list (favorites are small in practice).
  v_ids := p_ids[1:least(cardinality(p_ids), 100)];

  with wanted as (
    -- Dedupe while preserving the caller's order (first occurrence wins).
    select id, min(ord) as ord
    from unnest(v_ids) with ordinality as t(id, ord)
    group by id
  ),
  base as (
    select
      p.id,
      p.title,
      c.id as category_id,
      img.image_url,
      w.ord,
      -- Effective price of the first active variant (minor units); product fallback when
      -- the product has no active variant. Same formula/rounding as Storefront Home.
      ((coalesce(v.original_amount_minor, p.original_amount_minor)
        * (100 - coalesce(v.discount_percent, p.discount_percent))) + 50) / 100 as effective_price_minor,
      coalesce(stock.available, false) as available
    from public.products p
    join wanted w on w.id = p.id
    -- Visible category: an ARCHIVED category is not public, so the card is uncategorized
    -- on the storefront (product.category_id is NOT mutated).
    left join public.categories c
      on c.id = p.category_id and c.status = 'ACTIVE'
    -- Lightest image: thumb first, fallback to full.
    left join lateral (
      select coalesce(nullif(pi.thumb_storage_key, ''), nullif(pi.storage_key, '')) as image_url
      from public.product_images pi
      where pi.product_id = p.id
      order by pi.sort_order asc
      limit 1
    ) img on true
    -- First active variant (sort_order, then created_at) determines the price.
    left join lateral (
      select
        case
          when vv.price_mode = 'CUSTOM_PRICE'
            then coalesce(vv.custom_original_amount_minor, p.original_amount_minor)
          else p.original_amount_minor
        end as original_amount_minor,
        case
          when vv.price_mode = 'CUSTOM_PRICE'
            then coalesce(vv.custom_discount_percent, p.discount_percent)
          else p.discount_percent
        end as discount_percent
      from public.variants vv
      where vv.product_id = p.id and vv.status = 'ACTIVE'
      order by vv.sort_order asc, vv.created_at asc
      limit 1
    ) v on true
    -- Sold out: all active variants have available_quantity = 0. Card stays visible.
    left join lateral (
      select bool_or(inv.available_quantity > 0) as available
      from public.variants vv
      join public.inventory inv on inv.variant_id = vv.id
      where vv.product_id = p.id and vv.status = 'ACTIVE'
    ) stock on true
    where p.store_id = v_store.id
      and p.status = 'ACTIVE'
  )
  select jsonb_build_object(
    'products', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', id,
          'title', title,
          'categoryId', category_id,
          'imageUrl', image_url,
          -- Effective price only; Catalog/Favorites cards expose no originalPrice/discount.
          'price', effective_price_minor,
          'available', available
        )
        order by ord
      )
      from base
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

-- storefront_cart_items_read (source: 0036_storefront_cart_items_read.sql)
create or replace function public.storefront_cart_items_read(
  p_public_id text,
  p_items jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store public.stores;
  v_items jsonb;
  v_result jsonb;
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

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    v_items := '[]'::jsonb;
  else
    -- Public RPC: cap the reference list. Keep order; refs are tiny in practice.
    select coalesce(jsonb_agg(value order by ord), '[]'::jsonb)
    into v_items
    from jsonb_array_elements(p_items) with ordinality as t(value, ord)
    where ord <= 100;
  end if;

  with refs as (
    select
      -- Strict UUID shape check so a malformed client ref can never raise: it simply
      -- resolves to null (not found) and is removed during reconciliation.
      case
        when (elem->>'productId') ~
          '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
          then (elem->>'productId')::uuid
        else null
      end as product_id,
      case
        when (elem->>'variantId') ~
          '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
          then (elem->>'variantId')::uuid
        else null
      end as variant_id,
      ord
    from jsonb_array_elements(v_items) with ordinality as t(elem, ord)
  ),
  resolved as (
    select
      r.ord,
      r.product_id,
      r.variant_id,
      (p.id is not null and p.status = 'ACTIVE') as product_available,
      (va.id is not null and va.status = 'ACTIVE') as variant_available,
      p.title as title,
      img.image_url as image_url,
      va.name as variant_name,
      va.value as variant_value,
      case
        -- No resolved variant -> no price for the reference (not a product fallback).
        when va.id is null then null
        when va.price_mode = 'CUSTOM_PRICE'
          then ((coalesce(va.custom_original_amount_minor, p.original_amount_minor)
                 * (100 - coalesce(va.custom_discount_percent, p.discount_percent, 0))) + 50) / 100
        else ((p.original_amount_minor
               * (100 - coalesce(p.discount_percent, 0))) + 50) / 100
      end as unit_price,
      coalesce(inv.available_quantity, 0) as available_quantity
    from refs r
    left join public.products p
      on p.id = r.product_id and p.store_id = v_store.id
    left join public.variants va
      on va.id = r.variant_id and va.product_id = r.product_id
    left join public.inventory inv
      on inv.variant_id = va.id
    left join lateral (
      select coalesce(nullif(pi.thumb_storage_key, ''), nullif(pi.storage_key, '')) as image_url
      from public.product_images pi
      where pi.product_id = p.id
      order by pi.sort_order asc
      limit 1
    ) img on true
  )
  select jsonb_build_object(
    'store', jsonb_build_object(
      'id', v_store.id,
      'publicId', v_store.public_id,
      'name', v_store.name,
      'status', v_store.status,
      'currencyCode', v_store.currency,
      'currencySymbol', v_store.currency_symbol
    ),
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'productId', product_id,
          'variantId', variant_id,
          'productAvailable', product_available,
          'variantAvailable', variant_available,
          'title', title,
          'imageUrl', image_url,
          'variantName', variant_name,
          'variantValue', variant_value,
          'unitPrice', unit_price,
          'availableQuantity', available_quantity
        )
        order by ord
      )
      from resolved
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;
