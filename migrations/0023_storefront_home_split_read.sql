-- 0023_storefront_home_split_read.sql
-- Split Home read into a static context (store + categories) and a cursor-paginated
-- product stream. Replaces the monolithic storefront_home_read (0014/0022), removing
-- the "all products + slice(0,6)" model. Source of truth: docs/15 §5-6.
--
--   storefront_home_context_read(p_public_id)                     -> { store, categories } | null
--   storefront_home_products_read(p_public_id, p_cursor, p_limit) -> { products, nextCursor } | null
--
-- Deterministic order: created_at DESC, id DESC. Keyset cursor is opaque text
-- "<epoch_microseconds>:<id>"; an invalid cursor falls back to the first page.
-- security definer; public projection is the boundary (RLS is currently disabled).

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
  v_limit int := greatest(coalesce(p_limit, 6), 1);
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

grant execute on function public.storefront_home_products_read(text, text, int) to public;

-- Monolithic read fully replaced by the split above; no consumers remain.
drop function if exists public.storefront_home_read(text);
