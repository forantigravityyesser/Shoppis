// share-actions.js — подготовка карточки товара для нативного шаринга Telegram.
//
// POST body: { publicId: string, productId: string, photoUrl: string }
// Header: Authorization: Bearer <session token from telegram-auth>
//
// Клиент присылает уже сгенерированный публичный JPEG-URL (Telegram требует JPEG).
// Сервер: валидирует URL (наш публичный бакет), резолвит товар/магазин/цену через
// публичную RPC-проекцию (не доверяя клиенту текст), собирает `InlineQueryResultPhoto`
// и вызывает `savePreparedInlineMessage` для покупателя из сессии. Возвращает `{ id }`,
// который Mini App передаёт в `Telegram.WebApp.shareMessage(id)`.
//
// Env: INSFORGE_BASE_URL, API_KEY (admin), SESSION_SECRET,
//      BUYER_BOT_TOKEN (fallback BOT_TOKEN), BUYER_BOT_USERNAME?, BUYER_APP_SHORTNAME?

import { env } from './_shared/env.js';
import { adminClient } from './_shared/clients.js';
import { bearerToken, json, methodNotAllowed, preflight, readJson } from './_shared/http.js';
import { verifySession } from './_shared/auth.js';
import { isUuid } from './_shared/validate.js';
import { tg } from './_shared/bot-api.js';
import { buyerProductDeepLink } from './_shared/telegram.js';
import { buildPreparedPhotoResult, buildShareCaption } from './_shared/share-message.js';

/** Публичный бакет изображений товаров (совпадает с MEDIA_BUCKET во фронтенде). */
const MEDIA_BUCKET = 'shoppis-media';
const MEDIA_PATH_PREFIX = `/api/storage/buckets/${MEDIA_BUCKET}/objects/`;

/** photoUrl должен быть объектом нашего публичного бакета (не чужой хост). */
function isOurPhotoUrl(url, baseUrl) {
  if (typeof url !== 'string' || !url) return false;
  try {
    const u = new URL(url);
    const b = new URL(baseUrl);
    return u.origin === b.origin && u.pathname.startsWith(MEDIA_PATH_PREFIX);
  } catch {
    return false;
  }
}

export default async function (request) {
  if (request.method === 'OPTIONS') return preflight();
  if (request.method !== 'POST') return methodNotAllowed();

  const baseUrl = env('INSFORGE_BASE_URL');
  const apiKey = env('API_KEY');
  const sessionSecret = env('SESSION_SECRET');
  if (!baseUrl || !apiKey || !sessionSecret) {
    return json({ success: false, error: 'Backend is not configured' }, 500);
  }

  const session = await verifySession(bearerToken(request), sessionSecret);
  if (!session) return json({ success: false, error: 'Unauthorized' }, 401);

  const body = await readJson(request);
  if (!body) return json({ success: false, error: 'Invalid JSON payload' }, 400);

  const publicId = String(body?.publicId || '').trim();
  const productId = String(body?.productId || '').trim();
  const photoUrl = String(body?.photoUrl || '').trim();
  if (!publicId) return json({ success: false, error: 'INVALID_STORE' }, 400);
  if (!isUuid(productId)) return json({ success: false, error: 'INVALID_PRODUCT' }, 400);
  if (!isOurPhotoUrl(photoUrl, baseUrl)) {
    return json({ success: false, error: 'INVALID_PHOTO' }, 400);
  }

  const client = adminClient(baseUrl);
  let detail;
  try {
    const { data, error } = await client.database.rpc('storefront_product_detail_read', {
      p_public_id: publicId,
      p_product_id: productId,
    });
    if (error) throw error;
    detail = data;
  } catch (e) {
    console.error('[share-actions] product read failed:', e);
    return json({ success: false, error: 'PRODUCT_READ_FAILED' }, 500);
  }
  if (!detail) return json({ success: false, error: 'PRODUCT_NOT_FOUND' }, 404);

  const title = String(detail?.product?.title || '').trim();
  const description = String(detail?.product?.description || '').trim();
  const storeName = String(detail?.store?.name || '').trim();
  const currencySymbol = String(detail?.store?.currencySymbol || '');
  const firstImage = Array.isArray(detail?.images) ? detail.images[0] || {} : {};
  const priceMinor = Array.isArray(detail?.variants) ? detail.variants[0]?.price : undefined;
  // Характеристики: сначала связующие (напр. цвет), затем обычные.
  const attributes = [
    ...(Array.isArray(detail?.linkAttributes) ? detail.linkAttributes : []),
    ...(Array.isArray(detail?.attributes) ? detail.attributes : []),
  ];

  const buttonUrl = buyerProductDeepLink(
    env('BUYER_BOT_USERNAME') || 'BuyShoppis_bot',
    env('BUYER_APP_SHORTNAME'),
    publicId,
    productId,
  );

  const result = buildPreparedPhotoResult({
    productId,
    photoUrl,
    thumbnailUrl: firstImage?.thumbUrl || photoUrl,
    title,
    description: storeName,
    caption: buildShareCaption({ title, description, attributes, priceMinor, currencySymbol, storeName }),
    buttonUrl,
  });

  const prepared = await tg('buyer', 'savePreparedInlineMessage', {
    user_id: Number(session.tg),
    result,
    allow_user_chats: true,
    allow_bot_chats: true,
    allow_group_chats: true,
    allow_channel_chats: true,
  });
  if (!prepared?.id) {
    return json({ success: false, error: 'SHARE_PREPARE_FAILED' }, 502);
  }

  return json({ success: true, id: prepared.id });
}
