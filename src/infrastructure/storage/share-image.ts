import { insforge } from '../insforge/client';
import { MEDIA_BUCKET } from '../insforge/config';

/**
 * Готовит публичный **JPEG**-URL изображения товара для шаринга в Telegram.
 *
 * Telegram (`InlineQueryResultPhoto.photo_url`) требует JPEG ≤ 5 МБ, а в каталоге
 * полноразмерные фото хранятся как WebP. Поэтому:
 *  - если фото уже JPEG — возвращаем как есть (без лишней работы);
 *  - иначе тянем WebP (публичный бакет отдаёт `Access-Control-Allow-Origin: *`),
 *    перекодируем в лёгкий JPEG (800px, q0.8) и кэшируем в бакете по стабильному
 *    ключу `share/<productId>-<hash>.jpg` (hash от исходного URL — при смене фото
 *    получится новый ключ, без устаревшего кэша).
 *
 * Никогда не бросает: при любой ошибке возвращает `null` — вызывающий слой
 * откатится на шаринг без фото.
 */

/** Ширина лёгкого JPEG для карточки шаринга (высота — из пропорции). */
const SHARE_WIDTH = 800;
/** Качество JPEG (Telegram всё равно пережимает фото). */
const SHARE_QUALITY = 0.8;

function looksLikeJpeg(url: string): boolean {
  try {
    const path = new URL(url, 'https://x').pathname.toLowerCase();
    return path.endsWith('.jpg') || path.endsWith('.jpeg');
  } catch {
    return false;
  }
}

/** Стабильный короткий хэш строки (djb2 → base36) для cache-busting ключа. */
function hashString(value: string): string {
  let h = 5381;
  for (let i = 0; i < value.length; i += 1) h = ((h << 5) + h + value.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Перекодирование изображения в JPEG-блоб заданной ширины. */
async function toJpegBlob(blob: Blob, width: number, quality: number): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  try {
    const w = Math.max(1, Math.min(width, bitmap.width));
    const h = Math.max(1, Math.round((bitmap.height * w) / bitmap.width));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D unavailable');
    ctx.drawImage(bitmap, 0, 0, w, h);
    const out = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality),
    );
    if (!out) throw new Error('JPEG encoding failed');
    return out;
  } finally {
    bitmap.close();
  }
}

/**
 * Возвращает публичный JPEG-URL для шаринга либо `null`.
 * @param productId id товара (для стабильного ключа кэша)
 * @param imageUrl публичный URL исходного фото (WebP/JPEG)
 */
export async function ensureShareImage(
  productId: string,
  imageUrl: string,
): Promise<string | null> {
  if (!productId || !imageUrl) return null;
  if (looksLikeJpeg(imageUrl)) return imageUrl;

  try {
    const res = await fetch(imageUrl);
    if (!res.ok) return null;
    const jpeg = await toJpegBlob(await res.blob(), SHARE_WIDTH, SHARE_QUALITY);
    const key = `share/${productId}-${hashString(imageUrl)}.jpg`;
    const { data, error } = await insforge.storage.from(MEDIA_BUCKET).upload(key, jpeg);
    if (error || !data?.url) return null;
    return data.url;
  } catch {
    return null;
  }
}
