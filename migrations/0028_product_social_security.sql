-- 0028_product_social_security.sql
-- PD-H-01: убрать доверие к клиентскому viewer id при доступе к social-данным.
--
-- Проблема (аудит 96e6946): `storefront_product_reviews_read` /
-- `storefront_product_questions_read` использовали `p_viewer_user_id` как
-- авторитетную identity: при `product.status <> 'ACTIVE'` данные отдавались,
-- если viewer совпадал с owner магазина (0018/0019). Значение приходило из
-- клиента, поэтому архивный товар читался с подделанным owner-UUID.
--
-- Решение:
--  * Публичные read-RPC больше НЕ дают доступ к ARCHIVED никому. Параметр
--    `p_viewer_user_id` остаётся только неавторитетной UI-подсказкой
--    (`isOwn` / `viewerReview` / `canReview`) и никогда не влияет на доступ.
--  * Seller-модерация (в т.ч. архивных товаров) вынесена в отдельные
--    `seller_product_reviews_read` / `seller_product_questions_read`, где actor
--    приходит из серверной сессии через edge (`review-actions`/`question-actions`),
--    а не из тела запроса. Проверка `actor = owner` выполняется в БД.
--  * Общая сборка проекции вынесена в internal-хелперы (execute у public отозван).
--
-- Остаточный риск: пока RLS выключен и edge ходит под anon-ключом, прямой вызов
-- seller-RPC с подделанным actor теоретически возможен, но требует знания
-- непубличного owner_user_id. Полное закрытие — вместе с RLS (`11 §S1`).
--
-- Source: docs/18 PD-H-01; docs/14 §8-9.

-- ── internal helper: reviews projection ────────────────────────────────────────
create or replace function public._storefront_reviews_projection(
  p_product_id uuid,
  p_viewer_user_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return (
    select jsonb_build_object(
      'summary', (
        select jsonb_build_object(
          'average', coalesce(round(avg(r.rating)::numeric, 1), 0),
          'count', count(*)
        )
        from public.reviews r
        where r.product_id = p_product_id
          and r.status = 'ACTIVE'
      ),
      'distribution', (
        select jsonb_agg(
          jsonb_build_object('rating', g.r, 'count', coalesce(c.cnt, 0))
          order by g.r desc
        )
        from generate_series(1, 5) as g(r)
        left join (
          select rating, count(*) as cnt
          from public.reviews
          where product_id = p_product_id
            and status = 'ACTIVE'
          group by rating
        ) c on c.rating = g.r
      ),
      -- Hints only: derived from the (untrusted) viewer id, never used for access.
      'canReview', (
        not exists (
          select 1
          from public.reviews r
          where r.product_id = p_product_id
            and p_viewer_user_id is not null
            and r.buyer_user_id = p_viewer_user_id
        )
      ),
      'viewerReview', (
        select jsonb_build_object(
          'id', r.id,
          'rating', r.rating,
          'text', r.text,
          'createdAt', r.created_at
        )
        from public.reviews r
        where r.product_id = p_product_id
          and r.status = 'ACTIVE'
          and p_viewer_user_id is not null
          and r.buyer_user_id = p_viewer_user_id
        order by r.created_at desc
        limit 1
      ),
      'reviews', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', rr.id,
            'authorName', rr.author_name,
            'rating', rr.rating,
            'text', rr.text,
            'createdAt', rr.created_at,
            'isOwn', rr.is_own,
            'replies', rr.replies
          )
          order by rr.created_at desc
        )
        from (
          select
            r.id,
            r.rating,
            r.text,
            r.created_at,
            coalesce(author.author_name, 'Покупатель') as author_name,
            (p_viewer_user_id is not null and r.buyer_user_id = p_viewer_user_id) as is_own,
            coalesce((
              select jsonb_agg(
                jsonb_build_object(
                  'id', rep.id,
                  'authorName', rep.author_name,
                  'authorType', rep.author_type,
                  'text', rep.text,
                  'createdAt', rep.created_at,
                  'isOwn', rep.is_own
                )
                order by rep.created_at asc
              )
              from (
                select
                  rp.id,
                  rp.author_type,
                  rp.text,
                  rp.created_at,
                  coalesce(rauthor.author_name, 'Покупатель') as author_name,
                  (p_viewer_user_id is not null and rp.author_user_id = p_viewer_user_id) as is_own
                from public.review_replies rp
                left join lateral (
                  select coalesce(nullif(ti.first_name, ''), nullif(ti.username, '')) as author_name
                  from public.telegram_identities ti
                  where ti.user_id = rp.author_user_id
                  order by ti.created_at asc
                  limit 1
                ) rauthor on true
                where rp.review_id = r.id
              ) rep
            ), '[]'::jsonb) as replies
          from public.reviews r
          left join lateral (
            select coalesce(nullif(ti.first_name, ''), nullif(ti.username, '')) as author_name
            from public.telegram_identities ti
            where ti.user_id = r.buyer_user_id
            order by ti.created_at asc
            limit 1
          ) author on true
          where r.product_id = p_product_id
            and r.status = 'ACTIVE'
          order by r.created_at desc
          limit 50
        ) rr
      ), '[]'::jsonb)
    )
  );
