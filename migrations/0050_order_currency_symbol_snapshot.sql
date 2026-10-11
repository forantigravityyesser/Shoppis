-- 0050_order_currency_symbol_snapshot.sql
-- ORD-HARDEN-03 (docs/24 §2.2 / §3.3): исторический символ валюты заказа.
--
-- Сумма заказа уже immutable (`total_minor`), но символ брался из текущего
-- `stores.currency_symbol`. Смена валюты магазина (USD $ → RUB ₽) искажала
-- прошлые заказы: та же сумма начинала отображаться с другим символом.
--
-- Решение:
--   * `orders.currency_symbol_snapshot` — immutable-снимок символа на checkout;
--   * `public.currency_symbol_for(code)` — детерминированный fallback по ISO-коду
--     (та же карта, что в `0012`/frontend `currencies.ts`);
--   * backfill существующих заказов: символ текущего магазина, если его валюта
--     совпадает с сохранённым `currency_code`; иначе — по самому `currency_code`;
--   * `create_order_atomic` пишет снимок при оформлении;
--   * `order_list_read` / `order_detail_read` читают снимок с fallback по коду.
--
-- `create or replace` сохраняет сигнатуры, ownership и отозванные в `0048`
-- EXECUTE-гранты. Apply as a whole via the admin SQL path. Then record:
--   npm run migrations:record -- 0050

alter table public.orders add column if not exists currency_symbol_snapshot text;

create or replace function public.currency_symbol_for(p_code text)
returns text
language sql
immutable
as $$
  select case upper(btrim(coalesce(p_code, '')))
    when 'USD' then '$'
    when 'RUB' then '₽'
    when 'BYN' then 'Br'
    when 'EUR' then '€'
    else null
  end;
$$;

update public.orders o
set currency_symbol_snapshot = coalesce(
  case when s.currency = o.currency_code then nullif(btrim(s.currency_symbol), '') end,
  public.currency_symbol_for(o.currency_code),
  nullif(btrim(s.currency_symbol), '')
)
from public.stores s
where s.id = o.store_id
  and o.currency_symbol_snapshot is null;

-- ── Checkout: снимок символа ────────────────────────────────────────────────
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
  -- Единый контракт количества (docs/18 §11, docs/21 §3.3): зеркало MAX_CART_QTY.
  c_max_item_qty constant int := 99;
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
  v_symbol text;
  v_number text;
  v_image text;
  v_linking jsonb;
  v_count int := 0;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_CART';
  end if;

  -- Idempotency обязателен (docs/21 §3.1-3.2): сервер не создаёт заказ без ключа.
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'IDEMPOTENCY_KEY_REQUIRED';
  end if;

  -- Server quantity contract (docs/21 §3.3): reject duplicate variants (client must
  -- send a normalized cart); per-item quantity bounds are enforced in the loop.
  if (select count(*) from jsonb_array_elements(p_items)) <>
     (select count(distinct item->>'variantId') from jsonb_array_elements(p_items) as item) then
    raise exception 'VARIANT_DUPLICATE';
  end if;

  -- Idempotency (docs/21 §3.2): reserve-or-fetch atomically BEFORE creating the
  -- order. The reservation row (order_id = null) is invisible to other
  -- transactions until commit; a concurrent duplicate blocks here and, after our
  -- commit, reads the order_id and returns the existing order instead of creating
  -- a second one.
  insert into public.order_idempotency (idempotency_key, buyer_user_id, order_id)
  values (p_idempotency_key, p_buyer_user_id, null)
  on conflict (buyer_user_id, idempotency_key) do nothing;

  select order_id into v_existing
  from public.order_idempotency
  where buyer_user_id = p_buyer_user_id and idempotency_key = p_idempotency_key
  for update;

  if v_existing is not null then
    select jsonb_build_object(
      'success', true,
      'orderId', o.id,
      'orderNumber', o.public_order_number,
      'subtotalMinor', o.subtotal_minor,
      'totalMinor', o.total_minor,
      'currencyCode', o.currency_code,
      'currencySymbol', coalesce(
        o.currency_symbol_snapshot,
        public.currency_symbol_for(o.currency_code)
      ),
      'idempotent', true
    )
    into v_result
    from public.orders o
    where o.id = v_existing;
    return v_result;
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
  -- Снимок символа на момент checkout (immutable исторический факт, docs/24 §3.3).
  v_symbol := coalesce(
    nullif(btrim(v_store.currency_symbol), ''),
    public.currency_symbol_for(v_currency)
  );
  v_number := 'SH-' || to_char(now(), 'YYMMDD') || '-' ||
    upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));

  insert into public.orders (
    public_order_number, store_id, buyer_user_id,
    buyer_full_name_snapshot, buyer_phone_snapshot, buyer_address_snapshot,
    buyer_telegram_username_snapshot, status, currency_code, currency_symbol_snapshot,
    subtotal_minor, total_minor
  ) values (
    v_number, p_store_id, p_buyer_user_id,
    p_full_name, p_phone, p_address,
    p_telegram_username, 'NEW', v_currency, v_symbol, 0, 0
  )
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := coalesce((v_item->>'quantity')::int, 0);
    if v_qty < 1 or v_qty > c_max_item_qty then
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

    -- Независимые оси (docs/20 §4.3, source: 0037): custom price и custom discount
    -- переопределяются по отдельности; отсутствующая ось наследует товар.
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

  -- Link the reservation to the created order (was INSERT on conflict do nothing
  -- in 0004 — that could silently drop the mapping under concurrency).
  update public.order_idempotency
  set order_id = v_order_id
  where buyer_user_id = p_buyer_user_id and idempotency_key = p_idempotency_key;

  return jsonb_build_object(
    'success', true,
    'orderId', v_order_id,
    'orderNumber', v_number,
    'subtotalMinor', v_subtotal,
    'totalMinor', v_subtotal,
    'currencyCode', v_currency,
    'currencySymbol', v_symbol,
    'sellerTelegramId', v_store.owner_telegram_id,
    'itemCount', v_count,
    'idempotent', false
  );
