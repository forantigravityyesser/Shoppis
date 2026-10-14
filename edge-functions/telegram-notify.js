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
//     "publicId": "hex?",          // опционально: кнопка «Открыть витрину» (Direct Mini App)
//     "replyMarkup": {...}?        // опционально: своя клавиатура (приоритет выше кнопки витрины)
//   }
//
// Env: BUYER_BOT_TOKEN, SELLER_BOT_TOKEN (fallback BOT_TOKEN), APP_URL.
//
// Ответ: { success, bot, messageId } или { success:false, error }.
// Если пользователь не нажимал /start у бота или запретил сообщения —
// Telegram вернёт "bot was blocked" / "chat not found": это НЕ ошибка кода,
// функция вернёт success:false с текстом причины, заказ при этом уже создан.

import { json, methodNotAllowed, preflight, readJson } from './_shared/http.js';
import { pickToken, storeReplyMarkup } from './_shared/telegram.js';

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return preflight();
    if (request.method !== 'POST') return methodNotAllowed();

    const body = await readJson(request);
    if (!body) return json({ success: false, error: 'Invalid JSON payload' }, 400);

    const bot = body.bot === 'seller' ? 'seller' : 'buyer';
    const chatId = body.chatId || body.chat_id;
    if (!chatId) return json({ success: false, error: 'chatId is required' }, 400);
    if (!body.text) return json({ success: false, error: 'text is required' }, 400);

    const token = pickToken(bot);
    if (!token) return json({ success: false, error: `Missing token for bot=${bot}` }, 500);

    const replyMarkup =
      body.replyMarkup || body.reply_markup || storeReplyMarkup(bot, body.publicId);

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
        return json({ success: false, error: data.description || 'Telegram send failed', bot });
      }
      return json({ success: true, bot, messageId: data.result?.message_id });
    } catch (e) {
      console.error(`[notify:${bot}] error:`, e);
      return json({ success: false, error: String(e?.message || e) }, 500);
    }
  },
};
