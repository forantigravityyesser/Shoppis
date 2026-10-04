-- 0018_review_seller_read.sql
-- Seller moderation: let the store owner read reviews of their own product even
-- when the product is ARCHIVED (the storefront hides archived products, so the
-- public viewer still gets null). Source: docs/14 §8 (PD-10c).
--
-- Re-creates storefront_product_reviews_read with an owner exception on the
-- product status check. Everything else is unchanged from 0016.

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

  -- Archived product is not public; only the store owner (seller) can read.
  if v_product.status <> 'ACTIVE'
     and (p_viewer_user_id is null or p_viewer_user_id <> v_store.owner_user_id) then
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
    'canReview', (
      not exists (
        select 1
        from public.reviews r
        where r.product_id = v_product.id
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
      where r.product_id = v_product.id
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
