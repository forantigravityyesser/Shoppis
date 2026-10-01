-- 0013_buyer_notifications.sql
-- Opt-in Telegram-уведомлений покупателя (Mini App write access).
-- Разрешение запрашивается ОТДЕЛЬНО после успешного checkout и не является
-- условием заказа. Source of truth: docs/04 §11, docs/12 (notifications).

alter table public.telegram_identities
  add column if not exists notifications_enabled boolean not null default false;
alter table public.telegram_identities
  add column if not exists notifications_enabled_at timestamptz;