end;
$$;

-- ── Read: снимок в list-проекции ────────────────────────────────────────────
create or replace function public.order_list_read(
  p_actor_user_id uuid,
  p_scope text,
  p_store_ref text,
  p_status_filter text default 'all',
  p_cursor text default null,
  p_limit int default 20
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_store public.stores;
  -- Authenticated RPC: allow a larger page than the public storefront reads, but cap it.
  v_limit int := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_scope text := lower(coalesce(p_scope, ''));
  v_filter text := upper(coalesce(p_status_filter, 'all'));
  v_statuses text[];
  v_cursor_ts timestamptz;
  v_cursor_id uuid;
  v_empty jsonb := jsonb_build_object('orders', '[]'::jsonb, 'nextCursor', null);
  v_result jsonb;
begin
  -- Unknown actor / scope -> safe empty (never an error).
  if p_actor_user_id is null or v_scope not in ('buyer', 'seller') then
    return v_empty;
  end if;

  -- Tab filter -> status set. "history" is a UI grouping, not a domain status (docs/22 §5.1).
  if v_filter = 'ALL' then
    v_statuses := null;
  elsif v_filter in ('NEW', 'IN_TRANSIT', 'DELIVERED') then
    v_statuses := array[v_filter];
  elsif v_filter = 'HISTORY' then
    v_statuses := array['REFUSED', 'CANCELLED'];
  else
    return v_empty;
  end if;

  -- Requested store context is resolved from the opaque public_id (canonical), with the
  -- legacy `store_<internalId>` compatibility path (as 0021:26-44). Unknown -> empty.
  if p_store_ref is null or btrim(p_store_ref) = '' then
    return v_empty;
  end if;
  select * into v_store from public.stores where public_id = p_store_ref limit 1;
  if not found then
    begin
      select * into v_store from public.stores where id = p_store_ref::uuid limit 1;
    exception
      when invalid_text_representation then
        return v_empty;
    end;
  end if;
  if not found then
    return v_empty;
  end if;

  -- Seller may only read inside a store it owns. A store the actor does not own is an
  -- empty result (requested context is not a permission).
  if v_scope = 'seller'
     and (v_store.owner_user_id is null or v_store.owner_user_id <> p_actor_user_id) then
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
      o.id,
      o.public_order_number,
      o.status,
      o.created_at,
      o.total_minor,
      o.currency_code,
      o.currency_symbol_snapshot
    from public.orders o
    where o.store_id = v_store.id
      and (v_scope <> 'buyer' or o.buyer_user_id = p_actor_user_id)
      and (v_statuses is null or o.status = any(v_statuses))
  ),
  filtered as (
    select *
    from base
    where v_cursor_ts is null or (created_at, id) < (v_cursor_ts, v_cursor_id)
    order by created_at desc, id desc
    limit v_limit + 1
  ),
  numbered as (
    select *, row_number() over (order by created_at desc, id desc) as rn
    from filtered
  )
  select jsonb_build_object(
    'orders', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', n.id,
          'publicOrderNumber', n.public_order_number,
          'status', n.status,
          'createdAt', n.created_at,
          'totalMinor', n.total_minor,
          'currencyCode', n.currency_code,
          -- Исторический символ (docs/24 §3.3): снимок, иначе по коду, иначе магазин.
          'currencySymbol', coalesce(
            n.currency_symbol_snapshot,
            public.currency_symbol_for(n.currency_code),
            v_store.currency_symbol
          ),
          'itemCount', it.item_count,
          'previewItems', it.preview_items
        )
        order by n.created_at desc, n.id desc
      )
      from numbered n
      cross join lateral (
        select
          count(*)::int as item_count,
          coalesce(
            jsonb_agg(
              jsonb_build_object(
                'imageUrl', oi.product_image_snapshot,
                'title', oi.product_title_snapshot,
                'variantLabel', nullif(
                  concat_ws(' ', oi.variant_name_snapshot, oi.variant_value_snapshot), ''
                ),
                'quantity', oi.quantity
              )
              order by oi.id
            ) filter (where oi.rn <= 3),
            '[]'::jsonb
          ) as preview_items
        from (
          select
            oi.id,
            oi.product_image_snapshot,
            oi.product_title_snapshot,
            oi.variant_name_snapshot,
            oi.variant_value_snapshot,
            oi.quantity,
            row_number() over (order by oi.id) as rn
          from public.order_items oi
          where oi.order_id = n.id
        ) oi
      ) it
      where n.rn <= v_limit
    ), '[]'::jsonb),
    -- Cursor points at the LAST row of this page; the limit+1 probe row only signals
    -- that a next page exists (same convention as 0026:176-186).
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

