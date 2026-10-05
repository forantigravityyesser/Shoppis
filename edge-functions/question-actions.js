// question-actions.js — серверный диспетчер записи вопросов/ответов.
//
// POST body:
//   { action: 'question-create' | 'question-hide' | 'question-answer', ...payload }
// Header: Authorization: Bearer <session token from telegram-auth>
//
// Авторизация: сессия → actor_user_id берётся ТОЛЬКО из неё (никогда из
// клиента). Вся логика — атомарно в PL/pgSQL (migrations/0020_question_write.sql):
// покупатель задаёт 1 вопрос на товар и удаляет свой; продавец (владелец
// магазина) отвечает 1 раз на любой вопрос и удаляет любой вопрос своего товара;
// отвечать покупатель не может.
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
  QUESTION_NOT_FOUND: 404,
  TEXT_REQUIRED: 400,
  TEXT_TOO_LONG: 400,
  ALREADY_ASKED: 409,
  DUPLICATE_ANSWER: 409,
  STORE_PAUSED: 409,
};

function dispatch(client, action, session, body) {
  switch (action) {
    case 'question-create':
      return client.database.rpc('question_create_atomic', {
        p_product_id: body.productId,
        p_actor_user_id: session.uid,
        p_text: body.text ?? '',
      });
    case 'question-hide':
      return client.database.rpc('question_hide_atomic', {
        p_question_id: body.questionId,
        p_actor_user_id: session.uid,
      });
    case 'question-answer':
      return client.database.rpc('question_answer_create_atomic', {
        p_question_id: body.questionId,
        p_actor_user_id: session.uid,
        p_text: body.text ?? '',
      });
    // Seller read (PD-H-01): owner-only projection, actor from session. Lets the
    // store owner read questions of ARCHIVED products without trusting a client id.
    case 'question-seller-read':
      return client.database.rpc('seller_product_questions_read', {
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
    if (error) return errorToResponse(ERROR_STATUS, error.message || error, 'Question action failed');
    result = Array.isArray(data) ? data[0] : data;
    // Read actions return the projection directly (no `success` envelope).
    const isRead = action === 'question-seller-read';
    if (!isRead && !result?.success) {
      return json({ success: false, error: 'Question action failed' }, 500);
    }
  } catch (e) {
    console.error('[question-actions] rpc error:', e);
    return errorToResponse(ERROR_STATUS, e?.message || e, 'Question action failed');
  }

  return json({ success: true, result });
}
