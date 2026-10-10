-- 0041_inventory_reconcile_order_aware.sql
--
-- Fix docs/21 P0-04 (остаточный) / inventory invariant: held_quantity принадлежит
-- конкретным заказам, но inventory_reconcile (0007) был variant-wide и не знал об
-- заказах. Продавец мог кнопкой «Всё в наличии» освободить held активного заказа
-- (NEW/IN_TRANSIT/DELIVERED без исхода); затем buyer cancel NEW делал held -= qty
-- и упирался в inventory_held_check (held_quantity >= 0) → сломанный инвариант.
--
-- Теперь reconcile order-aware:
--   * p_order_id задан  → освобождается только held этого заказа, и только если
--     заказ в релизабельном терминальном статусе (REFUSED / CANCELLED);
--     количество ограничено остатком held, привязанным к этому заказу.
--   * p_order_id is null → variant-wide «Всё в наличии»: сначала вычисляется
--     protected_held (held активных заказов NEW/IN_TRANSIT/DELIVERED без исхода),
--     релизабельно только held - protected. Если запрос заходит в protected →
--     INVENTORY_RESERVED_BY_ORDERS (ничего не двигаем).
--
-- Сигнатура расширяется (5-й параметр). PostgreSQL трактует добавление
-- параметра с default как НОВУЮ перегрузку, поэтому старая 4-арг функция
-- явно удаляется — иначе она осталась бы как обходной путь без guard.
--
-- Apply as a whole via the admin SQL path. Then record:
--   npm run migrations:record -- 0041
--
-- Called via SDK rpc('inventory_reconcile', {...}) из edge order-actions.

drop function if exists public.inventory_reconcile(uuid, uuid, int, text);

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

    select coalesce(sum(quantity), 0)
    into v_order_held
    from public.order_items
    where order_id = p_order_id and variant_id = p_variant_id;
    if v_order_held = 0 then
      raise exception 'ORDER_VARIANT_MISMATCH';
    end if;

    -- Остаток held, ещё не освобождённый по этому заказу ранее.
    v_order_held := v_order_held - coalesce((
      select sum(quantity)
      from public.inventory_movements
      where order_id = p_order_id
        and variant_id = p_variant_id
        and movement_type = 'MANUAL_RECONCILE'
        and from_bucket = 'HELD' and to_bucket = 'AVAILABLE'
    ), 0);
    if v_order_held < 0 then
      v_order_held := 0;
    end if;

    if p_quantity > v_order_held then
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
