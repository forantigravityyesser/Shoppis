-- 0024_home_products_keyset_index.sql
-- Performance: Home product stream (`storefront_home_products_read`) paginates by
-- keyset, ordered by (created_at DESC, id DESC) within a store. Without a matching
-- index Postgres reads every product of the store, sorts it, then applies LIMIT —
-- O(store size) work per page. The partial composite index below lets the planner
-- index-scan in order and stop at the page limit (O(page)).
--
-- Measured (HARDEN-10, 2000 products): page read 0.9 ms vs ~460 ms without a
-- matching index / with stale stats; index scan returns 7 rows from 3 buffers.
-- Source of truth: docs/15 §10, §11 (HOME-HARDEN-10).
create index if not exists products_store_active_created_idx
  on public.products (store_id, created_at desc, id desc)
  where status = 'ACTIVE';
