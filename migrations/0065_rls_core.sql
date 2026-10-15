-- 0065_rls_core.sql
-- Ядро RLS (docs/11 §S1, Фаза 4): истинная граница доступа поверх грантов.
--
-- Модель (ADR-C): клиент после входа ходит как `authenticated` с платформенным
-- JWT (`sub = users.id`, `auth.uid()`); мутации — только через edge (project_admin
-- bypass RLS), чтения витрины — через `storefront_*` (security definer). Здесь:
--   * helper-функции владения (SECURITY DEFINER → нет рекурсии политик);
--   * у `anon`/`authenticated` отзываются ВСЕ гранты на 22 таблицах;
--   * `authenticated` получает SELECT + строковые политики (своё/публичное);
--   * включается RLS. `anon` политик не имеет → ни одной строки.
--
-- Владелец таблиц (`project_admin`) RLS не подчиняется → edge/магазин не ломается.
--
-- Source: docs/11 §S1, docs/03 §26, docs/24 §3.1.

-- Хелперы владения. Все — SECURITY DEFINER, search_path пиннится, без рекурсии.
create or replace function public.app_is_store_owner(p_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.stores s
    where s.id = p_store_id and s.owner_user_id = auth.uid()
  );
$$;

create or replace function public.app_owns_product(p_product_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.products p
    where p.id = p_product_id and public.app_is_store_owner(p.store_id)
  );
$$;

create or replace function public.app_owns_variant(p_variant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.variants v
    where v.id = p_variant_id and public.app_owns_product(v.product_id)
  );
$$;

create or replace function public.app_order_readable(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.orders o
    where o.id = p_order_id
      and (o.buyer_user_id = auth.uid() or public.app_is_store_owner(o.store_id))
  );
$$;

create or replace function public.app_review_readable(p_review_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.reviews r
    where r.id = p_review_id
      and (
        r.status = 'ACTIVE'
        or r.buyer_user_id = auth.uid()
        or public.app_is_store_owner(r.store_id)
      )
  );
$$;

create or replace function public.app_question_readable(p_question_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.questions q
    where q.id = p_question_id
      and (
        q.status = 'ACTIVE'
        or q.buyer_user_id = auth.uid()
        or public.app_is_store_owner(q.store_id)
      )
  );
$$;

revoke all on function public.app_is_store_owner(uuid) from public, anon, authenticated;
revoke all on function public.app_owns_product(uuid) from public, anon, authenticated;
revoke all on function public.app_owns_variant(uuid) from public, anon, authenticated;
revoke all on function public.app_order_readable(uuid) from public, anon, authenticated;
revoke all on function public.app_review_readable(uuid) from public, anon, authenticated;
revoke all on function public.app_question_readable(uuid) from public, anon, authenticated;

-- Снимаем широкие гранты и включаем RLS на всех 22 бизнес-таблицах.
do $$
declare
  r record;
begin
  for r in
    select unnest(array[
      'buyer_store_visits', 'categories', 'inventory', 'inventory_movements',
      'order_idempotency', 'order_items', 'order_status_history', 'orders',
      'product_attributes', 'product_groups', 'product_images',
      'product_link_attributes', 'product_links', 'products', 'question_answers',
      'questions', 'review_replies', 'reviews', 'stores', 'telegram_identities',
      'users', 'variants'
    ]) as tbl
  loop
    execute format('revoke all on table public.%I from anon, authenticated', r.tbl);
    execute format('alter table public.%I enable row level security', r.tbl);
  end loop;
end $$;

-- SELECT-грант только той роли, для которой есть политики.
grant select on table
  public.users, public.telegram_identities, public.stores, public.categories,
  public.products, public.product_groups, public.product_images,
  public.product_attributes, public.product_link_attributes, public.product_links,
  public.variants, public.inventory, public.inventory_movements, public.orders,
  public.order_items, public.order_status_history, public.reviews,
  public.review_replies, public.questions, public.question_answers,
  public.buyer_store_visits
to authenticated;

