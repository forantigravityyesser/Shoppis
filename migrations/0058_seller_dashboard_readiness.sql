-- 0058_seller_dashboard_readiness.sql
-- TUT-03 (docs/26 §3.4/§3.6): серверный счётчик «доступный покупателю товар» для
-- чек-листа подготовки магазина.
--
-- Семантика повторяет витрину (docs/26 §1.6, 0023:159-165 / 0037:320-326):
-- товар `status='ACTIVE'` + существует `variants.status='ACTIVE'`-вариант, у которого
-- `inventory.available_quantity > 0`. Без гейта `stores.status` (§8.3) — пункт про
-- товар, а пауза магазина — осознанное операционное действие.
--
-- Пересоздаём только `seller_dashboard_read` (аддитивное поле в `inventory`); контракт
-- `orders`/`sales` не меняется (0055). Сигнатура прежняя — гранты/ownership сохраняются,
-- revoke повторяем идемпотентно (паттерн 0048).
--
-- Source: docs/26 §3.4, §3.6, §8.3.

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
        -- Потенциально: NEW (ещё не отправлен) + IN_TRANSIT + DELIVERED без исхода.
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
      -- Доступный покупателю товар: семантика витрины, без гейта stores.status (§8.3).
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
    )
  );
end;
$$;

revoke all on function public.seller_dashboard_read(uuid, text) from public, anon, authenticated;
