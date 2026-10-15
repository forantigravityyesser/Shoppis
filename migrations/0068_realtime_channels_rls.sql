-- 0068_realtime_channels_rls.sql
-- Realtime: RLS на каналах подписки (docs/11 §S1, docs/22 §3.5, Фаза 5).
--
-- До этого каналы `orders:buyer:%`/`orders:seller:%` были открыты любой
-- anon-подписке (accepted risk): по anon-ключу можно было подписаться на чужой
-- buyer/store и получать события заказов. Теперь подписка разрешена только роли
-- `authenticated` и только на «свой» канал: buyer — совпадение сегмента с `sub`
-- (auth.uid), seller — владение магазином (`app_is_store_owner`). Handshake
-- сокета шлёт платформенный access-JWT (setAccessToken синхронизирует realtime
-- token manager). Публикация серверными триггерами (`realtime.publish`,
-- security definer) RLS-подписки не затрагивает.
--
-- Source: docs/11 §S1, docs/22 §3.5, InsForge realtime «Restrict Channel Access».

alter table realtime.channels enable row level security;

drop policy if exists app_realtime_orders_subscribe on realtime.channels;
create policy app_realtime_orders_subscribe on realtime.channels
  for select to authenticated
  using (
    (
      pattern like 'orders:buyer:%'
      and split_part(realtime.channel_name(), ':', 3) = (select auth.jwt() ->> 'sub')
    )
    or
    (
      pattern like 'orders:seller:%'
      and public.app_is_store_owner(nullif(split_part(realtime.channel_name(), ':', 3), '')::uuid)
    )
  );
