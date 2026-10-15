// process-checkout.js — серверное оформление заказа (InsForge edge-функция).
//
// POST body:
//   {
//     storeId: string,
//     idempotencyKey: string,
//     items: [{ variantId, quantity }],
//     recipient: { name, phone, address }
//   }
// Header: Authorization: Bearer <session token from telegram-auth>
//
// Логика: проверить сессию → атомарный rpc('create_order_atomic')
// (идемпотентность, перепроверка цены/остатка, AVAILABLE->HELD, снапшоты, история)
// → уведомления (best-effort, вне транзакции).
//
// Env: INSFORGE_BASE_URL, API_KEY (admin), SESSION_SECRET,
//      BUYER_BOT_TOKEN / SELLER_BOT_TOKEN (fallback BOT_TOKEN),
//      TELEGRAM_NOTIFY_URL? , APP_URL?

import { env } from './_shared/env.js';
import { adminClient } from './_shared/clients.js';
import { bearerToken, json, methodNotAllowed, preflight, readJson } from './_shared/http.js';
import { verifySession } from './_shared/auth.js';
import { notify, storeReplyMarkup } from './_shared/telegram.js';
import { formatOrderNotification } from './_shared/order-notify.js';
import { loadOrderItems } from './_shared/order-context.js';
import { errorToResponse } from './_shared/errors.js';
import { validateCheckoutItems } from './_shared/checkout-items.js';
import { resolveCheckoutUsername } from './_shared/checkout-identity.js';
import { shouldNotifyCheckout } from './_shared/checkout-notify.js';

