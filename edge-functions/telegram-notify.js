// telegram-notify.js — единый отправитель уведомлений для ОБОИХ ботов.
//
// Зачем: токены ботов не должны светиться на фронте. process-checkout
// (создание заказа) и смена статуса продавцом вызывают эту функцию
// сервер-сервер, а она шлёт сообщение нужным ботом через Bot API.
//
// POST body:
//   {
//     "bot": "buyer" | "seller",   // каким ботом отправить (default: buyer)
//     "chatId": "123456",          // telegram_id получателя (buyer или owner)
//     "text": "<b>...</b>",        // HTML-текст
//     "storeId": "uuid?",          // опционально: приложить кнопку web_app в витрину
//     "replyMarkup": {...}?        // опционально: своя клавиатура (приоритет выше кнопки витрины)
//   }
//
// Env: BUYER_BOT_TOKEN, SELLER_BOT_TOKEN (fallback BOT_TOKEN), APP_URL.
//
// Ответ: { success, bot, messageId } или { success:false, error }.
// Если пользователь не нажимал /start у бота или запретил сообщения —
// Telegram вернёт "bot was blocked" / "chat not found": это НЕ ошибка кода,
// функция вернёт success:false с текстом причины, заказ при этом уже создан.

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

function pickToken(bot) {
  if (bot === 'seller') return env('SELLER_BOT_TOKEN') || env('BOT_TOKEN');
  return env('BUYER_BOT_TOKEN') || env('BOT_TOKEN');
}

// Готовые тексты, чтобы process-checkout / фронт не дублировали вёрстку.
export const templates = {
  orderCreated: (orderId, total, symbol = '') =>
    `🧾 <b>Заказ принят!</b>\n\nНомер: <code>${orderId.slice(0, 8)}</code>\nСумма: <b>${total} ${symbol}</b>\nСтатус: Подготовка\n\nМы пришлём сюда смену статуса.`,
  statusChanged: (orderId, statusRu) =>
    `📦 <b>Статус заказа изменился</b>\n\nНомер: <code>${String(orderId).slice(0, 8)}</code>\nНовый статус: <b>${statusRu}</b>`,
  newOrderForSeller: (orderId, total, symbol = '') =>
    `🔔 <b>Новый заказ!</b>\n\nНомер: <code>${String(orderId).slice(0, 8)}</code>\nСумма: <b>${total} ${symbol}</b>\n\nОткройте панель продавца для обработки.`,
  promo: (storeName, code, discount) =>
    `🎁 <b>${storeName}</b>: акция!\n\nПромокод <code>${code}</code> — скидка ${discount}%`,
};

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: JSON_HEADERS });
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ success: false, error: 'Use POST' }), { status: 405, headers: JSON_HEADERS });
    }
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ success: false, error: 'Invalid JSON payload' }), { status: 400, headers: JSON_HEADERS });
    }

    const bot = body.bot === 'seller' ? 'seller' : 'buyer';
    const chatId = body.chatId || body.chat_id;
    if (!chatId) {
      return new Response(JSON.stringify({ success: false, error: 'chatId is required' }), { status: 400, headers: JSON_HEADERS });
    }
    if (!body.text) {
      return new Response(JSON.stringify({ success: false, error: 'text is required' }), { status: 400, headers: JSON_HEADERS });
    }

    const token = pickToken(bot);
    if (!token) {
      return new Response(JSON.stringify({ success: false, error: `Missing token for bot=${bot}` }), { status: 500, headers: JSON_HEADERS });
    }

    let replyMarkup = body.replyMarkup || body.reply_markup;
    if (!replyMarkup && body.storeId) {
      const appUrl = (env('APP_URL') || '').replace(/\/$/, '');
      if (appUrl) {
        // Покупателю — прямой вход в его витрину (Mini App линк через startapp).
        // Продавцу — вход в панель продавца (?startapp=seller), а не в чужую витрину.
        const webAppUrl =
          bot === 'seller' ? `${appUrl}?startapp=seller` : `${appUrl}?startapp=store_${body.storeId}`;
        replyMarkup = {
          inline_keyboard: [[{ text: bot === 'seller' ? '🏪 Открыть панель' : '🛍️ Открыть витрину', web_app: { url: webAppUrl } }]],
        };
      }
    }

    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: body.text,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
          ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!data.ok) {
        // Типично: пользователь не стартовал бота / заблокировал — заказ уже создан, просто фиксируем.
        console.error(`[notify:${bot}] send failed:`, JSON.stringify(data));
        return new Response(JSON.stringify({ success: false, error: data.description || 'Telegram send failed', bot }), { headers: JSON_HEADERS });
      }
      return new Response(JSON.stringify({ success: true, bot, messageId: data.result?.message_id }), { headers: JSON_HEADERS });
    } catch (e) {
      console.error(`[notify:${bot}] error:`, e);
      return new Response(JSON.stringify({ success: false, error: String(e?.message || e) }), { status: 500, headers: JSON_HEADERS });
    }
  },
};
