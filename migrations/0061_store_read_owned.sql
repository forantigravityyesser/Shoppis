-- 0061_store_read_owned.sql
-- R1: owner-scoped серверное чтение магазина для настроек продавца.
--
-- Заменяет клиентское `stores.select('*').eq('id', storeId)` в
-- `storeRepository.fetchStore` (auth-slice.fetchCurrentStore): actor берётся из
-- подписанной сессии edge `store-actions`, а владение проверяется в SQL. Чужой/
-- несуществующий магазин → `null` (без утечки факта существования).
--
-- Возвращаем узкую проекцию `_store_projection` (единая точка, 0057), а не
-- `select('*')`. RLS пока НЕ включаем — этот путь уже RLS-совместим: при будущих
-- owner-scoped политиках он продолжит работать, т.к. не читает чужие строки.
--
-- `p_store_ref` — канон `public_id`; legacy внутренний uuid резолвится как
-- переходный путь (совместимо с `seller_dashboard_read`, 0058).
--
-- Source: docs/12 §5, docs/11 (RLS-gate), docs/15 §4.2-4.3.

create or replace function public.store_read_owned(
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

  return public._store_projection(v_store);
end;
$$;

revoke all on function public.store_read_owned(uuid, text) from public, anon, authenticated;
