// order-actions.js — единый серверный диспетчер действий с заказами и инвентарём.
//
// POST body:
//   { action: 'cancel' | 'transition' | 'delivery-outcome' | 'reconcile',
//     orderId?, actorType?: 'buyer'|'seller', toStatus?, outcome?, reason?,
//     variantId?, quantity? }
// Header: Authorization: Bearer <session token from telegram-auth>
//
// Авторизация: сессия + проверка на уровне БД (seller = владелец магазина,
// buyer = владелец заказа). Логика и инвентарь — атомарно в PL/pgSQL rpc.
//
// Env: INSFORGE_BASE_URL, ANON_KEY, SESSION_SECRET,
//      BUYER_BOT_TOKEN / SELLER_BOT_TOKEN (fallback BOT_TOKEN), APP_URL?

import { createClient } from 'npm:@insforge/sdk';
import { env } from './_shared/env.js';
import { bearerToken, json, methodNotAllowed, preflight, readJson } from './_shared/http.js';
import { verifySession } from './_shared/auth.js';
import { notify } from './_shared/telegram.js';
import { errorToResponse } from './_shared/errors.js';

const STATUS_RU = {
  NEW: 'Новый',
  IN_TRANSIT: 'В пути',
  DELIVERED: 'Доставлено',
  REFUSED: 'Отказ',
  CANCELLED: 'Отменён',
};

const ERROR_STATUS = {
  ORDER_NOT_FOUND: 404,
  ORDER_TERMINAL: 409,
  FORBIDDEN: 403,
  CANCEL_NOT_ALLOWED: 409,
  INVALID_ACTOR: 400,
  TRANSITION_NOT_ALLOWED: 409,
  NOT_DELIVERED: 409,
  INVALID_OUTCOME: 400,
  REASON_REQUIRED: 400,
  INVALID_QUANTITY: 400,
  VARIANT_NOT_FOUND: 404,
  INVENTORY_NOT_FOUND: 409,
  INSUFFICIENT_HELD: 409,
  INVENTORY_RESERVED_BY_ORDERS: 409,
  ORDER_NOT_FOUND: 404,
  ORDER_VARIANT_MISMATCH: 400,
  ORDER_NOT_RECONCILABLE: 409,
};

function dispatch(client, action, session, body) {
  switch (action) {
    case 'cancel':
      return client.database.rpc('order_cancel', {
        p_order_id: body.orderId,
        p_actor_user_id: session.uid,
        p_actor_type: body.actorType === 'buyer' ? 'buyer' : 'seller',
        p_reason: body.reason ?? null,
      });
    case 'transition':
      return client.database.rpc('order_transition', {
        p_order_id: body.orderId,
        p_actor_user_id: session.uid,
        p_to_status: body.toStatus,
        p_reason: body.reason ?? null,
      });
    case 'delivery-outcome':
      return client.database.rpc('order_delivery_outcome', {
        p_order_id: body.orderId,
        p_actor_user_id: session.uid,
        p_outcome: body.outcome,
        p_reason: body.reason ?? null,
      });
    case 'reconcile':
      return client.database.rpc('inventory_reconcile', {
        p_variant_id: body.variantId,
        p_actor_user_id: session.uid,
        p_quantity: Number(body.quantity),
        p_reason: body.reason ?? null,
        p_order_id: body.orderId ?? null,
      });
    default:
      return { data: null, error: { message: 'UNKNOWN_ACTION' } };
  }
}

async function notifyBuyerStatus(client, body, result) {
  const { data: ids } = await client.database
    .from('telegram_identities')
    .select('telegram_user_id, notifications_enabled')
    .eq('user_id', result.buyerUserId)
    .limit(1);
  // Без согласия (write access) бот покупателя написать не сможет — не шлём.
  if (ids?.[0]?.notifications_enabled !== true) return;
  const chatId = ids[0].telegram_user_id;
  if (!chatId) return;

  let orderNumber = result.orderId;
  let storeId = null;
  if (body.orderId) {
    const { data: orderRow } = await client.database
      .from('orders')
      .select('public_order_number, store_id')
      .eq('id', body.orderId)
      .maybeSingle();
    orderNumber = orderRow?.public_order_number ?? orderNumber;
    storeId = orderRow?.store_id ?? null;
  }

  // Кнопка «Открыть витрину» — по opaque public_id, не по внутреннему id.
  let publicId = '';
  if (storeId) {
    const { data: storeRow } = await client.database
      .from('stores')
      .select('public_id')
      .eq('id', storeId)
      .maybeSingle();
    publicId = storeRow?.public_id ?? '';
  }

  await notify({
    bot: 'buyer',
    chatId,
    publicId,
    logPrefix: 'order-actions',
    text:
      `📦 <b>Статус заказа изменился</b>\n\n` +
      `Номер: <code>${String(orderNumber).slice(0, 12)}</code>\nНовый статус: <b>${STATUS_RU[result.status] || result.status}</b>`,
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
  if (!action) return json({ success: false, error: 'action is required' }, 400);

  let result;
  try {
    const client = createClient({ baseUrl, anonKey });
    const { data, error } = await dispatch(client, action, session, body);
    if (error) return errorToResponse(ERROR_STATUS, error.message || error, 'Order action failed');
    result = Array.isArray(data) ? data[0] : data;
    if (!result?.success) return json({ success: false, error: 'Order action failed' }, 500);
  } catch (e) {
    console.error('[order-actions] rpc error:', e);
    return errorToResponse(ERROR_STATUS, e?.message || e, 'Order action failed');
  }

  // Уведомление покупателю о смене статуса (best-effort).
  if (
    (action === 'transition' || action === 'delivery-outcome' || action === 'cancel') &&
    result.buyerUserId
  ) {
    try {
      const client = createClient({ baseUrl, anonKey });
      await notifyBuyerStatus(client, body, result);
    } catch (e) {
      console.error('[order-actions] notify error:', e);
    }
  }

  return json({ success: true, result });
}
