// order-queries.js — единый серверный диспетчер чтения заказов (buyer/seller).
//
// POST body:
//   { action: 'list', scope: 'buyer'|'seller', storeRef, statusFilter?, cursor?, limit? }
//   { action: 'detail', scope: 'buyer'|'seller', orderId }
// Header: Authorization: Bearer <session token from telegram-auth>
//
// Actor identity приходит ТОЛЬКО из проверенной сессии. `scope`/`storeRef` —
// requested context, не permission: авторизация выполняется в SQL
// (`order_list_read` / `order_detail_read`), несовпадение -> пустой результат/null.
// Эта функция ничего не пишет: command-path остаётся `order-actions`.
//
// Env: INSFORGE_BASE_URL, ANON_KEY, SESSION_SECRET

import { createClient } from 'npm:@insforge/sdk';
import { env } from './_shared/env.js';
import { bearerToken, json, methodNotAllowed, preflight, readJson } from './_shared/http.js';
import { verifySession } from './_shared/auth.js';
import { errorToResponse } from './_shared/errors.js';

const ERROR_STATUS = {
  INVALID_SCOPE: 400,
  INVALID_FILTER: 400,
  INVALID_QUERY: 400,
};

const SCOPES = new Set(['buyer', 'seller']);
const FILTERS = new Set(['all', 'NEW', 'IN_TRANSIT', 'DELIVERED', 'history']);

function dispatch(client, action, session, body) {
  if (action === 'list') {
    return client.database.rpc('order_list_read', {
      p_actor_user_id: session.uid,
      p_scope: body.scope,
      p_store_ref: body.storeRef ?? null,
      p_status_filter: body.statusFilter ?? 'all',
      p_cursor: body.cursor ?? null,
      p_limit: body.limit ?? 20,
    });
  }
  // detail
  return client.database.rpc('order_detail_read', {
    p_actor_user_id: session.uid,
    p_scope: body.scope,
    p_order_id: body.orderId ?? null,
  });
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
  if (action !== 'list' && action !== 'detail') {
    return json({ success: false, error: 'INVALID_QUERY' }, 400);
  }
  if (!SCOPES.has(String(body?.scope || ''))) {
    return json({ success: false, error: 'INVALID_SCOPE' }, 400);
  }
  if (action === 'list' && body?.statusFilter != null && !FILTERS.has(String(body.statusFilter))) {
    return json({ success: false, error: 'INVALID_FILTER' }, 400);
  }

  try {
    const client = createClient({ baseUrl, anonKey });
    const { data, error } = await dispatch(client, action, session, body);
    if (error) return errorToResponse(ERROR_STATUS, error.message || error, 'Order query failed');
    const result = Array.isArray(data) ? data[0] : data;
    return json({ success: true, result: result ?? null });
  } catch (e) {
    console.error('[order-queries] rpc error:', e);
    return errorToResponse(ERROR_STATUS, e?.message || e, 'Order query failed');
  }
}
