-- 0044_inventory_reconcile_variant_wide_attribution.sql
--
-- Close the last residual hole of the reserve invariant (docs/21 §14,
-- "Осознанно вне правки").
--
-- Problem: the variant-wide branch of `inventory_reconcile` (p_order_id is null —
-- the seller's "Всё в наличии") released HELD -> AVAILABLE but wrote ONE movement
-- with `order_id = NULL`, so the release was not attributed to any order. Because
-- the order-aware branch (`0042`) computes an order's remaining reserve as the net
-- of its own movements, a later order-aware reconcile of the same order could not
-- see that variant-wide release and could free another order's held again.
--
-- Fix: attribute the variant-wide release to the releasable orders. After the
-- inventory update, walk the releasable orders (REFUSED / CANCELLED) that still
-- have positive net held for this variant (deterministic order: created_at, id)
-- and write one `MANUAL_RECONCILE` movement per order, up to the requested
-- quantity. Any remainder not attributable to an order (orphan / legacy held) is
-- written once with `order_id = NULL`. The movements always sum to p_quantity, so
-- the inventory delta and the journal stay consistent.
--
-- Business rules are unchanged: which orders are releasable is still
-- `v_inv.held_quantity - protected_held` (active NEW / IN_TRANSIT /
-- DELIVERED-without-outcome stay protected); only the bookkeeping gains the
-- correct `order_id`. Order-aware branch is unchanged from `0042`.
--
-- Signature unchanged -> plain `create or replace` (no drop).
--
-- Apply as a whole via the admin SQL path. Then record:
--   npm run migrations:record -- 0044

create or replace function public.inventory_reconcile(
  p_variant_id uuid,
  p_actor_user_id uuid,
  p_quantity int,
  p_reason text default null,
  p_order_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store_id uuid;
  v_owner uuid;
  v_inv record;
  v_order record;
  v_order_held int;
  v_protected_held int;
  v_releasable int;
  v_remaining int;
  v_take int;
  v_rel record;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'INVALID_QUANTITY';
  end if;

  select s.id, s.owner_user_id
  into v_store_id, v_owner
  from public.variants va
  join public.products p on p.id = va.product_id
  join public.stores s on s.id = p.store_id
  where va.id = p_variant_id;

  if v_owner is null then
    raise exception 'VARIANT_NOT_FOUND';
  end if;
  if v_owner <> p_actor_user_id then
    raise exception 'FORBIDDEN';
  end if;

  select * into v_inv from public.inventory where variant_id = p_variant_id for update;
  if not found then
    raise exception 'INVENTORY_NOT_FOUND';
  end if;
  if v_inv.held_quantity < p_quantity then
    raise exception 'INSUFFICIENT_HELD';
  end if;

  if p_order_id is not null then
    -- Order-aware: только терминальный/релизабельный заказ отдаёт свой held.
    select id, store_id, status
    into v_order
    from public.orders
    where id = p_order_id
    for update;
    if not found then
      raise exception 'ORDER_NOT_FOUND';
    end if;
    if v_order.store_id <> v_store_id then
      raise exception 'ORDER_VARIANT_MISMATCH';
    end if;
    if v_order.status not in ('REFUSED', 'CANCELLED') then
      raise exception 'ORDER_NOT_RECONCILABLE';
    end if;

    if not exists (
      select 1 from public.order_items
      where order_id = p_order_id and variant_id = p_variant_id
    ) then
      raise exception 'ORDER_VARIANT_MISMATCH';
    end if;

    -- Фактический резерв заказа = нетто движений журнала по order_id + variant_id.
    select coalesce(sum(
      case
        when to_bucket = 'HELD' and from_bucket is distinct from 'HELD' then quantity
        when from_bucket = 'HELD' and to_bucket is distinct from 'HELD' then -quantity
        else 0
      end
    ), 0)
    into v_order_held
    from public.inventory_movements
    where order_id = p_order_id and variant_id = p_variant_id;

    if v_order_held <= 0 or p_quantity > v_order_held then
      raise exception 'INSUFFICIENT_HELD';
    end if;
  else
    -- Variant-wide: held активных заказов неприкосновенен.
    select coalesce(sum(oi.quantity), 0)
    into v_protected_held
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where oi.variant_id = p_variant_id
      and (
        o.status in ('NEW', 'IN_TRANSIT')
        or (o.status = 'DELIVERED' and o.delivery_outcome is null)
      );

    v_releasable := v_inv.held_quantity - v_protected_held;
    if v_releasable < 0 then
      v_releasable := 0;
    end if;

    if p_quantity > v_releasable then
      raise exception 'INVENTORY_RESERVED_BY_ORDERS';
    end if;
  end if;

  update public.inventory
  set held_quantity = held_quantity - p_quantity,
      available_quantity = available_quantity + p_quantity,
      updated_at = now()
  where variant_id = p_variant_id;

  if p_order_id is not null then
    insert into public.inventory_movements (
      variant_id, order_id, movement_type, quantity, from_bucket, to_bucket,
      actor_type, actor_user_id, reason_code
    ) values (
      p_variant_id, p_order_id, 'MANUAL_RECONCILE', p_quantity, 'HELD', 'AVAILABLE',
      'seller', p_actor_user_id, coalesce(p_reason, 'MANUAL_RECONCILE')
    );
  else
    -- Атрибуция: распределяем освобождение по релизабельным заказам, чтобы
    -- order-aware ветка видела его в журнале по конкретному order_id.
    v_remaining := p_quantity;

    for v_rel in
      select o.id as oid,
             coalesce(sum(
               case
                 when m.to_bucket = 'HELD' and m.from_bucket is distinct from 'HELD' then m.quantity
                 when m.from_bucket = 'HELD' and m.to_bucket is distinct from 'HELD' then -m.quantity
                 else 0
               end
             ), 0)::int as net_held
      from public.orders o
      join public.order_items oi
        on oi.order_id = o.id and oi.variant_id = p_variant_id
      left join public.inventory_movements m
        on m.order_id = o.id and m.variant_id = p_variant_id
      where o.status in ('REFUSED', 'CANCELLED')
      group by o.id, o.created_at
      having coalesce(sum(
               case
                 when m.to_bucket = 'HELD' and m.from_bucket is distinct from 'HELD' then m.quantity
                 when m.from_bucket = 'HELD' and m.to_bucket is distinct from 'HELD' then -m.quantity
                 else 0
               end
             ), 0) > 0
      order by o.created_at asc, o.id asc
    loop
      exit when v_remaining <= 0;

      v_take := least(v_remaining, v_rel.net_held);
      if v_take > 0 then
        insert into public.inventory_movements (
          variant_id, order_id, movement_type, quantity, from_bucket, to_bucket,
          actor_type, actor_user_id, reason_code
        ) values (
          p_variant_id, v_rel.oid, 'MANUAL_RECONCILE', v_take, 'HELD', 'AVAILABLE',
          'seller', p_actor_user_id, coalesce(p_reason, 'MANUAL_RECONCILE')
        );
        v_remaining := v_remaining - v_take;
      end if;
    end loop;

    -- Остаток, не привязанный к конкретному заказу (орфан / legacy held).
    if v_remaining > 0 then
      insert into public.inventory_movements (
        variant_id, order_id, movement_type, quantity, from_bucket, to_bucket,
        actor_type, actor_user_id, reason_code
      ) values (
        p_variant_id, null, 'MANUAL_RECONCILE', v_remaining, 'HELD', 'AVAILABLE',
        'seller', p_actor_user_id, coalesce(p_reason, 'MANUAL_RECONCILE')
      );
    end if;
  end if;

  return jsonb_build_object('success', true, 'variantId', p_variant_id, 'moved', p_quantity);
end;
$$;

grant execute on function public.inventory_reconcile(uuid, uuid, int, text, uuid) to public;
