-- 0059_seller_growth_read.sql
-- TUT-08 (docs/26 §3.5/§3.6): факты развития магазина из реальных заказов для блока
-- «цели развития» на главной. Аддитивно к сводке `seller_dashboard_read`:
--   growth.firstOrderAt     — min(orders.created_at) по магазину;
--   growth.firstShippedAt   — min(order_status_history.created_at), to_status='IN_TRANSIT'
--                             (исторический факт: последующая отмена его не стирает, §8.5);
--   growth.firstCompletedAt — min(orders.completed_at), delivery_outcome='RECEIVED'
--                             (completed_at проставляется только на RECEIVED, 0051).
--
-- §8.4: собственный заказ владельца не учитывается — все факты фильтруются по
-- `buyer_user_id is distinct from stores.owner_user_id`.
--
-- Контракт orders/sales/inventory не меняется (0058). Сигнатура прежняя — гранты
-- сохраняются, revoke повторяем идемпотентно (паттерн 0048).
--
-- Source: docs/26 §3.5, §8.4, §8.5.

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
            where o.status in ('NEW', 'IN_TRANSIT')
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
      ),
      'buyerAvailableProducts', (
        select count(*) from public.products p
        where p.store_id = v_store.id
          and p.status = 'ACTIVE'
          and exists (
            select 1
            from public.variants v
            join public.inventory inv on inv.variant_id = v.id
            where v.product_id = p.id
              and v.status = 'ACTIVE'
              and inv.available_quantity > 0
          )
      )
    ),
    -- Развитие: исторические min-факты по реальным заказам (§8.4 — без своих заказов).
    'growth', jsonb_build_object(
      'firstOrderAt', (
        select min(o.created_at)
        from public.orders o
        where o.store_id = v_store.id
          and o.buyer_user_id is distinct from v_store.owner_user_id
      ),
      'firstShippedAt', (
        select min(h.created_at)
        from public.order_status_history h
        join public.orders o on o.id = h.order_id
        where o.store_id = v_store.id
          and h.to_status = 'IN_TRANSIT'
          and o.buyer_user_id is distinct from v_store.owner_user_id
      ),
      'firstCompletedAt', (
        select min(o.completed_at)
        from public.orders o
        where o.store_id = v_store.id
          and o.delivery_outcome = 'RECEIVED'
          and o.buyer_user_id is distinct from v_store.owner_user_id
      )
    )
  );
end;
$$;

revoke all on function public.seller_dashboard_read(uuid, text) from public, anon, authenticated;
