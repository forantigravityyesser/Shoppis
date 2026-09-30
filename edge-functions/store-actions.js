// store-actions.js — единый серверный диспетчер мутаций настроек магазина.
//
// POST body:
//   { action: 'update-profile', storeId, patch: {...} }
//   { action: 'update-status', storeId, status: 'ACTIVE' | 'PAUSED' }
// Header: Authorization: Bearer <session token from telegram-auth>
//
// Авторизация: сессия + проверка владения магазином в БД (stores_assert_owner
// внутри atomic-функций). owner_user_id берётся из сессии и никогда из клиента.
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
  NAME_REQUIRED: 400,
  INVALID_CURRENCY: 400,
  INVALID_LANGUAGE: 400,
  INVALID_STATUS: 400,
  EMPTY_PATCH: 400,
};

function dispatch(client, action, session, body) {
  switch (action) {
    case 'update-profile':
      return client.database.rpc('store_update_profile_atomic', {
        p_store_id: body.storeId,
        p_actor_user_id: session.uid,
        p_patch: body.patch ?? {},
      });
    case 'update-status':
      return client.database.rpc('store_set_status_atomic', {
        p_store_id: body.storeId,
        p_actor_user_id: session.uid,
        p_status: body.status,
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

  let store;
  try {
    const client = createClient({ baseUrl, anonKey });
    const { data, error } = await dispatch(client, action, session, body);
    if (error) return errorToResponse(ERROR_STATUS, error.message || error, 'Store action failed');
    store = Array.isArray(data) ? data[0] : data;
    if (!store?.id) return json({ success: false, error: 'Store action failed' }, 500);
  } catch (e) {
    console.error('[store-actions] rpc error:', e);
    return errorToResponse(ERROR_STATUS, e?.message || e, 'Store action failed');
  }

  return json({ success: true, store });
}
