-- 0002_catalog.sql
-- Catalog: Category, ProductGroup, Product (+price), images, attributes,
-- Variant, Inventory, InventoryMovement.
-- Source of truth: docs/03 §4-12. Physical shop table is public.stores.

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  normalized_name text not null,
  sort_order integer not null default 0,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_status_check check (status in ('ACTIVE', 'ARCHIVED'))
);
create unique index if not exists categories_store_normalized_key
  on public.categories (store_id, normalized_name);

create table if not exists public.product_groups (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  product_group_id uuid references public.product_groups(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  title text not null,
  description text not null default '',
  status text not null default 'ACTIVE',
  sort_order integer not null default 0,
  original_amount_minor bigint not null default 0,
  discount_percent smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  deleted_at timestamptz,
  constraint products_status_check check (status in ('ACTIVE', 'ARCHIVED')),
  constraint products_discount_check check (discount_percent between 0 and 100),
  constraint products_amount_check check (original_amount_minor >= 0)
);
create index if not exists products_store_id_idx on public.products (store_id);
create index if not exists products_category_id_idx on public.products (category_id);

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  storage_key text not null,
  sort_order integer not null default 0,
  width integer,
  height integer,
  mime_type text,
  file_size_bytes bigint,
  created_at timestamptz not null default now()
);
create index if not exists product_images_product_id_idx on public.product_images (product_id);

create table if not exists public.product_attributes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,
  value text not null,
  sort_order integer not null default 0
);
create index if not exists product_attributes_product_id_idx on public.product_attributes (product_id);

create table if not exists public.product_link_attributes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,
  value text not null,
  sort_order integer not null default 0
);
create index if not exists product_link_attributes_product_id_idx on public.product_link_attributes (product_id);

create table if not exists public.variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,
  value text not null,
  normalized_value text not null,
  sort_order integer not null default 0,
  status text not null default 'ACTIVE',
  price_mode text not null default 'USE_PRODUCT_PRICE',
  custom_original_amount_minor bigint,
  custom_discount_percent smallint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint variants_status_check check (status in ('ACTIVE', 'ARCHIVED')),
  constraint variants_price_mode_check check (price_mode in ('USE_PRODUCT_PRICE', 'CUSTOM_PRICE')),
  constraint variants_custom_discount_check check (custom_discount_percent is null or custom_discount_percent between 0 and 100),
  constraint variants_custom_amount_check check (custom_original_amount_minor is null or custom_original_amount_minor >= 0)
);
create index if not exists variants_product_id_idx on public.variants (product_id);
create unique index if not exists variants_product_normalized_active_key
  on public.variants (product_id, normalized_value) where status = 'ACTIVE';

create table if not exists public.inventory (
  variant_id uuid primary key references public.variants(id) on delete cascade,
  available_quantity integer not null default 0,
  held_quantity integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint inventory_available_check check (available_quantity >= 0),
  constraint inventory_held_check check (held_quantity >= 0)
);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.variants(id) on delete cascade,
  order_id uuid,
  movement_type text not null,
  quantity integer not null,
  from_bucket text,
  to_bucket text,
  actor_type text not null default 'system',
  actor_user_id uuid references public.users(id) on delete set null,
  reason_code text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint inventory_movements_qty_check check (quantity > 0)
);
create index if not exists inventory_movements_variant_id_idx on public.inventory_movements (variant_id);
create index if not exists inventory_movements_order_id_idx on public.inventory_movements (order_id);
