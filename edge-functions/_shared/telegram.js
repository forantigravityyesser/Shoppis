// telegram.js — единая отправка уведомлений (хелпер + fallback Bot API).

import { env } from './env.js';

export function pickToken(bot) {
  if (bot === 'seller') return env('SELLER_BOT_TOKEN') || env('BOT_TOKEN');
  return env('BUYER_BOT_TOKEN') || env('BOT_TOKEN');
}

/**
 * Inline-кнопка на витрину/панель.
 * Покупателю — Direct Mini App ссылка `t.me/<bot>/<app>?startapp=shop_<public_id>`
 * (тап открывает витрину напрямую). Продавцу — web_app панели.
 * Внутренний id наружу не отдаём: передаётся только `public_id`.
 */
export function storeReplyMarkup(bot, publicId) {
  const appUrl = (env('APP_URL') || '').replace(/\/$/, '');

  if (bot === 'seller') {
    if (!appUrl) return undefined;
    return {
      inline_keyboard: [
        [{ text: '🏪 Открыть панель', web_app: { url: `${appUrl}?startapp=seller` } }],
      ],
    };
  }

  const botUsername = String(env('BUYER_BOT_USERNAME') || 'BuyShoppis_bot')
    .trim()
    .replace(/^@/, '');
  const rawApp = String(env('BUYER_APP_SHORTNAME') || '')
    .trim()
    .replace(/^\/+/, '');
  // Short name BotFather: [a-z0-9_]{3,30}; невалидный env игнорируем.
  const appShortname = /^[a-z0-9_]{3,30}$/.test(rawApp) ? rawApp : 'shop';
  if (!publicId || !botUsername) return undefined;
  const base = `https://t.me/${botUsername}/${appShortname}`;
  return {
    inline_keyboard: [
      [
        {
          text: '🛍️ Открыть витрину',
          url: `${base}?startapp=shop_${publicId}`,
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
export async function notify({ bot = 'buyer', chatId, text, publicId, replyMarkup, logPrefix = 'notify' }) {
  if (!chatId || !text) return;
  const markup = replyMarkup ?? storeReplyMarkup(bot, publicId);

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
          publicId,
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
