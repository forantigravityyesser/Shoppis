// notifications-actions.js — opt-in Telegram-уведомлений покупателя + досыл заказа.
//
// POST body: { action: 'enable', orderId?: string }
// Header: Authorization: Bearer <session token from telegram-auth>
//
// Записывает notifications_enabled=true для текущего User (по session.uid).
// Запрос write-access делает клиент; сюда приходит только факт согласия.
// Если передан orderId, сервер дополнительно досылает «Заказ принят» покупателю:
// первый заказ создаётся до получения согласия, поэтому уведомление о нём нужно
// отправить уже ПОСЛЕ согласия (best-effort, вне транзакции заказа).
//
// Env: INSFORGE_BASE_URL, API_KEY (admin), SESSION_SECRET,
//      BUYER_BOT_TOKEN / SELLER_BOT_TOKEN (fallback BOT_TOKEN), APP_URL?

import { env } from './_shared/env.js';
import { adminClient } from './_shared/clients.js';
import { bearerToken, json, methodNotAllowed, preflight, readJson } from './_shared/http.js';
import { verifySession } from './_shared/auth.js';
import { notify, storeReplyMarkup } from './_shared/telegram.js';
import { formatOrderNotification } from './_shared/order-notify.js';
import { deliveryFromOrder, loadOrderNotificationData } from './_shared/order-context.js';

/** Досыл «Заказ оформлен» покупателю для уже созданного заказа (ownership-check). */
async function notifyOrderCreated(client, orderId, session) {
  const { order, store, items } = await loadOrderNotificationData(client, orderId);
  // Ownership-check: чужой заказ не досылаем.
  if (!order || order.buyer_user_id !== session.uid) return;

  const publicId = store?.public_id ?? '';
  const supportHandle = store?.support_handle ?? '';
  const symbol = order.currency_symbol_snapshot || store?.currency_symbol || '';

  const message = formatOrderNotification({
    event: 'ORDER_CREATED',
    recipient: 'buyer',
    orderNumber: order.public_order_number || orderId,
    totalMinor: order.total_minor,
    currencySymbol: symbol,
    contactHandle: supportHandle,
    items,
    delivery: deliveryFromOrder(order),
  });
  if (!message) return;

  await notify({
    bot: 'buyer',
    chatId: session.tg,
    replyMarkup: storeReplyMarkup('buyer', publicId, message.contact),
    logPrefix: 'notifications-actions',
    text: message.text,
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
  if (action !== 'enable') return json({ success: false, error: 'UNKNOWN_ACTION' }, 400);
  const orderId = String(body?.orderId || '').trim() || null;

  const client = adminClient(baseUrl);

  // Было ли согласие раньше: если да, `process-checkout` уже отправил «Заказ принят»
  // и повторный досыл здесь был бы дублем.
  let wasEnabled = false;
  try {
    const { data } = await client.database
      .from('telegram_identities')
      .select('notifications_enabled')
      .eq('user_id', session.uid)
      .limit(1);
    wasEnabled = data?.[0]?.notifications_enabled === true;
  } catch (e) {
    console.error('[notifications-actions] read flag failed:', e);
  }

  try {
    const { error } = await client.database
      .from('telegram_identities')
      .update({
        notifications_enabled: true,
        notifications_enabled_at: new Date().toISOString(),
      })
      .eq('user_id', session.uid);
    if (error) throw error;
  } catch (e) {
    console.error('[notifications-actions] error:', e);
    return json({ success: false, error: 'Notification update failed' }, 500);
  }

  // Согласие впервые записано — досылаем уведомление о только что созданном заказе.
  if (orderId && !wasEnabled) {
    try {
      await notifyOrderCreated(client, orderId, session);
    } catch (e) {
      console.error('[notifications-actions] follow-up notify failed:', e);
    }
  }

  return json({ success: true });
}
