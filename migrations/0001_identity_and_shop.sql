-- 0001_identity_and_shop.sql
-- Foundation: User, TelegramIdentity, Shop ownership/status/public_id.
-- Source of truth: docs/03_VUTRINA_DOMAIN_DATABASE_SPEC_v0.2.md §2-3.
-- Physical shop table is public.stores (Store ≡ Shop synonym in this codebase).

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.users drop constraint if exists users_status_check;
alter table public.users add constraint users_status_check check (status in ('ACTIVE', 'BLOCKED'));

create table if not exists public.telegram_identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  telegram_user_id bigint not null,
  username text,
  first_name text,
  last_name text,
  language_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists telegram_identities_telegram_user_id_key
  on public.telegram_identities (telegram_user_id);
create index if not exists telegram_identities_user_id_idx
  on public.telegram_identities (user_id);

alter table public.stores add column if not exists owner_user_id uuid
  references public.users(id) on delete restrict;
alter table public.stores add column if not exists status text not null default 'ACTIVE';
alter table public.stores add column if not exists public_id text;
alter table public.stores add column if not exists seller_contact text;
alter table public.stores add column if not exists updated_at timestamptz not null default now();

alter table public.stores drop constraint if exists stores_status_check;
alter table public.stores add constraint stores_status_check check (status in ('ACTIVE', 'PAUSED'));

do $$
declare
  r record;
  uid uuid;
begin
  for r in
    select distinct owner_telegram_id as tg
    from public.stores
    where owner_telegram_id is not null and owner_telegram_id <> ''
  loop
    select user_id into uid
    from public.telegram_identities
    where telegram_user_id = r.tg::bigint;

    if uid is null then
      insert into public.users default values returning id into uid;
      insert into public.telegram_identities (user_id, telegram_user_id, username, first_name)
      values (
        uid,
        r.tg::bigint,
        (select c.username from public.customers c where c.telegram_id = r.tg limit 1),
        (select c.name from public.customers c where c.telegram_id = r.tg limit 1)
      );
    end if;

    update public.stores set owner_user_id = uid where owner_telegram_id = r.tg;
    update public.stores
      set seller_contact = coalesce(seller_contact, support_handle)
      where owner_telegram_id = r.tg;
  end loop;
end $$;

update public.stores
  set public_id = replace(gen_random_uuid()::text, '-', '')
  where public_id is null;

create unique index if not exists stores_public_id_key on public.stores (public_id);
