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

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

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

function errorToResponse(message) {
  const code = Object.keys(ERROR_STATUS).find((key) => String(message).includes(key));
  const status = code ? ERROR_STATUS[code] : 500;
  return json({ success: false, error: code || 'Order action failed' }, status);
}

async function notifyBuyer(chatId, orderNumber, statusRu, storeId) {
  if (!chatId) return;
  const bot = 'buyer';
  const token = env('BUYER_BOT_TOKEN') || env('BOT_TOKEN');
  if (!token) return;

  const appUrl = (env('APP_URL') || '').replace(/\/$/, '');
  let reply_markup;
  if (storeId && appUrl) {
    reply_markup = {
      inline_keyboard: [[{ text: '🛍️ Открыть витрину', web_app: { url: `${appUrl}?startapp=store_${storeId}` } }]],
    };
  }

  const text =
    `📦 <b>Статус заказа изменился</b>\n\n` +
    `Номер: <code>${String(orderNumber).slice(0, 12)}</code>\nНовый статус: <b>${statusRu}</b>`;

  const notifyUrl = env('TELEGRAM_NOTIFY_URL');
  if (notifyUrl) {
    try {
      const res = await fetch(notifyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bot, chatId: String(chatId), text, storeId, ...(reply_markup ? { replyMarkup: reply_markup } : {}) }),
      });
      if (res.ok) return;
    } catch (e) {
      console.error('[order-actions] notify helper error:', e);
    }
  }

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
    console.error('[order-actions] buyer notify error:', e);
  }
}

async function dispatch(client, action, session, body) {
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
      });
    default:
      return { data: null, error: { message: 'UNKNOWN_ACTION' } };
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

  const action = String(body?.action || '');
  if (!action) return json({ success: false, error: 'action is required' }, 400);

  let result;
  try {
    const client = createClient({ baseUrl, anonKey });
    const { data, error } = await dispatch(client, action, session, body);
    if (error) return errorToResponse(error.message || error);
    result = Array.isArray(data) ? data[0] : data;
    if (!result?.success) return json({ success: false, error: 'Order action failed' }, 500);
  } catch (e) {
    console.error('[order-actions] rpc error:', e);
    return errorToResponse(e?.message || e);
  }

  // Уведомление покупателю о смене статуса (best-effort).
  if ((action === 'transition' || action === 'delivery-outcome' || action === 'cancel') && result.buyerUserId) {
    try {
      const client = createClient({ baseUrl, anonKey });
      const { data: ids } = await client.database
        .from('telegram_identities')
        .select('telegram_user_id')
        .eq('user_id', result.buyerUserId)
        .limit(1);
      const chatId = ids?.[0]?.telegram_user_id;

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

      await notifyBuyer(chatId, orderNumber, STATUS_RU[result.status] || result.status, storeId);
    } catch (e) {
      console.error('[order-actions] notify error:', e);
    }
  }

  return json({ success: true, result });
}
