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
// Env: INSFORGE_BASE_URL, ANON_KEY, SESSION_SECRET,
//      BUYER_BOT_TOKEN / SELLER_BOT_TOKEN (fallback BOT_TOKEN),
//      TELEGRAM_NOTIFY_URL? , APP_URL?

import { createClient } from 'npm:@insforge/sdk';

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

function env(name, fallback = '') {
  try {
    const v = typeof Deno !== 'undefined' ? Deno.env.get(name) : undefined;
    return v || fallback;
  } catch {
    return fallback;
  }
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: JSON_HEADERS });
}

const enc = (s) => new TextEncoder().encode(s);

function b64url(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str) {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function hmac(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw',
    typeof secret === 'string' ? enc(secret) : secret,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc(message));
  return new Uint8Array(sig);
}

async function verifySession(token, secret) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) return null;
  const expected = b64url(await hmac(secret, body));
  if (expected !== sig) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(body)));
    if (!payload?.uid || !payload?.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

const ERROR_STATUS = {
  EMPTY_CART: 400,
  INVALID_QUANTITY: 400,
  STORE_NOT_FOUND: 404,
  STORE_PAUSED: 409,
  VARIANT_NOT_FOUND: 404,
  FOREIGN_VARIANT: 400,
  PRODUCT_NOT_ACTIVE: 409,
  INVENTORY_NOT_FOUND: 409,
  INSUFFICIENT_STOCK: 409,
};

function rpcErrorToResponse(message) {
  const code = Object.keys(ERROR_STATUS).find((key) => String(message).includes(key));
  const status = code ? ERROR_STATUS[code] : 500;
  return json({ success: false, error: code || 'Order placement failed' }, status);
}

async function notify(bot, chatId, text, storeId) {
  if (!chatId) return;
  const appUrl = (env('APP_URL') || '').replace(/\/$/, '');
  let reply_markup;
  if (storeId && appUrl) {
    const url = bot === 'seller' ? `${appUrl}?startapp=seller` : `${appUrl}?startapp=store_${storeId}`;
    reply_markup = {
      inline_keyboard: [[{ text: bot === 'seller' ? '🏪 Открыть панель' : '🛍️ Открыть витрину', web_app: { url } }]],
    };
  }

  const notifyUrl = env('TELEGRAM_NOTIFY_URL');
  const payload = { bot, chatId: String(chatId), text, storeId, ...(reply_markup ? { replyMarkup: reply_markup } : {}) };
  if (notifyUrl) {
    try {
      const res = await fetch(notifyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) return;
    } catch (e) {
      console.error('[checkout] notify helper error:', e);
    }
  }

  const token =
    bot === 'seller'
      ? env('SELLER_BOT_TOKEN') || env('BOT_TOKEN')
      : env('BUYER_BOT_TOKEN') || env('BOT_TOKEN');
  if (!token) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        ...(reply_markup ? { reply_markup } : {}),
      }),
    });
  } catch (e) {
    console.error(`[checkout] direct notify (${bot}) error:`, e);
  }
}

export default async function (request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }
  if (request.method !== 'POST') return json({ success: false, error: 'Use POST' }, 405);

  const baseUrl = env('INSFORGE_BASE_URL');
  const anonKey = env('ANON_KEY');
  const sessionSecret = env('SESSION_SECRET');
  if (!baseUrl || !anonKey || !sessionSecret) {
    return json({ success: false, error: 'Backend is not configured' }, 500);
  }

  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const session = await verifySession(token, sessionSecret);
  if (!session) return json({ success: false, error: 'Unauthorized' }, 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, error: 'Invalid JSON payload' }, 400);
  }

  const storeId = String(body?.storeId || '');
  const idempotencyKey = String(body?.idempotencyKey || '');
  const items = Array.isArray(body?.items) ? body.items : [];
  const name = String(body?.recipient?.name || '').trim();
  const phone = String(body?.recipient?.phone || '').trim();
  const address = String(body?.recipient?.address || '').trim();

  if (!storeId) return json({ success: false, error: 'storeId is required' }, 400);
  if (!items.length) return json({ success: false, error: 'Cart is empty' }, 400);
  if (!name || !phone || !address) {
    return json({ success: false, error: 'Recipient name, phone and address are required' }, 400);
  }

  const rpcItems = items
    .map((it) => ({ variantId: String(it?.variantId || ''), quantity: Number(it?.quantity) }))
    .filter((it) => it.variantId && Number.isInteger(it.quantity) && it.quantity > 0);
  if (!rpcItems.length) return json({ success: false, error: 'Invalid cart items' }, 400);

  let result;
  try {
    const client = createClient({ baseUrl, anonKey });
    const { data, error } = await client.database.rpc('create_order_atomic', {
      p_store_id: storeId,
      p_buyer_user_id: session.uid,
      p_idempotency_key: idempotencyKey,
      p_full_name: name,
      p_phone: phone,
      p_address: address,
      p_telegram_username: null,
      p_items: rpcItems,
    });
    if (error) return rpcErrorToResponse(error.message || error);

    result = Array.isArray(data) ? data[0] : data;
    if (!result?.orderId) return json({ success: false, error: 'Order placement failed' }, 500);
  } catch (e) {
    console.error('[checkout] rpc error:', e);
    return rpcErrorToResponse(e?.message || e);
  }

  const symbol = result.currencySymbol || '';
  const orderNumber = String(result.orderNumber || result.orderId).slice(0, 12);
  notify(
    'buyer',
    session.tg,
    `🧾 <b>Заказ принят!</b>\n\nНомер: <code>${orderNumber}</code>\nСумма: <b>${result.totalMinor} ${symbol}</b>\nСтатус: Новый`,
    storeId,
  ).catch((e) => console.error('[checkout] buyer notify error:', e));

  if (result.sellerTelegramId) {
    notify(
      'seller',
      result.sellerTelegramId,
      `🔔 <b>Новый заказ!</b>\n\nНомер: <code>${orderNumber}</code>\nСумма: <b>${result.totalMinor} ${symbol}</b>`,
      storeId,
    ).catch((e) => console.error('[checkout] seller notify error:', e));
  }

  return json({
    success: true,
    orderId: result.orderId,
    orderNumber: result.orderNumber,
    subtotalMinor: result.subtotalMinor,
    totalMinor: result.totalMinor,
    currencyCode: result.currencyCode,
    idempotent: result.idempotent === true,
  });
}