-- Индекс под политику stores.owner_user_id = auth.uid().
create index if not exists stores_owner_user_id_idx on public.stores (owner_user_id);

-- Политики SELECT для authenticated. `anon` и запись — deny (edge/admin).
drop policy if exists rls_users_select on public.users;
create policy rls_users_select on public.users
  for select to authenticated using (id = auth.uid());

drop policy if exists rls_telegram_identities_select on public.telegram_identities;
create policy rls_telegram_identities_select on public.telegram_identities
  for select to authenticated using (user_id = auth.uid());

drop policy if exists rls_stores_select on public.stores;
create policy rls_stores_select on public.stores
  for select to authenticated using (owner_user_id = auth.uid());

drop policy if exists rls_categories_select on public.categories;
create policy rls_categories_select on public.categories
  for select to authenticated using (public.app_is_store_owner(store_id));

drop policy if exists rls_products_select on public.products;
create policy rls_products_select on public.products
  for select to authenticated using (public.app_is_store_owner(store_id));

drop policy if exists rls_product_groups_select on public.product_groups;
create policy rls_product_groups_select on public.product_groups
  for select to authenticated using (public.app_is_store_owner(store_id));

drop policy if exists rls_product_images_select on public.product_images;
create policy rls_product_images_select on public.product_images
  for select to authenticated using (public.app_owns_product(product_id));

drop policy if exists rls_product_attributes_select on public.product_attributes;
create policy rls_product_attributes_select on public.product_attributes
  for select to authenticated using (public.app_owns_product(product_id));

drop policy if exists rls_product_link_attributes_select on public.product_link_attributes;
create policy rls_product_link_attributes_select on public.product_link_attributes
  for select to authenticated using (public.app_owns_product(product_id));

drop policy if exists rls_product_links_select on public.product_links;
create policy rls_product_links_select on public.product_links
  for select to authenticated using (public.app_is_store_owner(store_id));

drop policy if exists rls_variants_select on public.variants;
create policy rls_variants_select on public.variants
  for select to authenticated using (public.app_owns_product(product_id));

drop policy if exists rls_inventory_select on public.inventory;
create policy rls_inventory_select on public.inventory
  for select to authenticated using (public.app_owns_variant(variant_id));

drop policy if exists rls_inventory_movements_select on public.inventory_movements;
create policy rls_inventory_movements_select on public.inventory_movements
  for select to authenticated using (public.app_owns_variant(variant_id));

drop policy if exists rls_orders_select on public.orders;
create policy rls_orders_select on public.orders
  for select to authenticated
  using (buyer_user_id = auth.uid() or public.app_is_store_owner(store_id));

drop policy if exists rls_order_items_select on public.order_items;
create policy rls_order_items_select on public.order_items
  for select to authenticated using (public.app_order_readable(order_id));

drop policy if exists rls_order_status_history_select on public.order_status_history;
create policy rls_order_status_history_select on public.order_status_history
  for select to authenticated using (public.app_order_readable(order_id));

drop policy if exists rls_reviews_select on public.reviews;
create policy rls_reviews_select on public.reviews
  for select to authenticated
  using (
    status = 'ACTIVE'
    or buyer_user_id = auth.uid()
    or public.app_is_store_owner(store_id)
  );

drop policy if exists rls_review_replies_select on public.review_replies;
create policy rls_review_replies_select on public.review_replies
  for select to authenticated using (public.app_review_readable(review_id));

drop policy if exists rls_questions_select on public.questions;
create policy rls_questions_select on public.questions
  for select to authenticated
  using (
    status = 'ACTIVE'
    or buyer_user_id = auth.uid()
    or public.app_is_store_owner(store_id)
  );

drop policy if exists rls_question_answers_select on public.question_answers;
create policy rls_question_answers_select on public.question_answers
  for select to authenticated using (public.app_question_readable(question_id));

drop policy if exists rls_buyer_store_visits_select on public.buyer_store_visits;
create policy rls_buyer_store_visits_select on public.buyer_store_visits
  for select to authenticated using (buyer_user_id = auth.uid());
