-- 0020_question_write.sql
-- Buyer/seller question writes: ask a question, hide a question (own buyer or
-- store owner), answer a question (store owner only, once). Source: docs/14 §9,
-- docs/02 §10, docs/03 §21. Actor id always comes from the edge session
-- (`question-actions.js`), never from the client input.
--
-- Rules:
--  - question: one row per (buyer_user_id, product_id) (unique index, 0019);
--    HIDDEN does not restore eligibility; text required (<= 2000).
--  - answer: one per question (`question_answers.question_id UNIQUE`); only the
--    store owner may answer; a buyer can never answer.
--  - store must be ACTIVE.

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

  select * into v_store from public.stores where id = v_product.store_id limit 1;
  if not found then
    raise exception 'STORE_NOT_FOUND';
  end if;
  if v_store.status <> 'ACTIVE' then
    raise exception 'STORE_PAUSED';
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

create or replace function public.question_hide_atomic(
  p_question_id uuid,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_question public.questions;
  v_owner uuid;
begin
  if p_actor_user_id is null then
    raise exception 'UNAUTHORIZED';
  end if;

  select * into v_question from public.questions where id = p_question_id limit 1;
  if not found then
    raise exception 'QUESTION_NOT_FOUND';
  end if;

  select owner_user_id into v_owner from public.stores where id = v_question.store_id limit 1;
  if p_actor_user_id <> v_question.buyer_user_id
     and (v_owner is null or p_actor_user_id <> v_owner) then
    raise exception 'FORBIDDEN';
  end if;

  update public.questions
  set status = 'HIDDEN'
  where id = p_question_id;

  return jsonb_build_object('success', true, 'questionId', p_question_id);
end;
$$;

create or replace function public.question_answer_create_atomic(
  p_question_id uuid,
  p_actor_user_id uuid,
  p_text text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_question public.questions;
  v_owner uuid;
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

  select * into v_question from public.questions where id = p_question_id limit 1;
  if not found or v_question.status <> 'ACTIVE' then
    raise exception 'QUESTION_NOT_FOUND';
  end if;

  -- Only the store owner (seller) may answer; buyers cannot answer.
  select owner_user_id into v_owner from public.stores where id = v_question.store_id limit 1;
  if v_owner is null or p_actor_user_id <> v_owner then
    raise exception 'FORBIDDEN';
  end if;

  if exists (
    select 1 from public.question_answers where question_id = p_question_id
  ) then
    raise exception 'DUPLICATE_ANSWER';
  end if;

  insert into public.question_answers (question_id, seller_user_id, text)
  values (p_question_id, p_actor_user_id, v_text)
  returning id into v_id;

  return jsonb_build_object('success', true, 'answerId', v_id);
end;
$$;

grant execute on function public.question_create_atomic(uuid, uuid, text) to public;
grant execute on function public.question_hide_atomic(uuid, uuid) to public;
grant execute on function public.question_answer_create_atomic(uuid, uuid, text) to public;
