-- 0035_storefront_favorite_products_read.sql
-- Buyer Storefront: hydrate a Favorites tab from an explicit product-id list.
--
-- Favorites themselves stay client-side (Zustand persist, store-scoped `favoritesByStore`);
-- only product ids live on the client. This public RPC turns those ids into the same card
-- projection the Home (0023) and Catalog (0026/0033) reads already expose, so the Favorites
-- tab reuses ProductGrid/ProductCard without duplicating or caching stale product data.
--
--   storefront_favorite_products_read(p_public_id text, p_ids uuid[])
--     -> { products: StorefrontProductCard[] } | null
--
-- Parity with the catalog read (0033):
--   * same shop boundary      -> store resolved from p_public_id; ids from another shop never match
--   * same public guard       -> non-ACTIVE store has no public surface -> { products: [] }
--   * same active-only rule   -> ARCHIVED/removed products are simply absent (no error)
--   * same effective-price    -> first ACTIVE variant, CUSTOM_PRICE override, product fallback
--   * same public projection  -> StorefrontProductCard
-- Result order matches the caller's id order (favorites insertion order); p_ids is clamped
-- to 100 entries because the RPC is public.
--
-- security definer; the public projection is the boundary (RLS is currently disabled).

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
          when vv.price_mode = 'CUSTOM_PRICE' and vv.custom_original_amount_minor is not null
            then vv.custom_original_amount_minor
          else p.original_amount_minor
        end as original_amount_minor,
        case
          when vv.price_mode = 'CUSTOM_PRICE' and vv.custom_original_amount_minor is not null
            then coalesce(vv.custom_discount_percent, 0)
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

grant execute on function public.storefront_favorite_products_read(text, uuid[]) to public;
