// review-actions.js — серверный диспетчер записи отзывов/ответов.
//
// POST body:
//   { action: 'review-create' | 'review-hide' | 'review-reply', ...payload }
// Header: Authorization: Bearer <session token from telegram-auth>
//
// Авторизация: сессия → actor_user_id берётся ТОЛЬКО из неё (никогда из
// клиента). Вся логика — атомарно в PL/pgSQL (migrations/0017_review_write.sql):
// одна оценка на покупателя/товар, скрытие своего отзыва или отзыва своего
// магазина, ответ 1 раз на отзыв (покупатель — на чужой, продавец — на любой).
//
// Env: INSFORGE_BASE_URL, ANON_KEY, SESSION_SECRET.

import { createClient } from 'npm:@insforge/sdk';
import { env } from './_shared/env.js';
import { bearerToken, json, methodNotAllowed, preflight, readJson } from './_shared/http.js';
import { verifySession } from './_shared/auth.js';
import { errorToResponse } from './_shared/errors.js';

const ERROR_STATUS = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  PRODUCT_NOT_FOUND: 404,
  STORE_NOT_FOUND: 404,
  REVIEW_NOT_FOUND: 404,
  INVALID_RATING: 400,
  TEXT_REQUIRED: 400,
  TEXT_TOO_LONG: 400,
  CANNOT_REPLY_OWN: 400,
  ALREADY_REVIEWED: 409,
  DUPLICATE_REPLY: 409,
  STORE_PAUSED: 409,
};

function dispatch(client, action, session, body) {
  switch (action) {
    case 'review-create':
      return client.database.rpc('review_create_atomic', {
        p_product_id: body.productId,
        p_actor_user_id: session.uid,
        p_rating: body.rating,
        p_text: body.text ?? '',
      });
    case 'review-hide':
      return client.database.rpc('review_hide_atomic', {
        p_review_id: body.reviewId,
        p_actor_user_id: session.uid,
      });
    case 'review-reply':
      return client.database.rpc('review_reply_create_atomic', {
        p_review_id: body.reviewId,
        p_actor_user_id: session.uid,
        p_text: body.text ?? '',
      });
    // Seller read (PD-H-01): owner-only projection, actor from session. Lets the
    // store owner read reviews of ARCHIVED products without trusting a client id.
    case 'review-seller-read':
      return client.database.rpc('seller_product_reviews_read', {
        p_product_id: body.productId,
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
    if (error) return errorToResponse(ERROR_STATUS, error.message || error, 'Review action failed');
    result = Array.isArray(data) ? data[0] : data;
    // Read actions return the projection directly (no `success` envelope).
    const isRead = action === 'review-seller-read';
    if (!isRead && !result?.success) {
      return json({ success: false, error: 'Review action failed' }, 500);
    }
  } catch (e) {
    console.error('[review-actions] rpc error:', e);
    return errorToResponse(ERROR_STATUS, e?.message || e, 'Review action failed');
  }

  return json({ success: true, result });
}
