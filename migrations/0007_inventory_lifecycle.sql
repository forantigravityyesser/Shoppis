-- 0007_inventory_lifecycle.sql
-- Order lifecycle + inventory transitions, atomic, with audit movements and history.
-- Source of truth: docs/02 §5-7, docs/03 §11-16, §24-25.
--
-- Called via SDK rpc(...) from edge-function order-actions (dispatcher):
--   order_cancel, order_transition, order_delivery_outcome, inventory_reconcile.

create or replace function public.order_cancel(
  p_order_id uuid,
  p_actor_user_id uuid,
  p_actor_type text,
  p_reason text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_owner uuid;
  v_item record;
begin
  select id, store_id, buyer_user_id, status
  into v_order
  from public.orders
  where id = p_order_id
  for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;
  if v_order.status in ('REFUSED', 'CANCELLED') then
    raise exception 'ORDER_TERMINAL';
  end if;

  if p_actor_type = 'buyer' then
    if v_order.buyer_user_id <> p_actor_user_id then
      raise exception 'FORBIDDEN';
    end if;
    if v_order.status <> 'NEW' then
      raise exception 'CANCEL_NOT_ALLOWED';
    end if;
  elsif p_actor_type = 'seller' then
    select owner_user_id into v_owner from public.stores where id = v_order.store_id;
    if v_owner is null or v_owner <> p_actor_user_id then
      raise exception 'FORBIDDEN';
    end if;
    if v_order.status not in ('NEW', 'IN_TRANSIT') then
      raise exception 'CANCEL_NOT_ALLOWED';
    end if;
  else
    raise exception 'INVALID_ACTOR';
  end if;

  if v_order.status = 'NEW' then
    for v_item in select variant_id, quantity from public.order_items where order_id = p_order_id loop
      if v_item.variant_id is not null then
        update public.inventory
        set held_quantity = held_quantity - v_item.quantity,
            available_quantity = available_quantity + v_item.quantity,
            updated_at = now()
        where variant_id = v_item.variant_id;
        insert into public.inventory_movements (
          variant_id, order_id, movement_type, quantity, from_bucket, to_bucket,
          actor_type, actor_user_id, reason_code
        ) values (
          v_item.variant_id, p_order_id, 'ORDER_CANCEL_RELEASE', v_item.quantity, 'HELD', 'AVAILABLE',
          p_actor_type, p_actor_user_id, coalesce(p_reason, 'CANCELLED_NEW')
        );
      end if;
    end loop;
  else
    -- IN_TRANSIT: quantity stays held until manual reconciliation. 02 §5
    for v_item in select variant_id, quantity from public.order_items where order_id = p_order_id loop
      if v_item.variant_id is not null then
        insert into public.inventory_movements (
          variant_id, order_id, movement_type, quantity, from_bucket, to_bucket,
          actor_type, actor_user_id, reason_code
        ) values (
          v_item.variant_id, p_order_id, 'ORDER_CANCEL_HELD', v_item.quantity, 'HELD', 'HELD',
          p_actor_type, p_actor_user_id, coalesce(p_reason, 'CANCELLED_IN_TRANSIT')
        );
      end if;
    end loop;
  end if;

  update public.orders
  set status = 'CANCELLED', cancelled_at = now(), updated_at = now()
  where id = p_order_id;

  insert into public.order_status_history (order_id, from_status, to_status, actor_type, actor_user_id, reason_code)
  values (p_order_id, v_order.status, 'CANCELLED', p_actor_type, p_actor_user_id, p_reason);

  return jsonb_build_object(
    'success', true,
    'orderId', p_order_id,
    'buyerUserId', v_order.buyer_user_id,
    'status', 'CANCELLED',
    'released', v_order.status = 'NEW'
  );
end;
$$;

create or replace function public.order_transition(
  p_order_id uuid,
  p_actor_user_id uuid,
  p_to_status text,
  p_reason text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_owner uuid;
begin
  select id, store_id, buyer_user_id, status
  into v_order
  from public.orders
  where id = p_order_id
  for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  select owner_user_id into v_owner from public.stores where id = v_order.store_id;
  if v_owner is null or v_owner <> p_actor_user_id then
    raise exception 'FORBIDDEN';
  end if;

  if not (
    (v_order.status = 'NEW' and p_to_status = 'IN_TRANSIT')
    or (v_order.status = 'IN_TRANSIT' and p_to_status = 'DELIVERED')
  ) then
    raise exception 'TRANSITION_NOT_ALLOWED';
  end if;

  update public.orders
  set status = p_to_status, updated_at = now()
  where id = p_order_id;

  insert into public.order_status_history (order_id, from_status, to_status, actor_type, actor_user_id, reason_code)
  values (p_order_id, v_order.status, p_to_status, 'seller', p_actor_user_id, p_reason);

  return jsonb_build_object(
    'success', true,
    'orderId', p_order_id,
    'buyerUserId', v_order.buyer_user_id,
    'status', p_to_status
  );
end;
$$;

create or replace function public.order_delivery_outcome(
  p_order_id uuid,
  p_actor_user_id uuid,
  p_outcome text,
  p_reason text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_owner uuid;
  v_item record;
begin
  select id, store_id, buyer_user_id, status
  into v_order
  from public.orders
  where id = p_order_id
  for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  select owner_user_id into v_owner from public.stores where id = v_order.store_id;
  if v_owner is null or v_owner <> p_actor_user_id then
    raise exception 'FORBIDDEN';
  end if;
  if v_order.status <> 'DELIVERED' then
    raise exception 'NOT_DELIVERED';
  end if;
  if p_outcome not in ('RECEIVED', 'REFUSED') then
    raise exception 'INVALID_OUTCOME';
  end if;
  if p_outcome = 'REFUSED' and (p_reason is null or p_reason = '') then
    raise exception 'REASON_REQUIRED';
  end if;

  if p_outcome = 'RECEIVED' then
    for v_item in select variant_id, quantity from public.order_items where order_id = p_order_id loop
      if v_item.variant_id is not null then
        update public.inventory
        set held_quantity = held_quantity - v_item.quantity, updated_at = now()
        where variant_id = v_item.variant_id;
        insert into public.inventory_movements (
          variant_id, order_id, movement_type, quantity, from_bucket, to_bucket,
          actor_type, actor_user_id, reason_code
        ) values (
          v_item.variant_id, p_order_id, 'ORDER_DELIVERED', v_item.quantity, 'HELD', 'DELIVERED',
          'seller', p_actor_user_id, 'DELIVERED'
        );
      end if;
    end loop;

    update public.orders
    set delivery_outcome = 'RECEIVED', completed_at = now(), updated_at = now()
    where id = p_order_id;

    insert into public.order_status_history (order_id, from_status, to_status, actor_type, actor_user_id, reason_code)
    values (p_order_id, 'DELIVERED', 'DELIVERED', 'seller', p_actor_user_id, 'RECEIVED');
  else
    update public.orders
    set status = 'REFUSED', delivery_outcome = 'REFUSED', refused_at = now(),
        refusal_reason_code = p_reason, updated_at = now()
    where id = p_order_id;

    insert into public.order_status_history (order_id, from_status, to_status, actor_type, actor_user_id, reason_code)
    values (p_order_id, 'DELIVERED', 'REFUSED', 'seller', p_actor_user_id, p_reason);
  end if;

  return jsonb_build_object(
    'success', true,
    'orderId', p_order_id,
    'buyerUserId', v_order.buyer_user_id,
    'status', case when p_outcome = 'RECEIVED' then 'DELIVERED' else 'REFUSED' end,
    'deliveryOutcome', p_outcome
  );
end;
$$;

create or replace function public.inventory_reconcile(
  p_variant_id uuid,
  p_actor_user_id uuid,
  p_quantity int,
  p_reason text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_inv record;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'INVALID_QUANTITY';
  end if;

  select s.owner_user_id
  into v_owner
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

  update public.inventory
  set held_quantity = held_quantity - p_quantity,
      available_quantity = available_quantity + p_quantity,
      updated_at = now()
  where variant_id = p_variant_id;

  insert into public.inventory_movements (
    variant_id, movement_type, quantity, from_bucket, to_bucket,
    actor_type, actor_user_id, reason_code
  ) values (
    p_variant_id, 'MANUAL_RECONCILE', p_quantity, 'HELD', 'AVAILABLE',
    'seller', p_actor_user_id, coalesce(p_reason, 'MANUAL_RECONCILE')
  );

  return jsonb_build_object('success', true, 'variantId', p_variant_id, 'moved', p_quantity);
end;
$$;
