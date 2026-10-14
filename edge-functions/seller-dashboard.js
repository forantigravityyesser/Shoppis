// seller-dashboard.js — сводка главной продавца (docs/25 SDB-02).
//
// POST body:
//   { storeRef }
// Header: Authorization: Bearer <session token from telegram-auth>
//
// Actor identity приходит ТОЛЬКО из проверенной сессии. `storeRef` — requested
// context, не permission: авторизация выполняется в SQL (`seller_dashboard_read`),
// чужой/несуществующий магазин → `null`. Эта функция ничего не пишет.
//
// Env: INSFORGE_BASE_URL, API_KEY, SESSION_SECRET

import { env } from './_shared/env.js';
import { adminClient } from './_shared/clients.js';
import { bearerToken, json, methodNotAllowed, preflight, readJson } from './_shared/http.js';
import { verifySession } from './_shared/auth.js';

const MAX_STORE_REF_LENGTH = 200;

/** storeRef: непустая строка разумной длины (public_id или legacy uuid). */
function isValidStoreRef(value) {
  return (
    typeof value === 'string' && value.trim().length > 0 && value.length <= MAX_STORE_REF_LENGTH
  );
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
  // D1-конвенция (docs/24): невалидный вход → детерминированный 400 с машинным кодом.
  if (!isValidStoreRef(body?.storeRef)) {
    return json({ success: false, error: 'INVALID_STORE_REF' }, 400);
  }

  try {
    const client = adminClient(baseUrl);
    const { data, error } = await client.database.rpc('seller_dashboard_read', {
      p_actor_user_id: session.uid,
      p_store_ref: body.storeRef,
    });
    if (error) return json({ success: false, error: 'Dashboard query failed' }, 500);
    const result = Array.isArray(data) ? data[0] : data;
    return json({ success: true, result: result ?? null });
  } catch (e) {
    console.error('[seller-dashboard] rpc error:', e);
    return json({ success: false, error: 'Dashboard query failed' }, 500);
  }
}
