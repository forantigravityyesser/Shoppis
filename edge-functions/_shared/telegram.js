// telegram.js — единая отправка уведомлений (хелпер + fallback Bot API).

import { env } from './env.js';

export function pickToken(bot) {
  if (bot === 'seller') return env('SELLER_BOT_TOKEN') || env('BOT_TOKEN');
  return env('BUYER_BOT_TOKEN') || env('BOT_TOKEN');
}

/** Inline web_app кнопка: продавцу — панель, покупателю — его витрина. */
export function storeReplyMarkup(bot, storeId) {
  const appUrl = (env('APP_URL') || '').replace(/\/$/, '');
  if (!storeId || !appUrl) return undefined;
  const url = bot === 'seller' ? `${appUrl}?startapp=seller` : `${appUrl}?startapp=store_${storeId}`;
  return {
    inline_keyboard: [
      [
        {
          text: bot === 'seller' ? '🏪 Открыть панель' : '🛍️ Открыть витрину',
          web_app: { url },
        },
      ],
    ],
  };
}

async function sendViaBotApi({ bot, chatId, text, replyMarkup, logPrefix }) {
  const token = pickToken(bot);
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
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      }),
    });
  } catch (e) {
    console.error(`[${logPrefix}:${bot}] direct notify error:`, e);
  }
}

/**
 * Отправить сообщение: сначала через сервис-хелпер TELEGRAM_NOTIFY_URL,
 * при недоступности/неуспехе — напрямую через Bot API. Никогда не бросает.
 */
export async function notify({ bot = 'buyer', chatId, text, storeId, replyMarkup, logPrefix = 'notify' }) {
  if (!chatId || !text) return;
  const markup = replyMarkup ?? storeReplyMarkup(bot, storeId);

  const notifyUrl = env('TELEGRAM_NOTIFY_URL');
  if (notifyUrl) {
    try {
      const res = await fetch(notifyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bot,
          chatId: String(chatId),
          text,
          storeId,
          ...(markup ? { replyMarkup: markup } : {}),
        }),
      });
      if (res.ok) return;
    } catch (e) {
      console.error(`[${logPrefix}] notify helper error:`, e);
    }
  }

  await sendViaBotApi({ bot, chatId, text, replyMarkup: markup, logPrefix });
}
