import type { StorefrontCategory, StorefrontHome, StorefrontProductCard, StorefrontStore } from '../read-models/storefront';

/**
 * Нормализует ответ `storefront_home_read` (jsonb) в `StorefrontHome`.
 * Возвращает null, если магазин не найден/ответ некорректен — вызывающий слой
 * показывает состояние «магазин не найден». Defensive parsing: projection
 * приходит из БД, но граница типов остаётся явной.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

function asNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function mapStore(raw: unknown): StorefrontStore | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id);
  const publicId = asString(raw.publicId);
  if (!id || !publicId) return null;
  return {
    id,
    publicId,
    name: asString(raw.name),
    bannerUrl: asNullableString(raw.bannerUrl),
    sellerAvatarUrl: asNullableString(raw.sellerAvatarUrl),
    status: raw.status === 'PAUSED' ? 'PAUSED' : 'ACTIVE',
    currencyCode: asString(raw.currencyCode) as StorefrontStore['currencyCode'],
    currencySymbol: asString(raw.currencySymbol),
  };
}

function mapCategory(raw: unknown): StorefrontCategory | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id);
  if (!id) return null;
  return {
    id,
    name: asString(raw.name),
    imageUrl: asNullableString(raw.imageUrl),
    sortOrder: asNumber(raw.sortOrder),
  };
}

function mapProduct(raw: unknown): StorefrontProductCard | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id);
  if (!id) return null;
  return {
    id,
    title: asString(raw.title),
    categoryId: asNullableString(raw.categoryId),
    imageUrl: asNullableString(raw.imageUrl),
    price: asNumber(raw.price),
    originalPrice: raw.originalPrice == null ? null : asNumber(raw.originalPrice),
    available: raw.available === true,
  };
}

export function mapStorefrontHome(raw: unknown): StorefrontHome | null {
  if (!isRecord(raw)) return null;
  const store = mapStore(raw.store);
  if (!store) return null;
  return {
    store,
    categories: Array.isArray(raw.categories)
      ? raw.categories.map(mapCategory).filter((c): c is StorefrontCategory => c !== null)
      : [],
    products: Array.isArray(raw.products)
      ? raw.products.map(mapProduct).filter((p): p is StorefrontProductCard => p !== null)
      : [],
  };
}
