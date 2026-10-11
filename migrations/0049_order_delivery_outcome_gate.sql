-- 0049_order_delivery_outcome_gate.sql
-- ORD-HARDEN-02 (docs/24 §3.2): сделать результат вручения терминальным.
--
-- Было (0007): гейт только по статусу `status = 'DELIVERED'`. При RECEIVED статус
-- остаётся DELIVERED, поэтому повторный вызов снова проходил и снова уменьшал
-- held_quantity (риск для резерва другого заказа); после RECEIVED можно было
-- отправить REFUSED, который менял статус без возврата резерва и не отменял
-- движение доставки.
--
-- Стало: фиксация результата допустима только при
-- `status = 'DELIVERED' AND delivery_outcome IS NULL`. Строка берётся `for
-- update`, поэтому два параллельных outcome сериализуются: первый фиксирует
-- результат, второй получает детерминированную ошибку `OUTCOME_ALREADY_RECORDED`
-- (не no-op).
--
-- Тело функции скопировано из 0007 с добавлением гейта; сигнатура не меняется,
-- поэтому create or replace сохраняет отозванные в 0048 EXECUTE-гранты.

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
