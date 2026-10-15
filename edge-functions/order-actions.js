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
// Env: INSFORGE_BASE_URL, API_KEY (admin), SESSION_SECRET,
//      BUYER_BOT_TOKEN / SELLER_BOT_TOKEN (fallback BOT_TOKEN), APP_URL?

import { env } from './_shared/env.js';
import { adminClient } from './_shared/clients.js';
import { bearerToken, json, methodNotAllowed, preflight, readJson } from './_shared/http.js';
import { verifySession } from './_shared/auth.js';
import { notify, storeReplyMarkup } from './_shared/telegram.js';
import { formatOrderNotification, resolveOrderNotifications } from './_shared/order-notify.js';
import { deliveryFromOrder, loadOrderNotificationData } from './_shared/order-context.js';
import { errorToResponse } from './_shared/errors.js';
import { validateOrderAction } from './_shared/validate.js';

const ERROR_STATUS = {
  ORDER_NOT_FOUND: 404,
  ORDER_TERMINAL: 409,
  FORBIDDEN: 403,
  CANCEL_NOT_ALLOWED: 409,
  INVALID_ACTOR: 400,
  TRANSITION_NOT_ALLOWED: 409,
  NOT_DELIVERED: 409,
  OUTCOME_ALREADY_RECORDED: 409,
  INVALID_OUTCOME: 400,
  REASON_REQUIRED: 400,
  INVALID_REFUSAL_REASON: 400,
  INVALID_QUANTITY: 400,
  VARIANT_NOT_FOUND: 404,
  INVENTORY_NOT_FOUND: 409,
  INSUFFICIENT_HELD: 409,
  INVENTORY_RESERVED_BY_ORDERS: 409,
  ORDER_VARIANT_MISMATCH: 400,
  ORDER_NOT_RECONCILABLE: 409,
  // Входная валидация (docs/24 §2.7 D1): детерминированный 400, не 500.
  UNKNOWN_ACTION: 400,
  INVALID_ORDER_ID: 400,
  INVALID_TO_STATUS: 400,
  INVALID_VARIANT_ID: 400,
};

function dispatch(client, action, actorType, session, body) {
  switch (action) {
    case 'cancel':
      return client.database.rpc('order_cancel', {
        p_order_id: body.orderId,
        p_actor_user_id: session.uid,
        p_actor_type: actorType,
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

/**
 * Уведомления по событию заказа (buyer и/или seller). Best-effort: резолвит
 * получателей по действию (`resolveOrderNotifications`), гейтит покупателя по
 * согласию (`notifications_enabled`), тянет номер/сумму/контакт и шлёт письма
 * (см. `_shared/order-notify`). Продавцу — владелец магазина (`owner_telegram_id`).
 */
async function notifyOrderEvents(client, { action, actorType, outcome, reason, orderId, result }) {
  const notifications = resolveOrderNotifications({
    action,
    actorType,
    outcome,
    status: result.status,
  });
  if (notifications.length === 0) return;

  // Данные заказа/магазина/позиций для письма (номер, сумма, контакт, состав, доставка).
  const { order: orderRow, store: storeRow, items } = await loadOrderNotificationData(
    client,
    orderId,
  );
  const publicId = storeRow?.public_id ?? '';
  const supportHandle = storeRow?.support_handle ?? '';
  const currencySymbol = orderRow?.currency_symbol_snapshot || storeRow?.currency_symbol || '';
  const delivery = deliveryFromOrder(orderRow);

  // Chat id покупателя — только при согласии (write access), резолвим один раз.
  let buyerChatId = null;
  if (notifications.some((n) => n.recipient === 'buyer') && result.buyerUserId) {
    try {
      const { data } = await client.database
        .from('telegram_identities')
        .select('telegram_user_id, notifications_enabled')
        .eq('user_id', result.buyerUserId)
        .limit(1);
      if (data?.[0]?.notifications_enabled === true) {
        buyerChatId = data[0].telegram_user_id ?? null;
      }
    } catch (e) {
      console.error('[order-actions] buyer identity lookup failed:', e);
    }
  }

  const targets = {
    buyer: { chatId: buyerChatId, contactHandle: supportHandle },
    seller: { chatId: storeRow?.owner_telegram_id ?? null, contactHandle: null },
  };

  for (const { recipient, event } of notifications) {
    const target = targets[recipient];
    if (!target?.chatId) continue;
    const message = formatOrderNotification({
      event,
      recipient,
      orderNumber: orderRow?.public_order_number || result.orderId,
      totalMinor: orderRow?.total_minor,
      currencySymbol,
      reasonCode: reason ?? null,
      contactHandle: target.contactHandle,
      items,
      delivery,
    });
    if (!message) continue;
    await notify({
      bot: recipient,
      chatId: target.chatId,
      replyMarkup: storeReplyMarkup(recipient, publicId, message.contact),
      logPrefix: 'order-actions',
      text: message.text,
    });
  }
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

  const validated = validateOrderAction(body);
  if (validated.error) return json({ success: false, error: validated.error }, 400);
  const action = validated.action;

  let result;
  try {
    const client = adminClient(baseUrl);
    const { data, error } = await dispatch(client, action, validated.actorType, session, body);
    if (error) return errorToResponse(ERROR_STATUS, error.message || error, 'Order action failed');
    result = Array.isArray(data) ? data[0] : data;
    if (!result?.success) return json({ success: false, error: 'Order action failed' }, 500);
  } catch (e) {
    console.error('[order-actions] rpc error:', e);
    return errorToResponse(ERROR_STATUS, e?.message || e, 'Order action failed');
  }

  // Уведомления по событию заказа (buyer и/или seller, best-effort).
  if (
    (action === 'transition' || action === 'delivery-outcome' || action === 'cancel') &&
    result.buyerUserId
  ) {
    try {
      // Admin-клиент: нужен `stores.owner_telegram_id` (server-only, вне public-грантов).
      const client = adminClient(baseUrl);
      await notifyOrderEvents(client, {
        action,
        actorType: validated.actorType,
        outcome: body.outcome,
        reason: body.reason,
        orderId: body.orderId,
        result,
      });
    } catch (e) {
      console.error('[order-actions] notify error:', e);
    }
  }

  // `buyerUserId` — server-only (нужен был для уведомления выше); клиенту его
  // не отдаём, чтобы не утекал идентификатор покупателя (docs/24 §3.1).
  let clientResult = result;
  if (result && typeof result === 'object') {
    clientResult = { ...result };
    delete clientResult.buyerUserId;
  }

  return json({ success: true, result: clientResult });
}
