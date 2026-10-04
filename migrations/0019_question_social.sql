-- 0019_question_social.sql
-- Questions read layer: one question per (buyer, product) and a viewer-aware
-- read (own question + canAsk) with an owner exception for ARCHIVED products.
-- Mirrors the review social read (migrations 0016/0018). Writes (create/hide/
-- answer) land in PD-11b. Source: docs/14 §9; docs/02 §10; docs/03 §21.
--
-- `canAsk` is false when the viewer already has any row (including HIDDEN), so a
-- deleted question cannot be re-asked (same rule as reviews). `viewerQuestion`
-- carries the viewer's ACTIVE question for display/delete. The 2-arg overload is
-- dropped to avoid PostgREST ambiguity.

-- One question row per (buyer, product); "deletion" is HIDDEN and does not
-- restore eligibility. 03 §21.
create unique index if not exists questions_buyer_product_key
  on public.questions (buyer_user_id, product_id);

drop function if exists public.storefront_product_questions_read(text, uuid);

create or replace function public.storefront_product_questions_read(
  p_public_id text,
  p_product_id uuid,
  p_viewer_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store public.stores;
  v_product public.products;
begin
  if p_public_id is null or btrim(p_public_id) = '' or p_product_id is null then
    return null;
  end if;

  select * into v_store
  from public.stores
  where public_id = p_public_id
  limit 1;

  if not found then
    return null;
  end if;

  select * into v_product
  from public.products
  where id = p_product_id
    and store_id = v_store.id
  limit 1;

  if not found then
    return null;
  end if;

  -- Archived product is not public; only the store owner (seller) can read.
  if v_product.status <> 'ACTIVE'
     and (p_viewer_user_id is null or p_viewer_user_id <> v_store.owner_user_id) then
    return null;
  end if;

  return jsonb_build_object(
    -- Whether the viewer may still ask (any row, incl. HIDDEN, blocks it).
    'canAsk', (
      not exists (
        select 1
        from public.questions q
        where q.product_id = v_product.id
          and p_viewer_user_id is not null
          and q.buyer_user_id = p_viewer_user_id
      )
    ),
    -- The viewer's own ACTIVE question (for display/delete), if any.
    'viewerQuestion', (
      select jsonb_build_object(
        'id', q.id,
        'text', q.text,
        'createdAt', q.created_at
      )
      from public.questions q
      where q.product_id = v_product.id
        and q.status = 'ACTIVE'
        and p_viewer_user_id is not null
        and q.buyer_user_id = p_viewer_user_id
      order by q.created_at desc
      limit 1
    ),
    -- ACTIVE questions, newest first; question_id UNIQUE → 0..1 seller answer.
    -- No empty answer block: a question without an answer has "answer": null.
    'questions', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', qq.id,
          'authorName', qq.author_name,
          'text', qq.text,
          'createdAt', qq.created_at,
          'isOwn', qq.is_own,
          'answer', qq.answer
        )
        order by qq.created_at desc
      )
      from (
        select
          q.id,
          q.text,
          q.created_at,
          coalesce(author.author_name, 'Покупатель') as author_name,
          (p_viewer_user_id is not null and q.buyer_user_id = p_viewer_user_id) as is_own,
          case
            when qa.id is null then null
            else jsonb_build_object('text', qa.text, 'createdAt', qa.created_at)
          end as answer
        from public.questions q
        left join public.question_answers qa on qa.question_id = q.id
        left join lateral (
          select coalesce(nullif(ti.first_name, ''), nullif(ti.username, '')) as author_name
          from public.telegram_identities ti
          where ti.user_id = q.buyer_user_id
          order by ti.created_at asc
          limit 1
        ) author on true
        where q.product_id = v_product.id
          and q.status = 'ACTIVE'
        order by q.created_at desc
        limit 50
      ) qq
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.storefront_product_questions_read(text, uuid, uuid) to public;
