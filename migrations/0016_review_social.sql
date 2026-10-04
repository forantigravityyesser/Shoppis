-- 0016_review_social.sql
-- Reviews read layer (distribution + replies + viewer context) and the reply table
-- groundwork for writes (writes themselves land in PD-10b). Source: docs/14 §8;
-- docs/02 §9; docs/03 §20.
--
-- `review_replies`: one reply per (review, author); author_type is resolved
-- server-side (SELLER when the author owns the store, otherwise BUYER). Writes
-- (create/hide/reply) are added later via edge + atomic RPC.
--
-- `storefront_product_reviews_read` gains an optional viewer id so the client can
-- mark "own" reviews/replies and learn whether the viewer may still review. The
-- 2-arg overload is dropped to avoid PostgREST ambiguity.

create table if not exists public.review_replies (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  author_user_id uuid not null references public.users(id) on delete cascade,
  author_type text not null default 'BUYER',
  text text not null,
  created_at timestamptz not null default now(),
  constraint review_replies_author_type_check check (author_type in ('BUYER', 'SELLER')),
  constraint review_replies_review_author_key unique (review_id, author_user_id)
);

create index if not exists review_replies_review_id_idx on public.review_replies (review_id);

drop function if exists public.storefront_product_reviews_read(text, uuid);

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

  if not found or v_product.status <> 'ACTIVE' then
    return null;
  end if;

  return jsonb_build_object(
    'summary', (
      select jsonb_build_object(
        'average', coalesce(round(avg(r.rating)::numeric, 1), 0),
        'count', count(*)
      )
      from public.reviews r
      where r.product_id = v_product.id
        and r.status = 'ACTIVE'
    ),
    -- Distribution always has all 5 buckets (5★ → 1★), zeros included.
    'distribution', (
      select jsonb_agg(
        jsonb_build_object('rating', g.r, 'count', coalesce(c.cnt, 0))
        order by g.r desc
      )
      from generate_series(1, 5) as g(r)
      left join (
        select rating, count(*) as cnt
        from public.reviews
        where product_id = v_product.id
          and status = 'ACTIVE'
        group by rating
      ) c on c.rating = g.r
    ),
    -- Whether the viewer may leave a review at all (any row, incl. HIDDEN, blocks it).
    'canReview', (
      not exists (
        select 1
        from public.reviews r
        where r.product_id = v_product.id
          and p_viewer_user_id is not null
          and r.buyer_user_id = p_viewer_user_id
      )
    ),
    -- The viewer's own ACTIVE review (for display/delete), if any.
    'viewerReview', (
      select jsonb_build_object(
        'id', r.id,
        'rating', r.rating,
        'text', r.text,
        'createdAt', r.created_at
      )
      from public.reviews r
      where r.product_id = v_product.id
        and r.status = 'ACTIVE'
        and p_viewer_user_id is not null
        and r.buyer_user_id = p_viewer_user_id
      order by r.created_at desc
      limit 1
    ),
    -- ACTIVE reviews, newest first; author name only (no username link), plus replies.
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
        where r.product_id = v_product.id
          and r.status = 'ACTIVE'
        order by r.created_at desc
        limit 50
      ) rr
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.storefront_product_reviews_read(text, uuid, uuid) to public;
