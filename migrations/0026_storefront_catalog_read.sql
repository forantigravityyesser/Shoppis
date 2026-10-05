-- 0026_storefront_catalog_read.sql
-- Catalog read layer for the buyer storefront: server-side category / search / price
-- filtering with keyset (cursor) pagination, plus store-wide price bounds for the
-- filter UI. Mirrors the split Home read (0023) exactly:
--   * same deterministic order       -> created_at DESC, id DESC
--   * same opaque keyset cursor      -> "<epoch_microseconds>:<id>"
--   * same effective-price semantics -> first ACTIVE variant, CUSTOM_PRICE override,
--                                       product fallback (0004/0014/0023 parity)
--   * same public projection         -> StorefrontProductCard
-- Source of truth: docs/17 §2 (CAT-00 audit §2.9, CAT-01).
--
--   storefront_catalog_products_read(
--     p_public_id, p_category_id, p_search, p_min_price, p_max_price, p_cursor, p_limit
--   ) -> { products, nextCursor } | null
--
--   storefront_catalog_price_bounds_read(p_public_id) -> { minPrice, maxPrice } | null
--
-- security definer; the public projection is the boundary (RLS is currently disabled).
-- Shop boundary: every row is constrained to the store resolved from p_public_id, so a
-- category from another shop never matches. p_limit is clamped to [1, 24] because the
-- RPC is public (same guard as 0023).

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
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
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
      and (p_category_id is null or p.category_id = p_category_id)
      and (v_search is null or p.title ilike '%' || v_search || '%')
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

grant execute on function public.storefront_catalog_products_read(text, uuid, text, int, int, text, int) to public;

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
    where p.store_id = v_store.id
      and p.status = 'ACTIVE'
  ) t;

  return jsonb_build_object(
    'minPrice', v_min,
    'maxPrice', v_max
  );
end;
$$;

grant execute on function public.storefront_catalog_price_bounds_read(text) to public;
