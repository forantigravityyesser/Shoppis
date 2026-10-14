// store-visit.js — фиксация открытия витрины покупателем (из Mini App).
//
// POST body: { storeRef: string }   // public_id (канон) или legacy id магазина
// Header: Authorization: Bearer <session token from telegram-auth>
//
// Зачем: Direct Mini App ссылка не создаёт апдейт боту, поэтому «покупатель
// открыл витрину» надёжно фиксирует сам Mini App при старте. На этой таблице
// строятся «Список магазинов» покупателя и счётчик посетителей у продавца.
// Дополнительно best-effort обновляем per-chat кнопку-меню бота покупателя,
// чтобы она вела на последнюю открытую витрину.
//
// Env: INSFORGE_BASE_URL, API_KEY, SESSION_SECRET, APP_URL? (для меню-кнопки),
//      BUYER_BOT_TOKEN (для меню-кнопки).

import { env } from './_shared/env.js';
import { adminClient } from './_shared/clients.js';
import { bearerToken, json, methodNotAllowed, preflight, readJson } from './_shared/http.js';
import { verifySession } from './_shared/auth.js';
import { setStoreMenuButton } from './_shared/bot-api.js';

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

  const storeRef = String(body?.storeRef || '').trim();
  if (!storeRef) return json({ success: false, error: 'storeRef is required' }, 400);

  let visit;
  try {
    const client = adminClient(baseUrl);
    const { data, error } = await client.database.rpc('buyer_store_visit_upsert', {
      p_actor_user_id: session.uid,
      p_store_ref: storeRef,
    });
    if (error) throw error;
    visit = Array.isArray(data) ? data[0] : data;
  } catch (e) {
    console.error('[store-visit] rpc error:', e);
    return json({ success: false, error: 'Visit recording failed' }, 500);
  }

  if (!visit?.publicId) {
    return json({ success: false, error: 'STORE_NOT_FOUND' }, 404);
  }

  // Кнопка-меню чата — best-effort: чат может ещё не существовать.
  if (session.tg) {
    await setStoreMenuButton(session.tg, visit.name, visit.publicId);
  }

  return json({
    success: true,
    store: { publicId: visit.publicId, name: visit.name ?? '' },
  });
}
