// share-message.js — сборка подготовленного inline-сообщения для шаринга товара.
//
// Чистые функции без сети: сервер (share-actions) готовит `InlineQueryResultPhoto`
// для Bot API `savePreparedInlineMessage`, а Mini App затем показывает нативный
// диалог Telegram (`shareMessage`). Пользователь отправляет карточку: фото +
// caption + inline-кнопка «Открыть товар». Текст — под parse_mode=HTML.

import { formatMoneyMinor } from './order-notify.js';

/** Экранирование HTML-спецсимволов в пользовательских данных (parse_mode=HTML). */
function htmlEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Лимит Telegram на caption фото-сообщения. */
export const CAPTION_MAX = 1024;

/** Одна строка «Характеристика: значение» (пустые пары отбрасываются). */
function attributeLine(attr) {
  const name = String(attr?.name ?? '').trim();
  const value = String(attr?.value ?? '').trim();
  return name && value ? `${htmlEscape(name)}: ${htmlEscape(value)}` : '';
}

/**
 * Красивый текст карточки (caption): название, описание, характеристики,
 * а внизу — цена и магазин. Цена/магазин всегда сохраняются: при нехватке места
 * (лимит 1024) обрезается верхняя часть, а не «подвал».
 * @param {{
 *   title?: string, description?: string,
 *   attributes?: Array<{ name?: string, value?: string }>,
 *   priceMinor?: number, currencySymbol?: string, storeName?: string
 * }} [input]
 * @returns {string}
 */
export function buildShareCaption({
  title,
  description,
  attributes,
  priceMinor,
  currencySymbol,
  storeName,
} = {}) {
  const name = String(title ?? '').trim() || 'Товар';
  const blocks = [`<b>${htmlEscape(name)}</b>`];

  const desc = String(description ?? '').trim();
  if (desc) blocks.push(htmlEscape(desc));

  const attributeLines = (Array.isArray(attributes) ? attributes : [])
    .map(attributeLine)
    .filter(Boolean);
  if (attributeLines.length) blocks.push(attributeLines.join('\n'));

  const footerLines = [];
  if (Number.isFinite(Number(priceMinor))) {
    footerLines.push(`💰 ${htmlEscape(formatMoneyMinor(priceMinor, currencySymbol))}`);
  }
  const store = String(storeName ?? '').trim();
  if (store) footerLines.push(`🏪 ${htmlEscape(store)}`);
  const footer = footerLines.join('\n');

  let body = blocks.join('\n\n');
  if (!footer) return body.slice(0, CAPTION_MAX);

  const budget = CAPTION_MAX - footer.length - 2; // разделитель '\n\n'
  if (body.length > budget) {
    body = budget > 1 ? `${body.slice(0, budget - 1).trimEnd()}…` : '';
  }
  return body ? `${body}\n\n${footer}` : footer;
}

/**
 * `InlineQueryResultPhoto` для `savePreparedInlineMessage` (Bot API 8.0+).
 * `photo_url` обязан быть публичным HTTPS **JPEG** ≤ 5 МБ (клиент готовит JPEG).
 * @param {{
 *   productId: string, photoUrl: string, thumbnailUrl?: string,
 *   title?: string, description?: string, caption?: string, buttonUrl?: string
 * }} input
 * @returns {object}
 */
export function buildPreparedPhotoResult({
  productId,
  photoUrl,
  thumbnailUrl,
  title,
  description,
  caption,
  buttonUrl,
} = {}) {
  return {
    type: 'photo',
    id: String(productId),
    photo_url: photoUrl,
    thumbnail_url: thumbnailUrl || photoUrl,
    title: String(title ?? '').slice(0, 64),
    description: String(description ?? '').slice(0, 128),
    caption,
    parse_mode: 'HTML',
    ...(buttonUrl
      ? {
          reply_markup: {
            inline_keyboard: [[{ text: '🛍️ Открыть товар', url: buttonUrl }]],
          },
        }
      : {}),
  };
}
