-- 0063_storage_media_policies.sql
-- Storage-политики для клиентского контура медиа (docs/11 §S1).
--
-- Контекст: фронт раньше ходил с admin-ключом (`.env` VITE_INSForge_ANON_KEY =
-- API-ключ), поэтому запись в `shoppis-media` работала. С настоящим anon-ключом
-- запись запрещена: платформа не допускает `anon`-запись в storage в принципе
-- (проверено спайком), а client-роль на этом этапе — кастомная Telegram-сессия.
--
-- После JWT-моста (Фаза 2) клиент ходит как `authenticated` — эта миграция
-- разрешает запись этой роли. Бакет публичный на чтение: скачивание по URL RLS
-- не гейтит (docs storage/postgres-rls.md), поэтому SELECT открыт для anon.
--
-- ВРЕМЕННО широко: INSERT/UPDATE/DELETE без owner-скоупа. Сузить до владельца
-- (`uploaded_by = sub`) — Фаза 5 (docs/11 §S1).
--
-- Source: docs/11 §S1, storage RLS pattern «Public-read Bucket».

alter table storage.objects enable row level security;

drop policy if exists shoppis_media_select on storage.objects;
create policy shoppis_media_select on storage.objects
  for select to anon, authenticated
  using (bucket = 'shoppis-media');

drop policy if exists shoppis_media_insert on storage.objects;
create policy shoppis_media_insert on storage.objects
  for insert to authenticated
  with check (bucket = 'shoppis-media');

drop policy if exists shoppis_media_update on storage.objects;
create policy shoppis_media_update on storage.objects
  for update to authenticated
  using (bucket = 'shoppis-media')
  with check (bucket = 'shoppis-media');

drop policy if exists shoppis_media_delete on storage.objects;
create policy shoppis_media_delete on storage.objects
  for delete to authenticated
  using (bucket = 'shoppis-media');

revoke insert, update, delete on storage.objects from anon;
grant usage on schema storage to anon;
grant select on storage.objects to anon;
grant usage on schema storage to authenticated;
grant select, insert, update, delete on storage.objects to authenticated;
