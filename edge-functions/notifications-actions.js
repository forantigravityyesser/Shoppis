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
// Env: INSFORGE_BASE_URL, ANON_KEY, SESSION_SECRET,
//      BUYER_BOT_TOKEN / SELLER_BOT_TOKEN (fallback BOT_TOKEN), APP_URL?

import { createClient } from 'npm:@insforge/sdk';
import { env } from './_shared/env.js';
import { bearerToken, json, methodNotAllowed, preflight, readJson } from './_shared/http.js';
import { verifySession } from './_shared/auth.js';
import { notify } from './_shared/telegram.js';

/** Досыл «Заказ принят» покупателю для уже созданного заказа (ownership-check). */
async function notifyOrderCreated(client, orderId, session) {
  const { data: order } = await client.database
    .from('orders')
    .select('public_order_number, total_minor, store_id, buyer_user_id')
    .eq('id', orderId)
    .maybeSingle();
  if (!order || order.buyer_user_id !== session.uid) return;

  let publicId = '';
  let symbol = '';
  if (order.store_id) {
    const { data: store } = await client.database
      .from('stores')
      .select('public_id, currency_symbol')
      .eq('id', order.store_id)
      .maybeSingle();
    publicId = store?.public_id ?? '';
    symbol = store?.currency_symbol ?? '';
  }

  const orderNumber = String(order.public_order_number || orderId).slice(0, 12);
  await notify({
    bot: 'buyer',
    chatId: session.tg,
    publicId,
    logPrefix: 'notifications-actions',
    text:
      `🧾 <b>Заказ принят!</b>\n\n` +
      `Номер: <code>${orderNumber}</code>\n` +
      `Сумма: <b>${order.total_minor} ${symbol}</b>\n` +
      `Статус: Новый`,
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
  if (action !== 'enable') return json({ success: false, error: 'UNKNOWN_ACTION' }, 400);
  const orderId = String(body?.orderId || '').trim() || null;

  const client = createClient({ baseUrl, anonKey });

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
