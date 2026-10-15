-- 0067_storage_owner_scope.sql
-- Storage: владельческий скоуп записи (docs/11 §S1, Фаза 5).
--
-- 0063 разрешила запись всей роли `authenticated` без скоупа. Здесь сужаем:
-- INSERT/UPDATE/DELETE только для владельца объекта (`uploaded_by = sub`).
-- SELECT остаётся публичным (бакет public; скачивание по URL RLS не гейтит).
-- Платформа сама проставляет `uploaded_by` при authenticated-загрузке (проверено).
--
-- Примечание: backfill `uploaded_by` для старых объектов НЕВОЗМОЖЕН —
-- `storage.objects` принадлежит `postgres`, а SQL-путь выполняется как
-- `project_admin` (только SELECT; смена роли запрещена платформой). Legacy-файлы
-- (`uploaded_by = NULL`) остаются без владельца: клиентское удаление для них
-- молча не срабатывает (best-effort) — это лишь orphans в бакете, не функционал.
-- Оркестрация пере-загрузки продавцом создаёт файлы уже с владельцем.
--
-- Source: docs/11 §S1, storage RLS pattern «owner-only writes».

drop policy if exists shoppis_media_insert on storage.objects;
create policy shoppis_media_insert on storage.objects
  for insert to authenticated
  with check (
    bucket = 'shoppis-media'
    and uploaded_by = (select auth.jwt() ->> 'sub')
  );

drop policy if exists shoppis_media_update on storage.objects;
create policy shoppis_media_update on storage.objects
  for update to authenticated
  using (
    bucket = 'shoppis-media'
    and uploaded_by = (select auth.jwt() ->> 'sub')
  )
  with check (
    bucket = 'shoppis-media'
    and uploaded_by = (select auth.jwt() ->> 'sub')
  );

drop policy if exists shoppis_media_delete on storage.objects;
create policy shoppis_media_delete on storage.objects
  for delete to authenticated
  using (
    bucket = 'shoppis-media'
    and uploaded_by = (select auth.jwt() ->> 'sub')
  );
