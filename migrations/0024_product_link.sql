-- 0024_product_link.sql
-- Explicit pairwise product links ("Связи" / «Похожее»). A link is bidirectional
-- and NOT transitive: liking product A to B makes each appear in the other's
-- related list; linking B to C does not surface C on A. Source: docs/14 §7.
--
-- Storage keeps one canonical row per unordered pair (product_id < related_product_id)
-- so a single relation is never duplicated. Writes go through the edge
-- `catalog-actions` dispatcher (actor_user_id from the session) into these atomic
-- functions with a store-owner check.

create table if not exists public.product_links (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  related_product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint product_links_not_self check (product_id <> related_product_id),
  constraint product_links_pair_key unique (product_id, related_product_id)
);
create index if not exists product_links_product_id_idx on public.product_links (product_id);
create index if not exists product_links_related_id_idx on public.product_links (related_product_id);

create or replace function public.product_link_add_atomic(
  p_product_id uuid,
  p_target_id uuid,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p public.products;
  v_t public.products;
  v_owner uuid;
  v_a uuid;
  v_b uuid;
begin
  if p_actor_user_id is null then
    raise exception 'UNAUTHORIZED';
  end if;
  if p_product_id is null or p_target_id is null then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;
  if p_product_id = p_target_id then
    raise exception 'SELF_LINK';
  end if;

  select * into v_p from public.products where id = p_product_id limit 1;
  if not found then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;
  select * into v_t from public.products where id = p_target_id limit 1;
  if not found then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;
  if v_p.store_id <> v_t.store_id then
    raise exception 'SAME_STORE_REQUIRED';
  end if;

  select owner_user_id into v_owner from public.stores where id = v_p.store_id limit 1;
  if v_owner is null or p_actor_user_id <> v_owner then
    raise exception 'FORBIDDEN';
  end if;

  if v_p.id < v_t.id then
    v_a := v_p.id;
    v_b := v_t.id;
  else
    v_a := v_t.id;
    v_b := v_p.id;
  end if;

  insert into public.product_links (store_id, product_id, related_product_id)
  values (v_p.store_id, v_a, v_b)
  on conflict (product_id, related_product_id) do nothing;

  return jsonb_build_object(
    'success', true,
    'productId', p_product_id,
    'relatedProductId', p_target_id
  );
end;
$$;

create or replace function public.product_link_remove_atomic(
  p_product_id uuid,
  p_target_id uuid,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p public.products;
  v_t public.products;
  v_owner uuid;
  v_a uuid;
  v_b uuid;
begin
  if p_actor_user_id is null then
    raise exception 'UNAUTHORIZED';
  end if;
  if p_product_id is null or p_target_id is null then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;

  select * into v_p from public.products where id = p_product_id limit 1;
  if not found then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;
  select * into v_t from public.products where id = p_target_id limit 1;
  if not found then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;
  if v_p.store_id <> v_t.store_id then
    raise exception 'SAME_STORE_REQUIRED';
  end if;

  select owner_user_id into v_owner from public.stores where id = v_p.store_id limit 1;
  if v_owner is null or p_actor_user_id <> v_owner then
    raise exception 'FORBIDDEN';
  end if;

  if v_p.id < v_t.id then
    v_a := v_p.id;
    v_b := v_t.id;
  else
    v_a := v_t.id;
    v_b := v_p.id;
  end if;

  delete from public.product_links
  where product_id = v_a and related_product_id = v_b;

  return jsonb_build_object('success', true);
end;
$$;

grant execute on function public.product_link_add_atomic(uuid, uuid, uuid) to public;
grant execute on function public.product_link_remove_atomic(uuid, uuid, uuid) to public;

-- Re-create the product detail read with `relatedProducts` sourced from explicit
-- links (both directions), same store, ACTIVE only, newest link first, no limit.
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
        order by rc.link_created_at asc
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
        where (l.product_id = v_product.id or l.related_product_id = v_product.id)
          and p.store_id = v_store.id
          and p.status = 'ACTIVE'
          and p.id <> v_product.id
      ) rc
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end;
$$;

grant execute on function public.storefront_product_detail_read(text, uuid) to public;
