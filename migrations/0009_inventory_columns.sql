-- 0009_inventory_columns.sql
-- Sync migrations with columns added directly to the InsForge database during the
-- inventory real-backend migration. Source of truth: docs/inventory_real_backend_migration_plan.md
--
-- Idempotent: safe to run on databases that already have these columns.

alter table public.categories
  add column if not exists image_storage_key text,
  add column if not exists low_stock_threshold integer;

-- sku exists in the database for future use (ADR-06.4); it is not surfaced in the
-- seller inventory UI in this iteration.
alter table public.products
  add column if not exists sku text;
