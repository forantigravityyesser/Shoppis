// order-queries.js — единый серверный диспетчер чтения заказов (buyer/seller).
//
// POST body:
//   { action: 'list', scope: 'buyer'|'seller', storeRef, statusFilter?, cursor?, limit? }
//   { action: 'detail', scope: 'buyer'|'seller', orderId }
//   { action: 'sales', scope: 'seller', storeRef, group: 'earned'|'potential', cursor?, limit? }
// Header: Authorization: Bearer <session token from telegram-auth>
//
// Actor identity приходит ТОЛЬКО из проверенной сессии. `scope`/`storeRef` —
// requested context, не permission: авторизация выполняется в SQL
// (`order_list_read` / `order_detail_read` / `seller_sales_list_read`), несовпадение
// -> пустой результат/null. Эта функция ничего не пишет: command-path остаётся
// `order-actions`.
//
// `sales` — проекция заказов для вкладки «Продажи» (docs/25 SDB-02): та же форма
// OrderListItem, что у `list`; группы задаются исходом вручения (`earned` =
// RECEIVED, `potential` = IN_TRANSIT или DELIVERED без исхода).
//
// Env: INSFORGE_BASE_URL, API_KEY, SESSION_SECRET

import { env } from './_shared/env.js';
import { adminClient } from './_shared/clients.js';
import { bearerToken, json, methodNotAllowed, preflight, readJson } from './_shared/http.js';
import { verifySession } from './_shared/auth.js';
import { errorToResponse } from './_shared/errors.js';
import { isUuid, isValidCursor, parseEnum, parseLimit } from './_shared/validate.js';

const ERROR_STATUS = {
  INVALID_SCOPE: 400,
  INVALID_FILTER: 400,
  INVALID_GROUP: 400,
  INVALID_QUERY: 400,
  INVALID_ORDER_ID: 400,
  INVALID_LIMIT: 400,
  INVALID_CURSOR: 400,
};

const SCOPES = ['buyer', 'seller'];
const FILTERS = ['all', 'NEW', 'IN_TRANSIT', 'DELIVERED', 'history'];
const SALES_GROUPS = ['earned', 'potential'];

function dispatch(client, action, session, body, limit) {
  if (action === 'list') {
    return client.database.rpc('order_list_read', {
      p_actor_user_id: session.uid,
      p_scope: body.scope,
      p_store_ref: body.storeRef ?? null,
      p_status_filter: body.statusFilter ?? 'all',
      p_cursor: body.cursor ?? null,
      p_limit: limit,
    });
  }
  if (action === 'sales') {
    return client.database.rpc('seller_sales_list_read', {
      p_actor_user_id: session.uid,
      p_store_ref: body.storeRef ?? null,
      p_group: body.group,
      p_cursor: body.cursor ?? null,
      p_limit: limit,
    });
  }
  // detail
  return client.database.rpc('order_detail_read', {
    p_actor_user_id: session.uid,
    p_scope: body.scope,
    p_order_id: body.orderId,
  });
}

export default async function (request) {
  if (request.method === 'OPTIONS') return preflight();
  if (request.method !== 'POST') return methodNotAllowed();

  const baseUrl = env('INSFORGE_BASE_URL');
  const apiKey = env('API_KEY');
  const sessionSecret = env('SESSION_SECRET');
  if (!baseUrl || !apiKey || !sessionSecret) {
    return json({ success: false, error: 'Backend is not configured' }, 500);
  }

  const session = await verifySession(bearerToken(request), sessionSecret);
  if (!session) return json({ success: false, error: 'Unauthorized' }, 401);

  const body = await readJson(request);
  if (!body) return json({ success: false, error: 'Invalid JSON payload' }, 400);

  const action = String(body?.action || '');
  if (action !== 'list' && action !== 'detail' && action !== 'sales') {
    return json({ success: false, error: 'INVALID_QUERY' }, 400);
  }
  // scope: requested context, не permission (авторизация — в SQL).
  if (parseEnum(body?.scope, SCOPES) === null) {
    return json({ success: false, error: 'INVALID_SCOPE' }, 400);
  }

  // D1 (docs/24 §2.7): невалидные параметры → 400 с машинным кодом, не 500.
  let limit = 20;
  if (action === 'list') {
    if (body?.statusFilter != null && parseEnum(body.statusFilter, FILTERS) === null) {
      return json({ success: false, error: 'INVALID_FILTER' }, 400);
    }
    const parsedLimit = parseLimit(body?.limit);
    if (!parsedLimit.ok) return json({ success: false, error: 'INVALID_LIMIT' }, 400);
    limit = parsedLimit.value;
    if (!isValidCursor(body?.cursor)) {
      return json({ success: false, error: 'INVALID_CURSOR' }, 400);
    }
  } else if (action === 'sales') {
    if (parseEnum(body?.group, SALES_GROUPS) === null) {
      return json({ success: false, error: 'INVALID_GROUP' }, 400);
    }
    const parsedLimit = parseLimit(body?.limit);
    if (!parsedLimit.ok) return json({ success: false, error: 'INVALID_LIMIT' }, 400);
    limit = parsedLimit.value;
    if (!isValidCursor(body?.cursor)) {
      return json({ success: false, error: 'INVALID_CURSOR' }, 400);
    }
  } else if (!isUuid(body?.orderId)) {
    return json({ success: false, error: 'INVALID_ORDER_ID' }, 400);
  }

  try {
    const client = adminClient(baseUrl);
    const { data, error } = await dispatch(client, action, session, body, limit);
    if (error) return errorToResponse(ERROR_STATUS, error.message || error, 'Order query failed');
    const result = Array.isArray(data) ? data[0] : data;
    return json({ success: true, result: result ?? null });
  } catch (e) {
    console.error('[order-queries] rpc error:', e);
    return errorToResponse(ERROR_STATUS, e?.message || e, 'Order query failed');
  }
}
