-- 0014_storefront_home_read.sql
-- Buyer storefront read layer: seller Telegram avatar + one-query projection of
-- store, active categories and active product cards (no N+1).
-- Source of truth: docs/13 §5, §19-20, §22; docs/03 §29-30; docs/04 §6, §17-18.
--
-- Called via SDK: client.database.rpc('storefront_home_read', { p_public_id }).
-- Reads are public (projection is the boundary); function is security definer so
-- it does not depend on table RLS (RLS is currently disabled).

-- Telegram photo_url is captured server-side at auth time (never from buyer app).
alter table public.telegram_identities
  add column if not exists photo_url text;

create or replace function public.storefront_home_read(p_public_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store public.stores;
  v_avatar text;
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

  -- Seller avatar: owner's Telegram photo, fallback null → client shows first letter.
  select ti.photo_url into v_avatar
  from public.telegram_identities ti
  where ti.user_id = v_store.owner_user_id
  order by ti.created_at asc
  limit 1;

  with visible_cards as (
    select
      p.id,
      p.title,
      c.id as category_id,
      img.image_url,
      p.sort_order,
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
  ),
  products_json as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', id,
        'title', title,
        'categoryId', category_id,
        'imageUrl', image_url,
        -- round(original * (100 - discount) / 100) in integer minor units.
        'price', ((original_amount_minor * (100 - discount_percent)) + 50) / 100,
        'originalPrice',
          case when discount_percent > 0 then original_amount_minor else null end,
        'available', available
      )
      order by sort_order asc, created_at asc
    ), '[]'::jsonb) as data
    from visible_cards
  )
  select jsonb_build_object(
    'store', jsonb_build_object(
      'id', v_store.id,
      'publicId', v_store.public_id,
      'name', v_store.name,
      'bannerUrl', nullif(v_store.banner_url, ''),
      'sellerAvatarUrl', nullif(v_avatar, ''),
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
    ), '[]'::jsonb),
    'products', (select data from products_json)
  )
  into v_result;

  return v_result;
end;
$$;

-- Public read (projection is the boundary). Explicit for clarity; PUBLIC already
-- has EXECUTE by default.
grant execute on function public.storefront_home_read(text) to public;
