-- 0005_order_delivery_outcome.sql
-- Seller-recorded delivery outcome after DELIVERED. 02 §7, 03 §7/§16.

alter table public.orders add column if not exists delivery_outcome text;

alter table public.orders drop constraint if exists orders_delivery_outcome_check;
alter table public.orders
  add constraint orders_delivery_outcome_check
  check (delivery_outcome is null or delivery_outcome in ('RECEIVED', 'REFUSED'));
