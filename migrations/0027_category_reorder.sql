-- 0027_category_reorder.sql
-- Atomic seller-side reordering of catalog categories. The buyer-facing order of
-- categories (Home carousel, Catalog quick access, "All categories") is driven by
-- categories.sort_order (see storefront_home_context_read, migration 0023). This lets
-- the seller pick a 1-based position for a category; the whole active list is compacted
-- to 0..N-1 in a single transaction. Reuses the existing column — no schema change.
--
-- Ownership is verified via catalog_assert_store_owner (0011); the actor comes from the
-- server session in the catalog-actions dispatcher, never from the client.
-- Archived categories are excluded; they never participate in the order.
-- Source of truth: docs/17 §4 (CAT-07a).

create or replace function public.category_reorder_atomic(
  p_category_id uuid,
  p_position int,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store_id uuid;
  v_status text;
  v_ids uuid[];
  v_total int;
  v_position int;
  v_order jsonb;
begin
  select store_id, status
  into v_store_id, v_status
  from public.categories
  where id = p_category_id
  for update;

  if not found then
    raise exception 'CATEGORY_NOT_FOUND';
  end if;

  perform public.catalog_assert_store_owner(v_store_id, p_actor_user_id);

  -- Only ACTIVE categories are ordered; an archived target is not a valid reorder request.
  if v_status <> 'ACTIVE' then
    raise exception 'CATEGORY_NOT_FOUND';
  end if;

  -- Current order of ACTIVE categories of this store (deterministic tie-break).
  select array_agg(id order by sort_order asc, created_at asc, id asc)
  into v_ids
  from public.categories
  where store_id = v_store_id
    and status = 'ACTIVE';

  v_total := coalesce(array_length(v_ids, 1), 0);

  -- Remove the target, then insert it at the requested 1-based position (clamped).
  v_ids := array_remove(v_ids, p_category_id);
  v_position := least(greatest(coalesce(p_position, 1), 1), v_total);
  v_ids := v_ids[1:v_position - 1] || array[p_category_id] || v_ids[v_position:];

  -- Compact ranks to 0..N-1 for every ACTIVE category in one statement.
  update public.categories c
  set sort_order = t.idx,
      updated_at = now()
  from (
    select u.id, (u.ord - 1)::int as idx
    from unnest(v_ids) with ordinality as u(id, ord)
  ) t
  where c.id = t.id;

  select coalesce(
    jsonb_agg(jsonb_build_object('id', u.id, 'sortOrder', (u.ord - 1)::int) order by u.ord),
    '[]'::jsonb
  )
  into v_order
  from unnest(v_ids) with ordinality as u(id, ord);

  return jsonb_build_object(
    'success', true,
    'categoryId', p_category_id,
    'position', v_position,
    'order', v_order
  );
end;
$$;

grant execute on function public.category_reorder_atomic(uuid, int, uuid) to public;
