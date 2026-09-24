-- 0004_checkout.sql
-- Atomic order creation: idempotency + stock revalidation + inventory move
-- (AVAILABLE -> HELD) + immutable snapshots + status history.
-- Source of truth: docs/02 §12, docs/03 §12-17, §24-25.
--
-- Called via SDK rpc('create_order_atomic', {...}).

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

    if v_variant.price_mode = 'CUSTOM_PRICE' and v_variant.custom_original_amount_minor is not null then
      v_original := v_variant.custom_original_amount_minor;
      v_discount := coalesce(v_variant.custom_discount_percent, 0);
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