end;
$$;
revoke all on function public._storefront_reviews_projection(uuid, uuid) from public;

-- ── internal helper: questions projection ──────────────────────────────────────
create or replace function public._storefront_questions_projection(
  p_product_id uuid,
  p_viewer_user_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return (
    select jsonb_build_object(
      'canAsk', (
        not exists (
          select 1
          from public.questions q
          where q.product_id = p_product_id
            and p_viewer_user_id is not null
            and q.buyer_user_id = p_viewer_user_id
        )
      ),
      'viewerQuestion', (
        select jsonb_build_object(
          'id', q.id,
          'text', q.text,
          'createdAt', q.created_at
        )
        from public.questions q
        where q.product_id = p_product_id
          and q.status = 'ACTIVE'
          and p_viewer_user_id is not null
          and q.buyer_user_id = p_viewer_user_id
        order by q.created_at desc
        limit 1
      ),
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
          where q.product_id = p_product_id
            and q.status = 'ACTIVE'
          order by q.created_at desc
          limit 50
        ) qq
      ), '[]'::jsonb)
    )
  );
end;
$$;
revoke all on function public._storefront_questions_projection(uuid, uuid) from public;

-- ── public reviews read (ARCHIVED → null for everyone) ─────────────────────────
create or replace function public.storefront_product_reviews_read(
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

  -- Archived product is never public (no owner-exception). `p_viewer_user_id`
  -- is a UI hint only; it must never widen access here.
  if v_product.status <> 'ACTIVE' then
    return null;
  end if;

  return public._storefront_reviews_projection(v_product.id, p_viewer_user_id);
end;
$$;

grant execute on function public.storefront_product_reviews_read(text, uuid, uuid) to public;

-- ── public questions read (ARCHIVED → null for everyone) ───────────────────────
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

  if v_product.status <> 'ACTIVE' then
    return null;
  end if;

  return public._storefront_questions_projection(v_product.id, p_viewer_user_id);
end;
$$;

grant execute on function public.storefront_product_questions_read(text, uuid, uuid) to public;

-- ── seller reviews read (actor from session; owner-only; archived allowed) ─────
create or replace function public.seller_product_reviews_read(
  p_product_id uuid,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.products;
  v_owner uuid;
begin
  if p_actor_user_id is null then
    raise exception 'UNAUTHORIZED';
  end if;
  if p_product_id is null then
    return null;
  end if;

  select * into v_product from public.products where id = p_product_id limit 1;
  if not found then
    return null;
  end if;

  select owner_user_id into v_owner
  from public.stores
  where id = v_product.store_id
  limit 1;
  if v_owner is null or p_actor_user_id <> v_owner then
    raise exception 'FORBIDDEN';
  end if;

  return public._storefront_reviews_projection(v_product.id, p_actor_user_id);
end;
$$;

grant execute on function public.seller_product_reviews_read(uuid, uuid) to public;

-- ── seller questions read (actor from session; owner-only; archived allowed) ───
create or replace function public.seller_product_questions_read(
  p_product_id uuid,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.products;
  v_owner uuid;
begin
  if p_actor_user_id is null then
    raise exception 'UNAUTHORIZED';
  end if;
  if p_product_id is null then
    return null;
  end if;

  select * into v_product from public.products where id = p_product_id limit 1;
  if not found then
    return null;
  end if;

  select owner_user_id into v_owner
  from public.stores
  where id = v_product.store_id
  limit 1;
  if v_owner is null or p_actor_user_id <> v_owner then
    raise exception 'FORBIDDEN';
  end if;

  return public._storefront_questions_projection(v_product.id, p_actor_user_id);
end;
$$;

grant execute on function public.seller_product_questions_read(uuid, uuid) to public;
