-- 0017_review_write.sql
-- Buyer/seller review writes: create review, hide review (own / store owner),
-- reply to a review (buyer once per review, seller on any). Source: docs/14 §8,
-- docs/02 §9-10, docs/03 §20-21. Actor id always comes from the edge session
-- (`review-actions.js`), never from the client input.
--
-- Rules:
--  - review: one row per (buyer_user_id, product_id), HIDDEN does not restore
--    eligibility; rating 1..5; text optional (<= 2000).
--  - reply: one per (review_id, author_user_id); author_type is SELLER when the
--    author owns the store, otherwise BUYER; a buyer cannot reply to own review.
--  - store must be ACTIVE.

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

  select * into v_store from public.stores where id = v_product.store_id limit 1;
  if not found then
    raise exception 'STORE_NOT_FOUND';
  end if;
  if v_store.status <> 'ACTIVE' then
    raise exception 'STORE_PAUSED';
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

create or replace function public.review_hide_atomic(
  p_review_id uuid,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_review public.reviews;
  v_owner uuid;
begin
  if p_actor_user_id is null then
    raise exception 'UNAUTHORIZED';
  end if;

  select * into v_review from public.reviews where id = p_review_id limit 1;
  if not found then
    raise exception 'REVIEW_NOT_FOUND';
  end if;

  select owner_user_id into v_owner from public.stores where id = v_review.store_id limit 1;
  if p_actor_user_id <> v_review.buyer_user_id
     and (v_owner is null or p_actor_user_id <> v_owner) then
    raise exception 'FORBIDDEN';
  end if;

  update public.reviews
  set status = 'HIDDEN', updated_at = now()
  where id = p_review_id;

  return jsonb_build_object('success', true, 'reviewId', p_review_id);
end;
$$;

create or replace function public.review_reply_create_atomic(
  p_review_id uuid,
  p_actor_user_id uuid,
  p_text text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_review public.reviews;
  v_owner uuid;
  v_text text := btrim(coalesce(p_text, ''));
  v_type text;
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

  select * into v_review from public.reviews where id = p_review_id limit 1;
  if not found or v_review.status <> 'ACTIVE' then
    raise exception 'REVIEW_NOT_FOUND';
  end if;

  select owner_user_id into v_owner from public.stores where id = v_review.store_id limit 1;
  v_type := case
    when v_owner is not null and p_actor_user_id = v_owner then 'SELLER'
    else 'BUYER'
  end;

  if v_type = 'BUYER' and p_actor_user_id = v_review.buyer_user_id then
    raise exception 'CANNOT_REPLY_OWN';
  end if;

  if exists (
    select 1 from public.review_replies
    where review_id = p_review_id and author_user_id = p_actor_user_id
  ) then
    raise exception 'DUPLICATE_REPLY';
  end if;

  insert into public.review_replies (review_id, author_user_id, author_type, text)
  values (p_review_id, p_actor_user_id, v_type, v_text)
  returning id into v_id;

  return jsonb_build_object('success', true, 'replyId', v_id, 'authorType', v_type);
end;
$$;

grant execute on function public.review_create_atomic(uuid, uuid, smallint, text) to public;
grant execute on function public.review_hide_atomic(uuid, uuid) to public;
grant execute on function public.review_reply_create_atomic(uuid, uuid, text) to public;
