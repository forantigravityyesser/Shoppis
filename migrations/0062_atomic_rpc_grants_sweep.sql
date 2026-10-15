-- 0062_atomic_rpc_grants_sweep.sql
-- S1 / Phase 0.2 (docs/11 §S1, docs/03 §26): закрыть EXECUTE у клиентских ролей
-- на все серверные RPC проекта.
--
-- 0048/0053/0054/0061 закрыли точечно order/dashboard/buyer-stores/store-read.
-- Остальные trust-param RPC каталога, соц-слоя и настроек оставались исполняемыми
-- для `public`/`anon`/`authenticated` (Postgres по умолчанию выдаёт EXECUTE на
-- функции роли PUBLIC). С публичным anon-ключом их можно было вызвать напрямую,
-- подставить чужой `p_actor_user_id` и писать в чужой магазин в обход edge.
--
-- Здесь единым свипом EXECUTE отзывается у `public`/`anon`/`authenticated` на
-- ВСЕХ функциях проекта (owner = `project_admin`), КРОМЕ публичных
-- `storefront_*` read-проекций — граница покупательского чтения остаётся
-- открытой (эти функции не принимают actor и сами ограничивают проекцию).
--
-- Владелец (`project_admin`) сохраняет доступ как owner, поэтому единственный
-- доверенный путь к защищённым RPC — edge-функции с admin-клиентом. Функции
-- расширений (owner = `postgres`: pgcrypto/vector/http) не трогаем — их гранты
-- платформенные.
--
-- Idempotent: повторный revoke — no-op.
--
-- Source: docs/11 §S1, docs/03 §26, docs/24 §3.1 (паттерн 0048).

do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and pg_get_userbyid(p.proowner) = 'project_admin'
      and p.proname not like 'storefront%'
  loop
    execute format(
      'revoke all on function %s from public, anon, authenticated',
      r.sig
    );
  end loop;
end $$;