const ERROR_STATUS = {
  EMPTY_CART: 400,
  INVALID_CART_ITEM: 400,
  INVALID_QUANTITY: 400,
  VARIANT_DUPLICATE: 400,
  IDEMPOTENCY_KEY_REQUIRED: 400,
  STORE_NOT_FOUND: 404,
  STORE_PAUSED: 409,
  VARIANT_NOT_FOUND: 404,
  FOREIGN_VARIANT: 400,
  PRODUCT_NOT_ACTIVE: 409,
  INVENTORY_NOT_FOUND: 409,
  INSUFFICIENT_STOCK: 409,
  INVALID_PRICE: 400,
  INVALID_DISCOUNT: 400,
};

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

  const storeId = String(body?.storeId || '');
  const idempotencyKey = String(body?.idempotencyKey || '');
  const items = Array.isArray(body?.items) ? body.items : [];
  const name = String(body?.recipient?.name || '').trim();
  const phone = String(body?.recipient?.phone || '').trim();
  const address = String(body?.recipient?.address || '').trim();

  if (!storeId) return json({ success: false, error: 'storeId is required' }, 400);
  // Idempotency обязателен (docs/21 §3.1-3.2): без ключа нет защиты от дублей.
  if (!idempotencyKey) {
    return json({ success: false, error: 'IDEMPOTENCY_KEY_REQUIRED' }, 400);
  }
  if (!name || !phone || !address) {
    return json({ success: false, error: 'Recipient name, phone and address are required' }, 400);
  }

  // Позиции: 1..MAX_ITEM_QTY, без дублей вариантов (docs/21 §3.3). Сервер
  // авторитетен — не доверяем количеству/нормализации с клиента.
  const validated = validateCheckoutItems(items);
  if (validated.error) return json({ success: false, error: validated.error }, 400);
  const rpcItems = validated.items;

  // Серверный резолв Telegram username для immutable snapshot (ORD-02, docs/22):
  // клиент на него не влияет; отсутствие username/identity — допустимо (null),
  // checkout не падает.
  let telegramUsername = null;
  try {
    const client = adminClient(baseUrl);
    telegramUsername = await resolveCheckoutUsername(client, session.uid);
  } catch (e) {
    console.error('[checkout] username lookup failed:', e);
  }

  let result;
  try {
    const client = adminClient(baseUrl);
    const { data, error } = await client.database.rpc('create_order_atomic', {
      p_store_id: storeId,
      p_buyer_user_id: session.uid,
      p_idempotency_key: idempotencyKey,
      p_full_name: name,
      p_phone: phone,
      p_address: address,
      p_telegram_username: telegramUsername,
      p_items: rpcItems,
    });
    if (error) return errorToResponse(ERROR_STATUS, error.message || error, 'Order placement failed');

    result = Array.isArray(data) ? data[0] : data;
    if (!result?.orderId) return json({ success: false, error: 'Order placement failed' }, 500);
  } catch (e) {
    console.error('[checkout] rpc error:', e);
    return errorToResponse(ERROR_STATUS, e?.message || e, 'Order placement failed');
  }

  // Публичная кнопка «Открыть витрину» — по opaque public_id; контакт
  // «Написать продавцу» — по публичному `support_handle` магазина.
  let storePublicId = '';
  let storeSupportHandle = '';
  try {
    const client = adminClient(baseUrl);
    const { data: storeRow } = await client.database
      .from('stores')
      .select('public_id, support_handle')
      .eq('id', storeId)
      .maybeSingle();
    storePublicId = storeRow?.public_id ?? '';
    storeSupportHandle = storeRow?.support_handle ?? '';
  } catch (e) {
    console.error('[checkout] public_id lookup failed:', e);
  }

  // Уведомление покупателю — ТОЛЬКО при явном согласии (Telegram write access,
  // флаг notifications_enabled). Нет разрешения/бота — не отправляем (docs/18 §25-26).
  let buyerNotify = false;
  try {
    const client = adminClient(baseUrl);
    const { data: identity } = await client.database
      .from('telegram_identities')
      .select('notifications_enabled')
      .eq('user_id', session.uid)
      .maybeSingle();
    buyerNotify = identity?.notifications_enabled === true;
  } catch (e) {
    console.error('[checkout] notifications lookup failed:', e);
  }

  // Идемпотентный ретрай (docs/24 §2.7 D2 / ORD-HARDEN-07): заказ уже создан и
  // уведомления отправлены при первом вызове — повтор не должен дублировать их.
  const idempotent = result.idempotent === true;
  if (shouldNotifyCheckout(result)) {
    const orderNumber = result.orderNumber || result.orderId;
    // Состав заказа — снапшот order_items (для писем buyer и seller).
    let items = [];
    try {
      items = await loadOrderItems(adminClient(baseUrl), result.orderId);
    } catch (e) {
      console.error('[checkout] items lookup failed:', e);
    }
    const delivery = { fullName: name, phone, address };
    if (buyerNotify) {
      // Покупателю — публичный контакт магазина (`support_handle`).
      const message = formatOrderNotification({
        event: 'ORDER_CREATED',
        recipient: 'buyer',
        orderNumber,
        totalMinor: result.totalMinor,
        currencySymbol: result.currencySymbol,
        contactHandle: storeSupportHandle,
        items,
        delivery,
      });
      if (message) {
        notify({
          bot: 'buyer',
          chatId: session.tg,
          replyMarkup: storeReplyMarkup('buyer', storePublicId, message.contact),
          logPrefix: 'checkout',
          text: message.text,
        }).catch((e) => console.error('[checkout] buyer notify error:', e));
      }
    }

    if (result.sellerTelegramId) {
      // Продавцу — TG-снимок покупателя, если есть username (resolved выше).
      const message = formatOrderNotification({
        event: 'ORDER_CREATED',
        recipient: 'seller',
        orderNumber,
        totalMinor: result.totalMinor,
        currencySymbol: result.currencySymbol,
        itemCount: result.itemCount,
        contactHandle: telegramUsername,
        items,
      });
      if (message) {
        notify({
          bot: 'seller',
          chatId: result.sellerTelegramId,
          replyMarkup: storeReplyMarkup('seller', storePublicId, message.contact),
          logPrefix: 'checkout',
          text: message.text,
        }).catch((e) => console.error('[checkout] seller notify error:', e));
      }
    }
  }

  return json({
    success: true,
    orderId: result.orderId,
    orderNumber: result.orderNumber,
    subtotalMinor: result.subtotalMinor,
    totalMinor: result.totalMinor,
    currencyCode: result.currencyCode,
    idempotent,
  });
}
