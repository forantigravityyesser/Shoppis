// process-checkout.js — серверное оформление заказа (InsForge edge-функция).
//
// Вызывается фронтом витрины ПОКУПАТЕЛЯ (CartView → store.createOrder):
//   insforge.functions.invoke('process-checkout', { body: {...} })
//
// Request body:
//   {
//     items: [{ id, quantity, variantId? }],
//     promoCode?: string,
//     recipientInfo: { name, phone, email },
//     telegramId: string,
//     storeId: string,
//     username?: string
//   }
//
// Шаги: валидация магазина → валидация товаров → subtotal → промокод →
// upsert customers(store_id, telegram_id) → insert orders → insert order_items →
// уведомления через telegram-notify (buyer: заказ принят, seller: новый заказ).
// Уведомления — best-effort: заказ уже создан, ошибка отправки не роняет ответ.
//
// Env:
//   INSFORGE_BASE_URL, ANON_KEY — доступ к БД (обязательны)
//   TELEGRAM_NOTIFY_URL — URL функции telegram-notify (опционально; если нет —
//     шлём напрямую через Bot API по токенам ниже)
//   BUYER_BOT_TOKEN, SELLER_BOT_TOKEN (fallback BOT_TOKEN), APP_URL — для уведомлений

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

function dbHeaders(anonKey, extra = {}) {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

function apiBase(baseUrl) {
  return baseUrl.replace(/\/$/, '');
}

// --- Уведомления: сначала через telegram-notify, иначе напрямую в Bot API ---
async function notifyViaHelper(notifyUrl, payload) {
  if (!notifyUrl) return false;
  try {
    const res = await fetch(notifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    // helper всегда отвечает 200 с {success}; даже success:false — считаем попыткой
    return res.ok;
  } catch (e) {
    console.error('[checkout] notify helper error:', e);
    return false;
  }
}

async function notifyDirect(bot, chatId, text, storeId) {
  const token =
    bot === 'seller'
      ? env('SELLER_BOT_TOKEN') || env('BOT_TOKEN')
      : env('BUYER_BOT_TOKEN') || env('BOT_TOKEN');
  if (!token || !chatId) return;
  const appUrl = (env('APP_URL') || '').replace(/\/$/, '');
  let reply_markup;
  if (storeId && appUrl) {
    // Покупателю — кнопка в его витрину (прямой Mini App линк через startapp).
    // Продавцу — кнопка в его панель (?startapp=seller).
    const url =
      bot === 'seller' ? `${appUrl}?startapp=seller` : `${appUrl}?startapp=store_${storeId}`;
    reply_markup = { inline_keyboard: [[{ text: bot === 'seller' ? '🏪 Открыть панель' : '🛍️ Открыть витрину', web_app: { url } }]] };
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
    console.error(`[checkout] direct notify (${bot}) error:`, e);
  }
}

async function notifyOrderCreated({ orderId, total, symbol, buyerChatId, sellerChatId, storeId }) {
  const notifyUrl = env('TELEGRAM_NOTIFY_URL');
  const buyerText =
    `🧾 <b>Заказ принят!</b>\n\nНомер: <code>${String(orderId).slice(0, 8)}</code>\n` +
    `Сумма: <b>${total} ${symbol}</b>\nСтатус: Подготовка\n\nМы пришлём сюда смену статуса.`;
  const sellerText =
    `🔔 <b>Новый заказ!</b>\n\nНомер: <code>${String(orderId).slice(0, 8)}</code>\n` +
    `Сумма: <b>${total} ${symbol}</b>\n\nОткройте панель продавца для обработки.`;

  // 1) Покупатель — в БОТ ПОКУПАТЕЛЯ (сюда же придут статусы/акции после requestWriteAccess).
  const buyerPayload = { bot: 'buyer', chatId: String(buyerChatId), text: buyerText, storeId };
  if (!(await notifyViaHelper(notifyUrl, buyerPayload))) {
    await notifyDirect('buyer', String(buyerChatId), buyerText, storeId);
  }
  // 2) Продавец — в БОТ ПРОДАВЦА.
  if (sellerChatId) {
    const sellerPayload = { bot: 'seller', chatId: String(sellerChatId), text: sellerText, storeId };
    if (!(await notifyViaHelper(notifyUrl, sellerPayload))) {
      await notifyDirect('seller', String(sellerChatId), sellerText, storeId);
    }
  }
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ success: false, error: 'Use POST' }), {
        status: 405,
        headers: JSON_HEADERS,
      });
    }

    const baseUrl = env('INSFORGE_BASE_URL');
    const anonKey = env('ANON_KEY');
    if (!baseUrl || !anonKey) {
      return new Response(JSON.stringify({ success: false, error: 'Backend is not configured' }), {
        status: 500,
        headers: JSON_HEADERS,
      });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ success: false, error: 'Invalid JSON payload' }), {
        status: 400,
        headers: JSON_HEADERS,
      });
    }

    const { items, promoCode, recipientInfo, telegramId, storeId, username } = body || {};
    if (!storeId || !telegramId) {
      return new Response(
        JSON.stringify({ success: false, error: 'storeId and telegramId are required' }),
        { status: 400, headers: JSON_HEADERS }
      );
    }
    if (!Array.isArray(items) || !items.length) {
      return new Response(JSON.stringify({ success: false, error: 'Cart is empty' }), {
        status: 400,
        headers: JSON_HEADERS,
      });
    }
    const name = (recipientInfo?.name || '').trim();
    const phone = (recipientInfo?.phone || '').trim();
    const address = (recipientInfo?.email || '').trim();
    if (!name || !phone || !address) {
      return new Response(
        JSON.stringify({ success: false, error: 'Recipient name, phone and address are required' }),
        { status: 400, headers: JSON_HEADERS }
      );
    }

    try {
      const base = apiBase(baseUrl);
      const H = dbHeaders(anonKey);

      // 1. Магазин (нужен owner для уведомления продавца + валюта + простые промокоды).
      const storeRes = await fetch(
        `${base}/api/database/stores?id=eq.${encodeURIComponent(storeId)}&select=id,owner_telegram_id,currency_symbol,simple_promocodes`,
        { headers: H }
      );
      if (!storeRes.ok) {
        return new Response(
          JSON.stringify({ success: false, error: 'Store not found or inaccessible' }),
          { status: 404, headers: JSON_HEADERS }
        );
      }
      const storeJson = await storeRes.json();
      const storeRows = Array.isArray(storeJson) ? storeJson : (storeJson?.data ?? []);
      const store = storeRows[0];
      if (!store) {
        return new Response(
          JSON.stringify({ success: false, error: 'Store not found or inaccessible' }),
          { status: 404, headers: JSON_HEADERS }
        );
      }
      const symbol = store.currency_symbol || '';
      const ownerTelegramId = store.owner_telegram_id || '';

      // 2. Товары витрины — цены берём ТОЛЬКО с сервера.
      const itemIds = [...new Set(items.map((i) => i?.id).filter(Boolean))];
      const prodRes = await fetch(
        `${base}/api/database/products?store_id=eq.${encodeURIComponent(storeId)}&id=in.(${itemIds.map(encodeURIComponent).join(',')})&select=id,price`,
        { headers: H }
      );
      if (!prodRes.ok) {
        return new Response(JSON.stringify({ success: false, error: 'Failed to validate products' }), {
          status: 500,
          headers: JSON_HEADERS,
        });
      }
      const prodJson = await prodRes.json();
      const prodRows = Array.isArray(prodJson) ? prodJson : (prodJson?.data ?? []);
      const priceById = new Map(prodRows.map((p) => [p.id, Number(p.price)]));
      for (const it of items) {
        if (!priceById.has(it.id)) {
          return new Response(
            JSON.stringify({ success: false, error: `Product ${it.id} not found in store inventory` }),
            { status: 400, headers: JSON_HEADERS }
          );
        }
        if (!Number.isInteger(it.quantity) || it.quantity < 1 || it.quantity > 99) {
          return new Response(JSON.stringify({ success: false, error: 'Invalid quantity' }), {
            status: 400,
            headers: JSON_HEADERS,
          });
        }
      }
      const subtotal = items.reduce((s, it) => s + priceById.get(it.id) * it.quantity, 0);

      // 3. Промокод: сначала таблица promo_codes, затем simple_promocodes витрины.
      let discount = 0;
      let promoCodeId = null;
      const code = (promoCode || '').trim();
      if (code) {
        const promoRes = await fetch(
          `${base}/api/database/promo_codes?store_id=eq.${encodeURIComponent(storeId)}&code=eq.${encodeURIComponent(code)}&select=id,discount_percent,discount_fixed,is_active,usage_limit,used_count`,
          { headers: H }
        );
        if (promoRes.ok) {
          const pj = await promoRes.json();
          const prows = Array.isArray(pj) ? pj : (pj?.data ?? []);
          const promo = prows.find((p) => p.is_active !== false);
          if (promo) {
            if (promo.usage_limit != null && Number(promo.used_count || 0) >= Number(promo.usage_limit)) {
              return new Response(JSON.stringify({ success: false, error: 'Promo code limit exceeded' }), {
                status: 400,
                headers: JSON_HEADERS,
              });
            }
            if (promo.discount_percent != null) discount = (subtotal * Number(promo.discount_percent)) / 100;
            else if (promo.discount_fixed != null) discount = Number(promo.discount_fixed);
            promoCodeId = promo.id;
          }
        }
        if (!promoCodeId) {
          const simple = Array.isArray(store.simple_promocodes) ? store.simple_promocodes : [];
          const found = simple.find(
            (p) => String(p?.code || '').toUpperCase() === code.toUpperCase()
          );
          if (found) {
            discount = (subtotal * Number(found.discount_percent || 0)) / 100;
          } else if (!discount) {
            return new Response(JSON.stringify({ success: false, error: 'Invalid promo code' }), {
              status: 400,
              headers: JSON_HEADERS,
            });
          }
        }
      }
      discount = Math.min(Math.max(discount, 0), subtotal);
      const total = Math.round((subtotal - discount) * 100) / 100;

      // 4. Upsert покупателя (строка = привязка к витрине для /myshops бота покупателя).
      const upsertRes = await fetch(
        `${base}/api/database/customers?on_conflict=store_id,telegram_id`,
        {
          method: 'POST',
          headers: dbHeaders(anonKey, { Prefer: 'resolution=merge-duplicates,return=representation' }),
          body: JSON.stringify({
            store_id: storeId,
            telegram_id: String(telegramId),
            username: username || 'User',
            name,
            phone,
            email: address,
          }),
        }
      );
      if (!upsertRes.ok) {
        console.error('[checkout] customer upsert failed:', await upsertRes.text());
        return new Response(JSON.stringify({ success: false, error: 'Customer identification failed' }), {
          status: 500,
          headers: JSON_HEADERS,
        });
      }
      const upJson = await upsertRes.json();
      const upRows = Array.isArray(upJson) ? upJson : (upJson?.data ?? []);
      const customer = upRows[0];
      if (!customer?.id) {
        return new Response(JSON.stringify({ success: false, error: 'Customer identification failed' }), {
          status: 500,
          headers: JSON_HEADERS,
        });
      }

      // 5. Заказ.
      const orderRes = await fetch(`${base}/api/database/orders`, {
        method: 'POST',
        headers: dbHeaders(anonKey, { Prefer: 'return=representation' }),
        body: JSON.stringify({
          store_id: storeId,
          customer_id: customer.id,
          subtotal,
          total,
          discount_applied: discount,
          promo_code_id: promoCodeId,
          recipient_name: name,
          recipient_phone: phone,
          recipient_address: address,
          status: 'pending',
        }),
      });
      if (!orderRes.ok) {
        console.error('[checkout] order insert failed:', await orderRes.text());
        return new Response(JSON.stringify({ success: false, error: 'Order placement failed' }), {
          status: 500,
          headers: JSON_HEADERS,
        });
      }
      const orderJson = await orderRes.json();
      const orderRows = Array.isArray(orderJson) ? orderJson : (orderJson?.data ?? []);
      const order = orderRows[0];
      if (!order?.id) {
        return new Response(JSON.stringify({ success: false, error: 'Order placement failed' }), {
          status: 500,
          headers: JSON_HEADERS,
        });
      }

      // 6. Позиции заказа.
      const orderItems = items.map((it) => ({
        order_id: order.id,
        product_id: it.id,
        product_variant_id: it.variantId || null,
        quantity: it.quantity,
        unit_price: priceById.get(it.id),
      }));
      const itemsRes = await fetch(`${base}/api/database/order_items`, {
        method: 'POST',
        headers: dbHeaders(anonKey, { Prefer: 'return=minimal' }),
        body: JSON.stringify(orderItems),
      });
      if (!itemsRes.ok) {
        console.error('[checkout] order_items insert failed:', await itemsRes.text());
        return new Response(
          JSON.stringify({ success: false, error: `Failed to save items for order ${order.id}` }),
          { status: 500, headers: JSON_HEADERS }
        );
      }

      // 7. Счётчик промокода (best-effort).
      if (promoCodeId) {
        try {
          const cur = await fetch(
            `${base}/api/database/promo_codes?id=eq.${encodeURIComponent(promoCodeId)}&select=used_count`,
            { headers: H }
          );
          if (cur.ok) {
            const cj = await cur.json();
            const rows = Array.isArray(cj) ? cj : (cj?.data ?? []);
            const used = Number(rows[0]?.used_count || 0) + 1;
            await fetch(`${base}/api/database/promo_codes?id=eq.${encodeURIComponent(promoCodeId)}`, {
              method: 'PATCH',
              headers: dbHeaders(anonKey, { Prefer: 'return=minimal' }),
              body: JSON.stringify({ used_count: used }),
            });
          }
        } catch (e) {
          console.error('[checkout] promo used_count error:', e);
        }
      }

      // 8. Уведомления двум ботам (fire-and-forget, ответ не блокируем надолго).
      // Покупателю — бот покупателя; продавцу — бот продавца.
      notifyOrderCreated({
        orderId: order.id,
        total,
        symbol,
        buyerChatId: telegramId,
        sellerChatId: ownerTelegramId,
        storeId,
      }).catch((e) => console.error('[checkout] notify error:', e));

      return new Response(
        JSON.stringify({ success: true, orderId: order.id, total, message: 'Заказ успешно оформлен' }),
        { headers: JSON_HEADERS }
      );
    } catch (e) {
      console.error('[checkout] error:', e);
      return new Response(JSON.stringify({ success: false, error: 'Internal error' }), {
        status: 500,
        headers: JSON_HEADERS,
      });
    }
  },
};
