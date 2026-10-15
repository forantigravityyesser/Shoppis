// buyer-stores.js — список посещённых витрин покупателя (вход без deep-link).
//
// POST `{}` + `Authorization: Bearer <session from telegram-auth>`.
//
// Зачем: главный Mini App бота покупателя («Open App») открывается без
// `startapp`, а WebView localStorage может не делиться между разными точками
// входа. Поэтому последнюю витрину клиент дополнительно спрашивает у сервера —
// тот же источник, что и «Список магазинов» бота (buyer_store_list_read).
//
// Env: INSFORGE_BASE_URL, API_KEY, SESSION_SECRET.

import { env } from './_shared/env.js';
import { adminClient } from './_shared/clients.js';
import { bearerToken, json, methodNotAllowed, preflight } from './_shared/http.js';
import { verifySession } from './_shared/auth.js';

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

  try {
    const client = adminClient(baseUrl);
    const { data, error } = await client.database.rpc('buyer_store_list_read', {
      p_actor_user_id: session.uid,
    });
    if (error) throw error;
    // RPC возвращает jsonb-массив; на случай иной обёртки принимаем и `{ value }`.
    const stores = Array.isArray(data) ? data : Array.isArray(data?.value) ? data.value : [];
    return json({ success: true, stores });
  } catch (e) {
    console.error('[buyer-stores] rpc error:', e);
    return json({ success: false, error: 'Store list failed' }, 500);
  }
}
