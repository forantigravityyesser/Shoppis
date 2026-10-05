-- 0029_product_social_write_guard.sql
-- PD-H-02 + PD-H-03: guard'ы записи отзывов/вопросов на уровне БД.
--
-- PD-H-02 (archived): `review_create_atomic` (0017) и `question_create_atomic`
-- (0020) проверяли store exists / store ACTIVE / отсутствие дубликата, но НЕ
-- проверяли `product.status = 'ACTIVE'`. UI скрывает композер у архивных
-- товаров, но UI не является authorization boundary — прямой вызов edge/RPC
-- позволял оставить отзыв/вопрос на архивном товаре. Наружу отдаём
-- `PRODUCT_NOT_FOUND` (не раскрываем «archived»); edge маппит его в 404.
--
-- PD-H-03 (self-review): владелец магазина не может оставлять отзыв/вопрос по
-- своему товару. UI seller не показывает композер, но проверка нужна на сервере
-- (OWASP: скрытые/disabled-элементы клиента — не boundary). Отдаём `FORBIDDEN`
-- (edge → 403).
--
-- Source: docs/18 PD-H-02, PD-H-03; docs/14 §8-9.

-- ── review_create_atomic (0017 + product ACTIVE guard) ─────────────────────────
create or replace function public.review_create_atomic(
  p_product_id uuid,
  p_actor_user_id uuid,
  p_rating smallint,
  p_text text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.products;
  v_store public.stores;
  v_text text := btrim(coalesce(p_text, ''));
  v_id uuid;
begin
  if p_actor_user_id is null then
    raise exception 'UNAUTHORIZED';
  end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'INVALID_RATING';
  end if;
  if length(v_text) > 2000 then
    raise exception 'TEXT_TOO_LONG';
  end if;

  select * into v_product from public.products where id = p_product_id limit 1;
  if not found then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;

  -- PD-H-02: архивный товар не принимает запись (UI не является boundary).
  if v_product.status <> 'ACTIVE' then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;

  select * into v_store from public.stores where id = v_product.store_id limit 1;
  if not found then
    raise exception 'STORE_NOT_FOUND';
  end if;
  if v_store.status <> 'ACTIVE' then
    raise exception 'STORE_PAUSED';
  end if;

  -- PD-H-03: владелец магазина не оставляет отзыв по своему товару.
  if p_actor_user_id = v_store.owner_user_id then
    raise exception 'FORBIDDEN';
  end if;

  if exists (
    select 1 from public.reviews
    where product_id = p_product_id and buyer_user_id = p_actor_user_id
  ) then
    raise exception 'ALREADY_REVIEWED';
  end if;

  insert into public.reviews (store_id, product_id, buyer_user_id, rating, text, status)
  values (v_product.store_id, p_product_id, p_actor_user_id, p_rating, v_text, 'ACTIVE')
  returning id into v_id;

  return jsonb_build_object('success', true, 'reviewId', v_id);
end;
$$;

-- ── question_create_atomic (0020 + product ACTIVE guard) ───────────────────────
create or replace function public.question_create_atomic(
  p_product_id uuid,
  p_actor_user_id uuid,
  p_text text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.products;
  v_store public.stores;
  v_text text := btrim(coalesce(p_text, ''));
  v_id uuid;
begin
  if p_actor_user_id is null then
    raise exception 'UNAUTHORIZED';
  end if;
  if v_text = '' then
    raise exception 'TEXT_REQUIRED';
  end if;
  if length(v_text) > 2000 then
    raise exception 'TEXT_TOO_LONG';
  end if;

  select * into v_product from public.products where id = p_product_id limit 1;
  if not found then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;

  -- PD-H-02: архивный товар не принимает запись.
  if v_product.status <> 'ACTIVE' then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;

  select * into v_store from public.stores where id = v_product.store_id limit 1;
  if not found then
    raise exception 'STORE_NOT_FOUND';
  end if;
  if v_store.status <> 'ACTIVE' then
    raise exception 'STORE_PAUSED';
  end if;

  -- PD-H-03: владелец магазина не задаёт вопрос по своему товару.
  if p_actor_user_id = v_store.owner_user_id then
    raise exception 'FORBIDDEN';
  end if;

  if exists (
    select 1 from public.questions
    where product_id = p_product_id and buyer_user_id = p_actor_user_id
  ) then
    raise exception 'ALREADY_ASKED';
  end if;

  insert into public.questions (store_id, product_id, buyer_user_id, text, status)
  values (v_product.store_id, p_product_id, p_actor_user_id, v_text, 'ACTIVE')
  returning id into v_id;

  return jsonb_build_object('success', true, 'questionId', v_id);
end;
$$;

grant execute on function public.review_create_atomic(uuid, uuid, smallint, text) to public;
grant execute on function public.question_create_atomic(uuid, uuid, text) to public;
