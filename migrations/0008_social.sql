-- 0008_social.sql
-- Reviews and Questions. Source of truth: docs/02 §9-10, docs/03 §20-21.
-- UI comes with the product card page; schema is in place now.

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  buyer_user_id uuid not null references public.users(id) on delete cascade,
  rating smallint not null,
  text text not null default '',
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reviews_rating_check check (rating between 1 and 5),
  constraint reviews_status_check check (status in ('ACTIVE', 'HIDDEN'))
);
-- One review row per (buyer, product); "deletion" is HIDDEN and does not restore eligibility. 03 §20
create unique index if not exists reviews_buyer_product_key on public.reviews (buyer_user_id, product_id);
create index if not exists reviews_product_id_idx on public.reviews (product_id);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  buyer_user_id uuid not null references public.users(id) on delete cascade,
  text text not null,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  constraint questions_status_check check (status in ('ACTIVE', 'HIDDEN'))
);
create index if not exists questions_product_id_idx on public.questions (product_id);

-- One question -> max one seller answer, no threads. 02 §10, 03 §21
create table if not exists public.question_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null unique references public.questions(id) on delete cascade,
  seller_user_id uuid not null references public.users(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
