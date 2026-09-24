-- 0006_drop_customers.sql
-- Docs treat the buyer as User; the legacy `customers` table is no longer used
-- (buyer identity = User/TelegramIdentity, orders.buyer_user_id).
-- Removing it eliminates the dual-system (store-scoped customer rows).

drop table if exists public.customers;
