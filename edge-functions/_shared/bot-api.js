// bot-api.js — единая обвязка Telegram Bot API для webhook-функций ботов.
//
// Оба бота работают как webhook edge-функции: Telegram присылает update, ответ
// должен быть быстрым (200 {"ok":true}), а сообщения уходят обратно через Bot API.
// Здесь живёт общий код: выбор токена (BUYER_BOT_TOKEN / SELLER_BOT_TOKEN),
// вызовы методов, HTML-escape и проверка секрета вебхука.
//
// Все методы никогда не бросают: ошибка → null + console.error (доставка
// сообщения не должна ронять обработку update).

import { env } from './env.js';
import { pickToken } from './telegram.js';
import { timingSafeEqual } from './auth.js';

/** Вызов метода Bot API. `bot`: 'buyer' | 'seller'. */
export async function tg(bot, method, payload) {
  const token = pickToken(bot);
  if (!token) {
    console.error(`[bot:${bot}] missing token, skip ${method}`);
    return null;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => null);
    if (!data?.ok) {
      console.error(`[bot:${bot}] ${method} failed:`, JSON.stringify(data));
      return null;
    }
    return data.result ?? true;
  } catch (e) {
    console.error(`[bot:${bot}] ${method} error:`, e);
    return null;
  }
}

export const sendMessage = (bot, chatId, text, replyMarkup) =>
  tg(bot, 'sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });

export const editMessage = (bot, chatId, messageId, text, replyMarkup) =>
  tg(bot, 'editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });

export const answerCallback = (bot, callbackId, text) =>
  tg(bot, 'answerCallbackQuery', {
    callback_query_id: callbackId,
    ...(text ? { text: String(text).slice(0, 190) } : {}),
  });

/**
 * Показать экран: попытка editMessageText, при неудаче (например, ограничение
 * Telegram на смену типа кнопок) — удалить старое и отправить новое сообщение.
 */
export async function editOrSend(bot, chatId, messageId, text, replyMarkup) {
  if (messageId) {
    const edited = await editMessage(bot, chatId, messageId, text, replyMarkup);
    if (edited != null) return edited;
    await deleteMessage(bot, chatId, messageId);
  }
  return sendMessage(bot, chatId, text, replyMarkup);
}

export const deleteMessage = (bot, chatId, messageId) =>
  tg(bot, 'deleteMessage', { chat_id: chatId, message_id: messageId });

/** Обрезать текст кнопки меню (лимит Telegram — 64 символа). */
function truncate(text, max) {
  const s = String(text ?? '').trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/**
 * Кнопка-меню чата бота покупателя → последняя открытая витрина.
 * `chatId`: чат пользователя; без chatId нельзя (нужен per-chat override).
 * Best-effort: чат может ещё не существовать — просто логируем.
 */
export async function setStoreMenuButton(chatId, storeName, publicId) {
  const appUrl = env('APP_URL').replace(/\/$/, '');
  if (!appUrl || !chatId || !publicId) return false;
  const text = storeName ? `🛍️ ${truncate(storeName, 24)}` : '🛍️ Витрина';
  return (await tg('buyer', 'setChatMenuButton', {
    chat_id: chatId,
    menu_button: {
      type: 'web_app',
      text,
      web_app: { url: `${appUrl}?startapp=shop_${publicId}` },
    },
  })) != null;
}

/**
 * Проверка секрета вебхука (X-Telegram-Bot-Api-Secret-Token).
 * Если TELEGRAM_WEBHOOK_SECRET не задан — проверка выключена (dev).
 * `true` — запрос можно обрабатывать.
 */
export function webhookAuthorized(request) {
  const secret = env('TELEGRAM_WEBHOOK_SECRET');
  if (!secret) return true;
  const got = request.headers.get('X-Telegram-Bot-Api-Secret-Token') || '';
  return timingSafeEqual(secret, got);
}

/** HTML-escape пользовательских строк (названия магазинов и т.п.). */
export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
