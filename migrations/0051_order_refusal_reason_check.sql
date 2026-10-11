-- 0051_order_refusal_reason_check.sql
-- ORD-HARDEN-06 (docs/24 §2.4 / §6 P2-1): enum-safety причины отказа.
--
-- Было: `orders.refusal_reason_code text` без CHECK, а `order_delivery_outcome`
-- проверял для REFUSED только непустую причину — в колонку мог попасть
-- произвольный код, который ломает `REFUSAL_REASON_META[...]` на фронте.
--
-- Стало:
--   * CHECK `orders_refusal_reason_code_check` — только контролируемые коды 02 §7;
--   * `order_delivery_outcome` отвергает неизвестный код `INVALID_REFUSAL_REASON`.
-- (Статус уже ограничен `orders_status_check` из 0003 и enum-safety дублируется
--  в маппере/UI — cross-check, не источник истины.)
--
-- create or replace сохраняет сигнатуру/grants (0048 revoke) и ownership.
-- Apply as a whole via the admin SQL path. Then record:
--   npm run migrations:record -- 0051

alter table public.orders drop constraint if exists orders_refusal_reason_code_check;
alter table public.orders
  add constraint orders_refusal_reason_code_check
  check (
    refusal_reason_code is null
    or refusal_reason_code in (
      'BUYER_CHANGED_MIND',
      'COULD_NOT_CONTACT_BUYER',
      'DELIVERY_TERMS',
      'PRODUCT_NOT_MATCHED_EXPECTATIONS',
      'OTHER'
    )
  );

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
  select id, store_id, buyer_user_id, status, delivery_outcome
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
  -- Терминальность: результат фиксируется ровно один раз.
  if v_order.delivery_outcome is not null then
    raise exception 'OUTCOME_ALREADY_RECORDED';
  end if;
  if p_outcome not in ('RECEIVED', 'REFUSED') then
    raise exception 'INVALID_OUTCOME';
  end if;
  -- Причина отказа: обязательна и из контролируемого списка (02 §7, 0051).
  if p_outcome = 'REFUSED' then
    if p_reason is null or btrim(p_reason) = '' then
      raise exception 'REASON_REQUIRED';
    end if;
    if p_reason not in (
      'BUYER_CHANGED_MIND',
      'COULD_NOT_CONTACT_BUYER',
      'DELIVERY_TERMS',
      'PRODUCT_NOT_MATCHED_EXPECTATIONS',
      'OTHER'
    ) then
      raise exception 'INVALID_REFUSAL_REASON';
    end if;
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
