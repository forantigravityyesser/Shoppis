// catalog-actions.js — единый серверный диспетчер мутаций каталога.
//
// POST body:
//   {
//     action: 'product-create' | 'product-update' | 'variant-create'
//           | 'product-status' | 'product-delete' | 'category-delete'
//           | 'product-link-add' | 'product-link-remove',
//     ...payload
//   }
// Header: Authorization: Bearer <session token from telegram-auth>
//
// Авторизация: сессия + проверка владения магазином на уровне БД
// (catalog_assert_store_owner внутри atomic-функций). Вся логика — атомарно
// в PL/pgSQL (migrations/0011_catalog_atomic.sql); actor_user_id берётся из
// сессии и никогда из клиента.
//
// Env: INSFORGE_BASE_URL, ANON_KEY, SESSION_SECRET.

import { createClient } from 'npm:@insforge/sdk';
import { env } from './_shared/env.js';
import { bearerToken, json, methodNotAllowed, preflight, readJson } from './_shared/http.js';
import { verifySession } from './_shared/auth.js';
import { errorToResponse } from './_shared/errors.js';

const ERROR_STATUS = {
  FORBIDDEN: 403,
  STORE_NOT_FOUND: 404,
  PRODUCT_NOT_FOUND: 404,
  CATEGORY_NOT_FOUND: 404,
  TITLE_REQUIRED: 400,
  INVALID_STATUS: 400,
  INVALID_QUANTITY: 400,
  SELF_LINK: 400,
  SAME_STORE_REQUIRED: 400,
  DUPLICATE_VARIANT: 409,
  NO_ACTIVE_VARIANT: 409,
  NOT_ARCHIVED: 409,
};

function dispatch(client, action, session, body) {
  switch (action) {
    case 'product-create':
      return client.database.rpc('product_create_atomic', {
        p_store_id: body.storeId,
        p_actor_user_id: session.uid,
        p_product: body.product ?? {},
        p_images: body.images ?? [],
        p_attributes: body.attributes ?? [],
        p_link_attributes: body.linkAttributes ?? [],
        p_variants: body.variants ?? [],
      });
    case 'product-update':
      return client.database.rpc('product_update_atomic', {
        p_product_id: body.productId,
        p_actor_user_id: session.uid,
        p_patch: body.patch ?? {},
      });
    case 'variant-create':
      return client.database.rpc('variant_create_atomic', {
        p_product_id: body.productId,
        p_actor_user_id: session.uid,
        p_variant: body.variant ?? {},
        p_base_original_amount_minor: body.baseOriginalAmountMinor ?? null,
        p_base_discount_percent: body.baseDiscountPercent ?? null,
      });
    case 'product-status':
      return client.database.rpc('product_set_status_atomic', {
        p_product_id: body.productId,
        p_actor_user_id: session.uid,
        p_status: body.status,
      });
    case 'product-delete':
      return client.database.rpc('product_delete_atomic', {
        p_product_id: body.productId,
        p_actor_user_id: session.uid,
      });
    case 'category-delete':
      return client.database.rpc('category_delete_atomic', {
        p_category_id: body.categoryId,
        p_actor_user_id: session.uid,
      });
    case 'product-link-add':
      return client.database.rpc('product_link_add_atomic', {
        p_product_id: body.productId,
        p_target_id: body.targetId,
        p_actor_user_id: session.uid,
      });
    case 'product-link-remove':
      return client.database.rpc('product_link_remove_atomic', {
        p_product_id: body.productId,
        p_target_id: body.targetId,
        p_actor_user_id: session.uid,
      });
    default:
      return { data: null, error: { message: 'UNKNOWN_ACTION' } };
  }
}

export default async function (request) {
  if (request.method === 'OPTIONS') return preflight();
  if (request.method !== 'POST') return methodNotAllowed();

  const baseUrl = env('INSFORGE_BASE_URL');
  const anonKey = env('ANON_KEY');
  const sessionSecret = env('SESSION_SECRET');
  if (!baseUrl || !anonKey || !sessionSecret) {
    return json({ success: false, error: 'Backend is not configured' }, 500);
  }

  const session = await verifySession(bearerToken(request), sessionSecret);
  if (!session) return json({ success: false, error: 'Unauthorized' }, 401);

  const body = await readJson(request);
  if (!body) return json({ success: false, error: 'Invalid JSON payload' }, 400);

  const action = String(body?.action || '');
  if (!action) return json({ success: false, error: 'action is required' }, 400);

  let result;
  try {
    const client = createClient({ baseUrl, anonKey });
    const { data, error } = await dispatch(client, action, session, body);
    if (error) return errorToResponse(ERROR_STATUS, error.message || error, 'Catalog action failed');
    result = Array.isArray(data) ? data[0] : data;
    if (!result?.success) return json({ success: false, error: 'Catalog action failed' }, 500);
  } catch (e) {
    console.error('[catalog-actions] rpc error:', e);
    return errorToResponse(ERROR_STATUS, e?.message || e, 'Catalog action failed');
  }

  return json({ success: true, result });
}
