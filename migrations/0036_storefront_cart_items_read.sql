-- 0036_storefront_cart_items_read.sql
-- Buyer Cart: resolve client-held cart references into the current public
-- product/variant/inventory projection in a single read.
--
-- The Cart itself stays client-side (Zustand persist, store-scoped `cartByStore`);
-- only references (productId, variantId) + quantity live on the client. This public
-- RPC turns those references into the projection the Cart screen needs, so Cart never
-- becomes a second product database and never caches stale stock/price. docs/18 §7.
--
--   storefront_cart_items_read(p_public_id text, p_items jsonb)
--     -> { store, items } | null
--
--   p_items = [{ "productId": uuid, "variantId": uuid|null }, ...]
--
-- Boundary and parity:
--   * store resolved from p_public_id; unknown -> null;
--   * every reference is resolved inside that store only (foreign product/variant
--     never matches);
--   * productAvailable = product exists + ACTIVE + same store;
--     variantAvailable = variant exists + ACTIVE + belongs to the product;
--   * effective price = variant CUSTOM_PRICE override, else product amount/discount
--     (same formula/rounding as 0004/0015/0023/0035);
--   * availableQuantity = inventory.available_quantity (held_quantity is never exposed);
--   * image = first product image, thumb -> full.
--
-- Deliberate Cart exception vs Home/Catalog (0023/0033): a PAUSED store still returns
-- the buyer's own cart projection (Cart stays readable) and reports
-- store.status = 'PAUSED' so checkout can be blocked. Catalog/Home hide PAUSED entirely.
--
-- public RPC: p_items is capped at 100 references; malformed ids never raise (they
-- simply resolve to not-found, so reconciliation removes them).
-- security definer; the public projection is the boundary (RLS is currently disabled).

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
        when va.price_mode = 'CUSTOM_PRICE' and va.custom_original_amount_minor is not null
          then ((va.custom_original_amount_minor
                 * (100 - coalesce(va.custom_discount_percent, 0))) + 50) / 100
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

grant execute on function public.storefront_cart_items_read(text, jsonb) to public;
