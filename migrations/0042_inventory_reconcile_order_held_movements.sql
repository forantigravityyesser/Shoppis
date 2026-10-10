-- 0042_inventory_reconcile_order_held_movements.sql
--
-- Fix residual regression from 0041 (order-aware inventory_reconcile).
--
-- Problem: 0041 computed the order's remaining held as
--   sum(order_items.quantity) - sum(MANUAL_RECONCILE HELD->AVAILABLE)
-- i.e. it accounted only for manual reconciles. The automatic release performed
-- by `order_cancel` on a NEW order (`ORDER_CANCEL_RELEASE`, HELD->AVAILABLE) was
-- NOT subtracted. So after order A (NEW) was cancelled and its held already
-- returned, a subsequent order-aware `inventory_reconcile(A, qty)` still believed
-- A held its original quantity and released that amount again — stealing held
-- that belonged to another order B for the same variant.
--
-- Fix: the order's actual reserve is now the NET of the whole movement journal
-- for that order_id + variant_id:
--   +quantity  when the movement adds HELD  (to_bucket = 'HELD'  and from_bucket <> 'HELD')
--   -quantity  when the movement frees HELD (from_bucket = 'HELD' and to_bucket <> 'HELD')
--   ORDER_CANCEL_HELD (HELD->HELD) contributes 0 (in-transit cancel keeps held).
-- Covered types: ORDER_RESERVE, ORDER_CANCEL_RELEASE, ORDER_CANCEL_HELD,
-- ORDER_DELIVERED, MANUAL_RECONCILE. All are bound to the correct order_id.
--
-- Consequence: release is idempotent (a repeat/concurrent reconcile sees the
-- prior movement → net held is already 0 → INSUFFICIENT_HELD), and reconciling
-- order A can never touch order B's reserve (the computation is per order).
-- Concurrency is serialized by the existing `inventory ... for update` row lock.
--
-- Variant-wide branch (p_order_id is null) is unchanged from 0041.
-- Signature is unchanged, so this is a plain `create or replace` (no drop).
--
-- Apply as a whole via the admin SQL path. Then record:
--   npm run migrations:record -- 0042
--
-- Called via SDK rpc('inventory_reconcile', {...}) from edge order-actions.

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

    -- Позиция этого заказа по варианту должна существовать.
    if not exists (
      select 1 from public.order_items
      where order_id = p_order_id and variant_id = p_variant_id
    ) then
      raise exception 'ORDER_VARIANT_MISMATCH';
    end if;

    -- Фактический резерв заказа = нетто движений журнала по order_id + variant_id.
    -- Учитывает автоматическое освобождение (ORDER_CANCEL_RELEASE) и ручные
    -- сверки (MANUAL_RECONCILE), поэтому повторная сверка не освобождает дважды.
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

  insert into public.inventory_movements (
    variant_id, order_id, movement_type, quantity, from_bucket, to_bucket,
    actor_type, actor_user_id, reason_code
  ) values (
    p_variant_id, p_order_id, 'MANUAL_RECONCILE', p_quantity, 'HELD', 'AVAILABLE',
    'seller', p_actor_user_id, coalesce(p_reason, 'MANUAL_RECONCILE')
  );

  return jsonb_build_object('success', true, 'variantId', p_variant_id, 'moved', p_quantity);
end;
$$;

grant execute on function public.inventory_reconcile(uuid, uuid, int, text, uuid) to public;
