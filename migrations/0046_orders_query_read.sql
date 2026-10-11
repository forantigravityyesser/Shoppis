-- 0046_orders_query_read.sql
-- Orders read layer: authenticated, actor-scoped list + composed detail projections
-- with keyset (cursor) pagination. First step of ORD-01 (docs/22 §6.1).
--
-- Boundary (docs/22 §4.4):
--   * identity comes from the signed session resolved in the `order-queries` edge
--     function; `p_actor_user_id` is that identity. The client cannot pass a scope
--     it does not own: authorization is enforced here, in SQL.
--   * buyer  -> orders.buyer_user_id = p_actor_user_id (inside the requested store);
--   * seller -> stores.owner_user_id = p_actor_user_id (of the requested store);
--   * foreign / nonexistent order -> the SAME safe result (`null` / empty), the
--     existence of another actor's order is never revealed.
--
--   order_list_read(
--     p_actor_user_id, p_scope, p_store_ref, p_status_filter, p_cursor, p_limit
--   ) -> { orders: [...], nextCursor: string|null }
--
--   order_detail_read(p_actor_user_id, p_scope, p_order_id) -> jsonb | null
--
-- Determinism / performance (docs/22 §5.5):
--   * keyset cursor "<epoch_microseconds>:<id>", order by created_at DESC, id DESC
--     (same opaque convention as 0026:77-85);
--   * list is one projection per page including item_count + preview items 1..3
--     (no N+1, no select('*'));
--   * detail is one composed read (order + items + actor-scoped contact).
--
-- Immutable snapshots (docs/22 §5.6): every historical field is read from
-- `orders` / `order_items`; the current Product/Variant is never re-read.
--
-- security definer + `public, pg_temp` search order (convention of 0032).
-- Residual risk (docs/11 §S1 / docs/22 §4.4): RLS stays disabled and RPCs are
-- executable by the anon role (the edge calls with the anon key), so `p_actor_user_id`
-- is not cryptographically pinned to the RPC caller — the edge `verifySession` is the
-- live boundary. Server-side authorization below is defence-in-depth, not the only
-- layer; RLS is the project-level final hardening, deliberately out of scope here.

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
      o.currency_code
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
          'currencySymbol', v_store.currency_symbol,
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

grant execute on function public.order_list_read(uuid, text, text, text, text, int) to public;

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
    'currencySymbol', v_store.currency_symbol,
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

grant execute on function public.order_detail_read(uuid, text, uuid) to public;

-- Keyset indexes (precedent 0024): the list pages by (created_at desc, id desc) within
-- a store (seller) / within a store + buyer (buyer). Without them Postgres reads and
-- sorts the whole store/buyer history per page.
create index if not exists orders_store_created_idx
  on public.orders (store_id, created_at desc, id desc);
create index if not exists orders_store_buyer_created_idx
  on public.orders (store_id, buyer_user_id, created_at desc, id desc);
