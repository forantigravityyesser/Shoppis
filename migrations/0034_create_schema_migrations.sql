-- 0034_create_schema_migrations.sql
-- Project migration tracking (bootstrap / baseline).
--
-- Why this exists: project migrations under `migrations/*.sql` were applied by hand
-- (admin SQL) and never recorded anywhere, so the backend had no way to answer
-- "what is already applied?" and the duplicate `0030_*` could slip through. This
-- table is the project-owned registry of applied migrations.
--
-- Scope note: this is NOT InsForge CLI's `system.custom_migrations`. That managed
-- schema is off-limits, and the CLI's migration format (timestamp versions,
-- hyphenated names, `up` requiring the target to be the next pending after the
-- remote head) cannot represent the existing sequential history nor backfill it.
-- See `migrations/README.md` for the convention and the rationale.
--
-- Baseline: every migration currently reflected in this backend (0001..0034) is
-- recorded as applied. Future migrations insert their own row when applied
-- (or via `npm run migrations:record -- <version>`).
--
-- Access: only the migration owner (`project_admin`) may touch this table.
-- Runtime roles (`anon`/`authenticated`) get full DML on public tables by default,
-- so revoke it explicitly — migration history must not be public.

create table if not exists public.schema_migrations (
  version text primary key,
  name text not null,
  applied_at timestamptz not null default now()
);

insert into public.schema_migrations (version, name) values
  ('0001', 'identity_and_shop'),
  ('0002', 'catalog'),
  ('0003', 'orders'),
  ('0004', 'checkout'),
  ('0005', 'order_delivery_outcome'),
  ('0006', 'drop_customers'),
  ('0007', 'inventory_lifecycle'),
  ('0008', 'social'),
  ('0009', 'inventory_columns'),
  ('0010', 'product_image_thumb'),
  ('0011', 'catalog_atomic'),
  ('0012', 'store_settings_atomic'),
  ('0013', 'buyer_notifications'),
  ('0014', 'storefront_home_read'),
  ('0015', 'storefront_product_detail_read'),
  ('0016', 'review_social'),
  ('0017', 'review_write'),
  ('0018', 'review_seller_read'),
  ('0019', 'question_social'),
  ('0020', 'question_write'),
  ('0021', 'storefront_public_context'),
  ('0022', 'storefront_home_read_no_seller_avatar'),
  ('0023', 'storefront_home_split_read'),
  ('0024', 'home_products_keyset_index'),
  ('0025', 'product_link'),
  ('0026', 'storefront_catalog_read'),
  ('0027', 'category_reorder'),
  ('0028', 'product_social_security'),
  ('0029', 'product_social_write_guard'),
  ('0030', 'related_products_limit'),
  ('0031', 'product_link_tenant_integrity'),
  ('0032', 'security_definer_search_path'),
  ('0033', 'storefront_catalog_hardening'),
  ('0034', 'create_schema_migrations')
on conflict (version) do nothing;

revoke all on public.schema_migrations from anon;
revoke all on public.schema_migrations from authenticated;
