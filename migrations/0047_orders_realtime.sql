-- 0047_orders_realtime.sql
-- Orders realtime (docs/22 ORD-14): actor-scoped WebSocket signals for order changes.
--
-- Goal: a buyer's order appears in the seller's list and a status change reaches the
-- buyer (and vice versa) without a manual refresh. The socket carries only a minimal,
-- non-PII signal ("this order changed, new status") — the client then re-reads through
-- the existing authenticated query boundary (`order-queries` -> `order_list_read` /
-- `order_detail_read`), which stays the single authorization point.
--
-- Channels (one per actor scope, so a subscriber only cares about its own stream):
--   * orders:seller:<store_id>        — every order in a store (seller list + detail);
--   * orders:buyer:<buyer_user_id>    — every order of a buyer (buyer list + detail).
-- `store_id`/`buyer_user_id` are the internal uuids the app already holds in state
-- (auth-slice `storeId` = stores.id, `serverUser.id` = users.id), so the client can
-- resolve the channel name without extra reads.
--
-- Publisher: a trigger on public.orders fires on INSERT (checkout) and on any UPDATE
-- (status transition / delivery outcome / cancellation) and publishes to BOTH channels.
-- Payload is `{ orderId, status }` only.
--
-- Residual risk (docs/22 §4.4 / docs/11 §S1): RLS is off project-wide and the realtime
-- socket connects with the anon key, so channel subscribe is open. The payload reveals
-- only an order id + status to a party who already knows a store/user uuid; the actual
-- order data is never sent over the socket and reads remain actor-authorized in SQL.
-- Restricting subscribe/publish (realtime.channels / realtime.messages RLS) is part of
-- the deferred RLS hardening, not this step.

insert into realtime.channels (pattern, description, enabled)
values
  ('orders:seller:%', 'Per-store order changes for the owning seller', true),
  ('orders:buyer:%', 'Per-buyer order changes for the buyer', true)
on conflict (pattern) do update
  set description = excluded.description,
      enabled = excluded.enabled;

-- One trigger function for both insert and update; `tg_op` picks the event name.
create or replace function public.notify_order_realtime()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event text := case when tg_op = 'INSERT' then 'order_created' else 'order_status_changed' end;
  v_payload jsonb := jsonb_build_object('orderId', new.id, 'status', new.status);
begin
  -- Publish is best-effort by nature; a delivery failure must never break the write
  -- that created/changed the order (the write itself already committed to this point).
  perform realtime.publish('orders:seller:' || new.store_id::text, v_event, v_payload);
  perform realtime.publish('orders:buyer:' || new.buyer_user_id::text, v_event, v_payload);
  return new;
end;
$$;

drop trigger if exists orders_realtime_change on public.orders;
create trigger orders_realtime_change
  after insert or update on public.orders
  for each row
  execute function public.notify_order_realtime();
