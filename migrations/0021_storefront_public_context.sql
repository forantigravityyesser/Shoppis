-- 0021_storefront_public_context.sql
-- Buyer storefront: minimal public store context resolver.
-- Replaces buyer-side `stores.select('*')` resolution, which leaked owner_* and
-- private seller fields into the buyer application state. Source of truth: docs/15 §4.
--
-- Called via SDK: client.database.rpc('storefront_public_context_read', { p_store_ref }).
-- p_store_ref is the opaque public_id (canonical). Legacy links `store_<internalId>`
-- are resolved by internal id inside this function as a temporary compatibility path
-- (docs/15 §4.3); it is removed once external links migrate to shop_<public_id>.
--
-- security definer so it does not depend on table RLS (RLS is currently disabled).

create or replace function public.storefront_public_context_read(p_store_ref text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store public.stores;
begin
  if p_store_ref is null or btrim(p_store_ref) = '' then
    return null;
  end if;

  -- Canonical: opaque public_id.
  select * into v_store
  from public.stores
  where public_id = p_store_ref
  limit 1;

  -- Legacy compatibility: internal id from `store_<id>` links. Invalid uuid
  -- (a malformed public_id) is not an error for the caller.
  if not found then
    begin
      select * into v_store
      from public.stores
      where id = p_store_ref::uuid
      limit 1;
    exception
      when invalid_text_representation then
        return null;
    end;
  end if;

  if not found then
    return null;
  end if;

  -- Public projection only: no owner_user_id / owner_telegram_id / description /
  -- language / created_at. Empty strings are normalized to null.
  return jsonb_build_object(
    'id', v_store.id,
    'publicId', v_store.public_id,
    'name', v_store.name,
    'status', v_store.status,
    'supportHandle', nullif(v_store.support_handle, ''),
    'logoUrl', nullif(v_store.logo_url, '')
  );
end;
$$;

-- Public read (projection is the boundary).
grant execute on function public.storefront_public_context_read(text) to public;
