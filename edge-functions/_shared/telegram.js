// telegram.js — единая отправка уведомлений (хелпер + fallback Bot API).

import { env } from './env.js';

export function pickToken(bot) {
  if (bot === 'seller') return env('SELLER_BOT_TOKEN') || env('BOT_TOKEN');
  return env('BUYER_BOT_TOKEN') || env('BOT_TOKEN');
}

/**
 * База прямой ссылки на Mini App покупателя: `https://t.me/<bot>/<app>`
 * с нормализованным username бота и short name (fallback `shop`).
 */
function buyerBase(buyerUsername, appShortname) {
  const bot = String(buyerUsername || 'BuyShoppis_bot')
    .trim()
    .replace(/^@/, '');
  const raw = String(appShortname || '')
    .trim()
    .replace(/^\/+/, '');
  const app = /^[a-z0-9_]{3,30}$/.test(raw) ? raw : 'shop';
  return `https://t.me/${bot}/${app}`;
}

/**
 * Direct Mini App ссылка покупателя: `t.me/<bot>/<app>?startapp=shop_<publicId>`.
 * Тап открывает витрину НАПРЯМУЮ (без чата бота). Невалидные bot/app → fallback.
 * @param {string} buyerUsername username бота (с @ или без)
 * @param {string} appShortname короткое имя именованного Mini App из BotFather
 * @param {string} publicId opaque public_id магазина
 */
export function buyerDeepLink(buyerUsername, appShortname, publicId) {
  return `${buyerBase(buyerUsername, appShortname)}?startapp=shop_${publicId}`;
}

/**
 * Direct Mini App ссылка на конкретный товар:
 * `t.me/<bot>/<app>?startapp=prod_<publicId>_<productId>`. Тап открывает
 * карточку товара напрямую.
 */
export function buyerProductDeepLink(buyerUsername, appShortname, publicId, productId) {
  return `${buyerBase(buyerUsername, appShortname)}?startapp=prod_${publicId}_${productId}`;
}

/**
 * Inline-клавиатура на витрину/панель (+ опциональный контакт).
 * Покупателю — Direct Mini App ссылка `t.me/<bot>/<app>?startapp=shop_<public_id>`
 * (тап открывает витрину напрямую). Продавцу — web_app панели.
 * Внутренний id наружу не отдаём: передаётся только `public_id`.
 *
 * @param {'buyer'|'seller'} bot
 * @param {string} publicId
 * @param {{ label: string, url: string }|null} [contact] — вторая строка «написать …».
 * @returns {{ inline_keyboard: Array<Array<object>> }|undefined}
 */
export function storeReplyMarkup(bot, publicId, contact) {
  const appUrl = (env('APP_URL') || '').replace(/\/$/, '');
  const rows = [];

  if (bot === 'seller') {
    if (appUrl) {
      rows.push([{ text: '🏪 Открыть панель', web_app: { url: `${appUrl}?startapp=seller` } }]);
    }
  } else {
    const botUsername = String(env('BUYER_BOT_USERNAME') || 'BuyShoppis_bot')
      .trim()
      .replace(/^@/, '');
    const appShortname = env('BUYER_APP_SHORTNAME');
    if (publicId && botUsername) {
      rows.push([{ text: '🛍️ Открыть витрину', url: buyerDeepLink(botUsername, appShortname, publicId) }]);
    }
  }

  if (contact?.url && contact?.label) {
    rows.push([{ text: contact.label, url: contact.url }]);
  }

  return rows.length ? { inline_keyboard: rows } : undefined;
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
