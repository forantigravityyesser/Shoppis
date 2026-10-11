-- 0052_orders_search_path_pg_temp.sql
-- ORD-HARDEN-08 (docs/24 §2.7 D3): безопасный `search_path` для lifecycle-RPC заказов.
--
-- Конвенция 0032: `set search_path = public, pg_temp` — `public` ищется первым,
-- временные отношения (`pg_temp`) последними, поэтому temp-объект не может
-- затенять объект из `public` в SECURITY DEFINER функции.
--
-- Функции блока заказов были пересозданы позже `create or replace ... set
-- search_path = public` (0007/0040/0049/0050/0051) и потеряли конвенцию.
-- Возвращаем порядок ALTER-ом (тела не трогаем) точечно по блоку заказов:
--   order_cancel, order_transition, order_delivery_outcome (0007),
--   inventory_reconcile (0007/0041), create_order_atomic (0040/0050).
--
-- Apply as a whole via the admin SQL path. Then record:
--   npm run migrations:record -- 0052

alter function public.order_cancel(uuid, uuid, text, text)
  set search_path = public, pg_temp;

alter function public.order_transition(uuid, uuid, text, text)
  set search_path = public, pg_temp;

alter function public.order_delivery_outcome(uuid, uuid, text, text)
  set search_path = public, pg_temp;

alter function public.inventory_reconcile(uuid, uuid, integer, text, uuid)
  set search_path = public, pg_temp;

alter function public.create_order_atomic(uuid, uuid, text, text, text, text, text, jsonb)
  set search_path = public, pg_temp;