-- ── Read: снимок в detail-проекции ──────────────────────────────────────────
create or replace function public.order_detail_read(
  p_actor_user_id uuid,
  p_scope text,
  p_order_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_scope text := lower(coalesce(p_scope, ''));
  v_order public.orders;
  v_store public.stores;
  v_result jsonb;
begin
  -- Unknown actor / scope / order -> the same safe `null` (no existence leak).
  if p_actor_user_id is null or p_order_id is null or v_scope not in ('buyer', 'seller') then
    return null;
  end if;

  select * into v_order from public.orders where id = p_order_id limit 1;
  if not found then
    return null;
  end if;

  select * into v_store from public.stores where id = v_order.store_id limit 1;

  -- Authorization: a foreign order is indistinguishable from a missing one.
  if v_scope = 'buyer' then
    if v_order.buyer_user_id <> p_actor_user_id then
      return null;
    end if;
  else
    if v_store.owner_user_id is null or v_store.owner_user_id <> p_actor_user_id then
      return null;
    end if;
  end if;

  select jsonb_build_object(
    'id', v_order.id,
    'publicOrderNumber', v_order.public_order_number,
    'status', v_order.status,
    'deliveryOutcome', v_order.delivery_outcome,
    'refusalReasonCode', v_order.refusal_reason_code,
    'currencyCode', v_order.currency_code,
    -- Исторический символ (docs/24 §3.3): снимок, иначе по коду, иначе магазин.
    'currencySymbol', coalesce(
      v_order.currency_symbol_snapshot,
      public.currency_symbol_for(v_order.currency_code),
      v_store.currency_symbol
    ),
    'subtotalMinor', v_order.subtotal_minor,
    'totalMinor', v_order.total_minor,
    'createdAt', v_order.created_at,
    'updatedAt', v_order.updated_at,
    'cancelledAt', v_order.cancelled_at,
    'completedAt', v_order.completed_at,
    'refusedAt', v_order.refused_at,
    -- Delivery snapshot: the buyer's own data to the buyer, the order snapshot to the seller.
    'delivery', jsonb_build_object(
      'fullName', v_order.buyer_full_name_snapshot,
      'phone', v_order.buyer_phone_snapshot,
      'address', v_order.buyer_address_snapshot
    ),
    -- Actor-scoped contact (docs/22 §5.4): buyer -> store support handle only;
    -- seller -> buyer Telegram username snapshot only. Non-applicable side is null.
    'contact', jsonb_build_object(
      'supportHandle', case
        when v_scope = 'buyer' then nullif(v_store.support_handle, '')
        else null
      end,
      'telegramUsername', case
        when v_scope = 'seller' then nullif(v_order.buyer_telegram_username_snapshot, '')
        else null
      end
    ),
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'productTitleSnapshot', oi.product_title_snapshot,
          'productImageSnapshot', oi.product_image_snapshot,
          'variantNameSnapshot', oi.variant_name_snapshot,
          'variantValueSnapshot', oi.variant_value_snapshot,
          'linkingAttributesSnapshot', oi.linking_attributes_snapshot,
          'quantity', oi.quantity,
          'unitPriceMinor', oi.unit_price_minor,
          'lineTotalMinor', oi.line_total_minor
        )
        order by oi.id
      )
      from public.order_items oi
      where oi.order_id = v_order.id
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;
