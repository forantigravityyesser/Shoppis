-- 0003_orders.sql
-- Orders: Order, OrderItem (immutable snapshots), OrderStatusHistory, idempotency.
-- Source of truth: docs/03 §13-17, §24, §25.

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  public_order_number text not null,
  store_id uuid not null references public.stores(id) on delete restrict,
  buyer_user_id uuid not null references public.users(id) on delete restrict,
  buyer_full_name_snapshot text not null,
  buyer_phone_snapshot text not null,
  buyer_address_snapshot text not null,
  buyer_telegram_username_snapshot text,
  status text not null default 'NEW',
  currency_code text not null,
  subtotal_minor bigint not null default 0,
  total_minor bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz,
  completed_at timestamptz,
  refused_at timestamptz,
  refusal_reason_code text,
  constraint orders_status_check check (status in ('NEW', 'IN_TRANSIT', 'DELIVERED', 'REFUSED', 'CANCELLED')),
  constraint orders_amounts_check check (subtotal_minor >= 0 and total_minor >= 0)
);
create unique index if not exists orders_public_order_number_key on public.orders (public_order_number);
create index if not exists orders_store_id_idx on public.orders (store_id);
create index if not exists orders_buyer_user_id_idx on public.orders (buyer_user_id);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.variants(id) on delete set null,
  product_title_snapshot text not null,
  product_description_snapshot text,
  product_image_snapshot text,
  linking_attributes_snapshot jsonb not null default '[]'::jsonb,
  variant_name_snapshot text,
  variant_value_snapshot text,
  quantity integer not null,
  original_unit_price_minor bigint not null,
  discount_percent smallint not null default 0,
  unit_price_minor bigint not null,
  line_total_minor bigint not null,
  currency_code text not null,
  constraint order_items_qty_check check (quantity > 0),
  constraint order_items_amounts_check check (
    original_unit_price_minor >= 0 and unit_price_minor >= 0 and line_total_minor >= 0
  ),
  constraint order_items_discount_check check (discount_percent between 0 and 100)
);
create index if not exists order_items_order_id_idx on public.order_items (order_id);

create table if not exists public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  from_status text,
  to_status text not null,
  actor_type text not null,
  actor_user_id uuid references public.users(id) on delete set null,
  reason_code text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists order_status_history_order_id_idx on public.order_status_history (order_id);

create table if not exists public.order_idempotency (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null,
  buyer_user_id uuid not null references public.users(id) on delete cascade,
  order_id uuid references public.orders(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint order_idempotency_buyer_key_unique unique (buyer_user_id, idempotency_key)
);

alter table public.inventory_movements
  drop constraint if exists inventory_movements_order_id_fkey;
alter table public.inventory_movements
  add constraint inventory_movements_order_id_fkey
  foreign key (order_id) references public.orders(id) on delete set null;
