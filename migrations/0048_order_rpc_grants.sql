-- 0048_order_rpc_grants.sql
-- ORD-HARDEN-01 (docs/24 §3.1): закрыть прямой доступ клиентских ролей к
-- защищённым order-RPC.
--
-- Эти функции — SECURITY DEFINER и доверяют переданному p_actor_user_id
-- (identity берётся из аргумента, а не из подписанной БД-сессии). Пока они
-- исполняемы ролью `anon`, публичного anon-ключа достаточно, чтобы обойти edge
-- (`order-queries`/`order-actions`) и, подставив чужой UUID, прочитать чужие
-- заказы/PII, отменить/перевести чужие заказы или удержать чужой сток
-- (`create_order_atomic`).
--
-- Единственный доверенный путь — edge-функции, которые проверяют подписанную
-- сессию и вызывают RPC с admin-ключом (роль `project_admin`,
-- `createAdminClient({ apiKey: API_KEY })`). Поэтому EXECUTE отзывается у
-- `public`/`anon`/`authenticated`; владелец функции (`project_admin`) сохраняет
-- доступ как owner.
--
-- RLS сам по себе это не закрывает (docs/24 §2.0): закрываем именно гранты.
-- Паттерн применим и к другим trust-param RPC проекта — follow-up в docs/11 §S1.

do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (array[
        'order_cancel',
        'order_transition',
        'order_delivery_outcome',
        'inventory_reconcile',
        'order_list_read',
        'order_detail_read',
        'create_order_atomic'
      ])
  loop
    execute format(
      'revoke all on function %s from public, anon, authenticated',
      r.sig
    );
  end loop;
end $$;
