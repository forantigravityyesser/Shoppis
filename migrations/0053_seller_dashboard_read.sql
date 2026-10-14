-- 0053_seller_dashboard_read.sql
-- Seller Dashboard read contour (docs/25 SDB-01): aggregates for the seller home
-- screen and the sales list backing the "Продажи" tab.
--
-- Two SECURITY DEFINER functions, both authorize the actor against the store's
-- owner in SQL (identity comes from the signed session resolved in the edge; the
-- client cannot pass a store it does not own):
--
--   seller_dashboard_read(p_actor_user_id, p_store_ref) -> jsonb | null
--     { orders:{new,inTransit,delivered,history}, sales:{receivedMinor,frozenMinor},
--       inventory:{activeProducts,archivedProducts,activeCategories} }
--
--   seller_sales_list_read(p_actor_user_id, p_store_ref, p_group, p_cursor, p_limit)
--     -> { orders: OrderListItem[], nextCursor, totalMinor }
--
-- Semantics (docs/25 §1/§3.2):
--   * orders buckets mirror the Orders tabs exactly (count of orders):
--       new      = status 'NEW'
--       inTransit= status 'IN_TRANSIT'
--       delivered= status 'DELIVERED'  (RECEIVED keeps status DELIVERED -> 0049)
--       history  = status in ('REFUSED','CANCELLED')
--   * sales (current store currency only, docs/25 §3.5):
--       received = delivery_outcome 'RECEIVED'
--       frozen   = status 'IN_TRANSIT' or (status 'DELIVERED' and delivery_outcome is null)
--   * sales list groups:
--       earned    = delivery_outcome 'RECEIVED'
--       potential = status 'IN_TRANSIT' or (status 'DELIVERED' and delivery_outcome is null)
--   * inventory counts: products by status (no soft-delete filter, matching
--     fetchCatalog so the number equals the Inventory screen); activeCategories
--     counts real rows only (system "Без категории" is a virtual constant).
--
-- store resolution: public_id (canonical) with the legacy `store_<internalId>`
-- compatibility path (0021/0046). Unknown / foreign store -> safe null / empty.
--
-- sales list projection is the SAME as order_list_read (0046): one read per page,
-- item_count + preview items 1..3, keyset cursor "<epoch_microseconds>:<id>",
-- order by created_at desc, id desc. Historical values come from the immutable
-- snapshots only.
--
-- security definer + `public, pg_temp` search order (convention of 0032).
-- Grants: NOT granted to public/anon/authenticated (0048 pattern) — the trusted
-- path is the edge with the admin key (project_admin / owner keeps EXECUTE).

create or replace function public.seller_dashboard_read(
  p_actor_user_id uuid,
  p_store_ref text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_store public.stores;
  v_currency text;
begin
  if p_actor_user_id is null or p_store_ref is null or btrim(p_store_ref) = '' then
    return null;
  end if;

  select * into v_store from public.stores where public_id = p_store_ref limit 1;
  if not found then
    begin
      select * into v_store from public.stores where id = p_store_ref::uuid limit 1;
    exception
      when invalid_text_representation then
        return null;
    end;
  end if;
  if not found then
    return null;
  end if;

  -- A store the actor does not own is indistinguishable from a missing one.
  if v_store.owner_user_id is null or v_store.owner_user_id <> p_actor_user_id then
    return null;
  end if;

  v_currency := v_store.currency;

  return jsonb_build_object(
    'orders', (
      select jsonb_build_object(
        'new', count(*) filter (where o.status = 'NEW'),
        'inTransit', count(*) filter (where o.status = 'IN_TRANSIT'),
        'delivered', count(*) filter (where o.status = 'DELIVERED'),
        'history', count(*) filter (where o.status in ('REFUSED', 'CANCELLED'))
      )
      from public.orders o
      where o.store_id = v_store.id
    ),
    'sales', (
      select jsonb_build_object(
        'receivedMinor', coalesce(
          sum(o.total_minor) filter (where o.delivery_outcome = 'RECEIVED'), 0
        ),
        'frozenMinor', coalesce(
          sum(o.total_minor) filter (
            where o.status = 'IN_TRANSIT'
               or (o.status = 'DELIVERED' and o.delivery_outcome is null)
          ), 0
        )
      )
      from public.orders o
      where o.store_id = v_store.id
        and o.currency_code = v_currency
    ),
    'inventory', jsonb_build_object(
      'activeProducts', (
        select count(*) from public.products p
        where p.store_id = v_store.id and p.status = 'ACTIVE'
      ),
      'archivedProducts', (
        select count(*) from public.products p
        where p.store_id = v_store.id and p.status = 'ARCHIVED'
      ),
      'activeCategories', (
        select count(*) from public.categories c
        where c.store_id = v_store.id and c.status = 'ACTIVE'
      )
    )
  );
end;
$$;

create or replace function public.seller_sales_list_read(
  p_actor_user_id uuid,
  p_store_ref text,
  p_group text,
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
  v_currency text;
  v_group text := lower(coalesce(p_group, ''));
  v_limit int := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_cursor_ts timestamptz;
  v_cursor_id uuid;
  v_empty jsonb := jsonb_build_object('orders', '[]'::jsonb, 'nextCursor', null, 'totalMinor', 0);
  v_result jsonb;
begin
  -- Unknown actor / group / store -> safe empty (never an error).
  if p_actor_user_id is null or v_group not in ('earned', 'potential') then
    return v_empty;
  end if;
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

  if v_store.owner_user_id is null or v_store.owner_user_id <> p_actor_user_id then
    return v_empty;
  end if;

  v_currency := v_store.currency;

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
      and o.currency_code = v_currency
      and (
        (v_group = 'earned' and o.delivery_outcome = 'RECEIVED')
        or (
          v_group = 'potential'
          and (
            o.status = 'IN_TRANSIT'
            or (o.status = 'DELIVERED' and o.delivery_outcome is null)
          )
        )
      )
  ),
  totals as (
    select coalesce(sum(total_minor), 0) as total_minor from base
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
          'currencySymbol', coalesce(
            n.currency_symbol_snapshot, v_store.currency_symbol
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
    -- Cursor points at the LAST row of this page; the limit+1 probe row only
    -- signals that a next page exists (same convention as 0026/0046).
    'nextCursor', case
      when exists (select 1 from numbered where rn = v_limit + 1)
      then (
        select (extract(epoch from created_at) * 1000000)::bigint::text || ':' || id::text
        from numbered
        where rn = v_limit
      )
      else null
    end,
    'totalMinor', (select total_minor from totals)
  )
  into v_result;

  return v_result;
end;
$$;

-- Grants: close direct client access (0048 pattern). Owner (project_admin) keeps
-- EXECUTE; the edge calls with the admin key.
revoke all on function public.seller_dashboard_read(uuid, text) from public, anon, authenticated;
revoke all on function public.seller_sales_list_read(uuid, text, text, text, int)
  from public, anon, authenticated;
