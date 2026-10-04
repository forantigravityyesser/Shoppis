-- 0015_storefront_product_detail_read.sql
-- Buyer storefront read layer for Product Detail: one-query projection of a single
-- public product (images, link/attributes, active variants + inventory, review
-- aggregate, question count, related products) plus lazy review/question lists.
-- Source of truth: docs/14 §12; docs/03 §24 (public API never exposes held stock);
-- docs/13 §19-20 (storefront read pattern), migration 0014.
--
-- Called via SDK:
--   client.database.rpc('storefront_product_detail_read',  { p_public_id, p_product_id })
--   client.database.rpc('storefront_product_reviews_read', { p_public_id, p_product_id })
--   client.database.rpc('storefront_product_questions_read', { p_public_id, p_product_id })
-- Reads are public (projection is the boundary); functions are security definer so
-- they do not depend on table RLS (RLS is currently disabled). Store PAUSED is
-- returned as-is so the UI can block purchase; direct URL cannot bypass it.

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

  -- Product must exist and belong to the store; another store's product is invisible.
  select * into v_product
  from public.products
  where id = p_product_id
    and store_id = v_store.id
  limit 1;

  if not found then
    return null;
  end if;

  -- Archived product is not public (storefront hides it entirely).
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
      -- Visible category only (ARCHIVED/deleted → null); product.category_id is NOT mutated.
      'categoryId', (
        select c.id
        from public.categories c
        where c.id = v_product.category_id and c.status = 'ACTIVE'
      )
    ),
    -- All images, gallery order. thumb_storage_key may be null for legacy rows;
    -- client falls back to url (convention shared with 0014 and the TS mappers).
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
    -- ACTIVE variants only, with per-variant effective price and availability.
    -- held_quantity is intentionally never exposed (03 §24).
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
          -- CUSTOM_PRICE wins only when custom_original_amount_minor is set; else product price.
          case
            when vv.price_mode = 'CUSTOM_PRICE' and vv.custom_original_amount_minor is not null
              then vv.custom_original_amount_minor
            else v_product.original_amount_minor
          end as original_amount_minor,
          case
            when vv.price_mode = 'CUSTOM_PRICE' and vv.custom_original_amount_minor is not null
              then coalesce(vv.custom_discount_percent, 0)
            else v_product.discount_percent
          end as discount_percent,
          coalesce(inv.available_quantity, 0) as available_quantity
        from public.variants vv
        left join public.inventory inv on inv.variant_id = vv.id
        where vv.product_id = v_product.id
          and vv.status = 'ACTIVE'
      ) t
    ), '[]'::jsonb),
    -- Review aggregate over ACTIVE reviews only (0 when none).
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
    -- "Другие варианты" = explicit ProductGroup relation; empty → client hides the block.
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
        order by rc.sort_order asc, rc.created_at asc
      )
      from (
        select
          p.id,
          p.title,
          p.sort_order,
          p.created_at,
          img.image_url,
          coalesce(v.original_amount_minor, p.original_amount_minor) as original_amount_minor,
          coalesce(v.discount_percent, p.discount_percent) as discount_percent,
          coalesce(stock.available, false) as available
        from public.products p
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
        left join lateral (
          select bool_or(inv.available_quantity > 0) as available
          from public.variants vv
          join public.inventory inv on inv.variant_id = vv.id
          where vv.product_id = p.id and vv.status = 'ACTIVE'
        ) stock on true
        where p.store_id = v_store.id
          and p.status = 'ACTIVE'
          and p.product_group_id is not null
          and p.product_group_id = v_product.product_group_id
          and p.id <> v_product.id
        order by p.sort_order asc, p.created_at asc
        limit 8
      ) rc
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

create or replace function public.storefront_product_reviews_read(
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

  if not found or v_product.status <> 'ACTIVE' then
    return null;
  end if;

  return jsonb_build_object(
    'summary', (
      select jsonb_build_object(
        'average', coalesce(round(avg(r.rating)::numeric, 1), 0),
        'count', count(*)
      )
      from public.reviews r
      where r.product_id = v_product.id
        and r.status = 'ACTIVE'
    ),
    -- ACTIVE reviews, newest first. Author = first Telegram identity name only
    -- (no username link, no avatar) — fallback «Покупатель».
    'reviews', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', rr.id,
          'authorName', rr.author_name,
          'rating', rr.rating,
          'text', rr.text,
          'createdAt', rr.created_at
        )
        order by rr.created_at desc
      )
      from (
        select
          r.id,
          r.rating,
          r.text,
          r.created_at,
          coalesce(author.author_name, 'Покупатель') as author_name
        from public.reviews r
        left join lateral (
          select coalesce(nullif(ti.first_name, ''), nullif(ti.username, '')) as author_name
          from public.telegram_identities ti
          where ti.user_id = r.buyer_user_id
          order by ti.created_at asc
          limit 1
        ) author on true
        where r.product_id = v_product.id
          and r.status = 'ACTIVE'
        order by r.created_at desc
        limit 50
      ) rr
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.storefront_product_questions_read(
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

  if not found or v_product.status <> 'ACTIVE' then
    return null;
  end if;

  -- ACTIVE questions, newest first; question_id UNIQUE → 0..1 seller answer.
  -- No empty answer block: a question without an answer has "answer": null.
  return jsonb_build_object(
    'questions', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', qq.id,
          'authorName', qq.author_name,
          'text', qq.text,
          'createdAt', qq.created_at,
          'answer', qq.answer
        )
        order by qq.created_at desc
      )
      from (
        select
          q.id,
          q.text,
          q.created_at,
          coalesce(author.author_name, 'Покупатель') as author_name,
          case
            when qa.id is null then null
            else jsonb_build_object('text', qa.text, 'createdAt', qa.created_at)
          end as answer
        from public.questions q
        left join public.question_answers qa on qa.question_id = q.id
        left join lateral (
          select coalesce(nullif(ti.first_name, ''), nullif(ti.username, '')) as author_name
          from public.telegram_identities ti
          where ti.user_id = q.buyer_user_id
          order by ti.created_at asc
          limit 1
        ) author on true
        where q.product_id = v_product.id
          and q.status = 'ACTIVE'
        order by q.created_at desc
        limit 50
      ) qq
    ), '[]'::jsonb)
  );
end;
$$;

-- Public read (projection is the boundary). Explicit for clarity; PUBLIC already
-- has EXECUTE by default.
grant execute on function public.storefront_product_detail_read(text, uuid) to public;
grant execute on function public.storefront_product_reviews_read(text, uuid) to public;
grant execute on function public.storefront_product_questions_read(text, uuid) to public;
