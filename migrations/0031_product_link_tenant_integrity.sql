-- 0031_product_link_tenant_integrity.sql
-- PD-H-10: DB-level tenant integrity для `product_links`.
--
-- Проблема (аудит 96e6946): `product_links` хранит `store_id` + `product_id` +
-- `related_product_id`, но согласованность магазина проверялась ТОЛЬКО в RPC
-- (0025). БД не гарантировала, что оба товара принадлежат одному store.
--
-- Решение: composite FK от `(store_id, product_id)` и
-- `(store_id, related_product_id)` к `products(store_id, id)`. Так как `store_id`
-- в строке один и общий, оба товара обязаны принадлежать этому же магазину —
-- инвариант "обе стороны связи из одного store" теперь на уровне БД, а не только
-- в приложении. Для FK-цели нужен уникальный ключ `products(store_id, id)`
-- (`id` и так PK, добавление безопасно).
--
-- Старые single-column FK заменяются composite (ON DELETE CASCADE сохранён).
-- Существующие строки уже консистентны (RPC/dev-путь писали store_id из товара),
-- поэтому ADD CONSTRAINT не должен падать; если строка нарушает — миграция
-- откатится целиком.
--
-- Код приложения не меняется (по-прежнему использует `store_id`).
-- Source: docs/18 PD-H-10; docs/14 §7.

-- FK-цель: уникальность (store_id, id) в products.
alter table public.products
  add constraint products_store_id_id_key unique (store_id, id);

-- Заменяем single-column FK на composite (tenant-aware).
alter table public.product_links
  drop constraint if exists product_links_product_id_fkey,
  drop constraint if exists product_links_related_product_id_fkey;

alter table public.product_links
  add constraint product_links_product_fk
    foreign key (store_id, product_id)
    references public.products (store_id, id)
    on delete cascade,
  add constraint product_links_related_product_fk
    foreign key (store_id, related_product_id)
    references public.products (store_id, id)
    on delete cascade;
