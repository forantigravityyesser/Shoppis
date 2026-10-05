import type {
  StorefrontCategory,
  StorefrontHome,
  StorefrontHomeProductPage,
  StorefrontProductCard,
  StorefrontStore,
} from '../read-models/storefront';
import type {
  StorefrontCatalogPriceBounds,
  StorefrontCatalogProductPage,
} from '../read-models/storefront-catalog';
import type { PublicStoreContext } from '../read-models/public-store';

/**
 * Нормализует ответы публичного storefront-read (`storefront_home_context_read`,
 * `storefront_home_products_read`, `storefront_public_context_read`) в read-модели.
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

function asNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function mapStore(raw: unknown): StorefrontStore | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id);
  const publicId = asString(raw.publicId);
  if (!id || !publicId) return null;
  return {
    id,
    publicId,
    name: asString(raw.name),
    bannerUrl: asNullableString(raw.bannerUrl),
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
    available: raw.available === true,
  };
}

/**
 * Минимальный публичный контекст витрины (`storefront_public_context_read`).
 * Обязательны `id` и `publicId`; остального проекция может не содержать.
 */
export function mapPublicStoreContext(raw: unknown): PublicStoreContext | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id);
  const publicId = asString(raw.publicId);
  if (!id || !publicId) return null;
  return {
    id,
    publicId,
    name: asString(raw.name),
    status: raw.status === 'PAUSED' ? 'PAUSED' : 'ACTIVE',
    supportHandle: asNullableString(raw.supportHandle),
    logoUrl: asNullableString(raw.logoUrl),
  };
}

/** Контекст витрины: store + активные категории (`storefront_home_context_read`). */
export function mapStorefrontHome(raw: unknown): StorefrontHome | null {
  if (!isRecord(raw)) return null;
  const store = mapStore(raw.store);
  if (!store) return null;
  return {
    store,
    categories: Array.isArray(raw.categories)
      ? raw.categories.map(mapCategory).filter((c): c is StorefrontCategory => c !== null)
      : [],
  };
}

/** Страница товарного потока (`storefront_home_products_read`). */
export function mapStorefrontHomeProductPage(raw: unknown): StorefrontHomeProductPage | null {
  if (!isRecord(raw)) return null;
  return {
    products: Array.isArray(raw.products)
      ? raw.products.map(mapProduct).filter((p): p is StorefrontProductCard => p !== null)
      : [],
    nextCursor: asNullableString(raw.nextCursor),
  };
}

/**
 * Страница Каталога (`storefront_catalog_products_read`). Карточка — та же
 * `StorefrontProductCard`, что и на Home (единая проекция/price semantics).
 */
export function mapStorefrontCatalogProductPage(
  raw: unknown,
): StorefrontCatalogProductPage | null {
  if (!isRecord(raw)) return null;
  return {
    products: Array.isArray(raw.products)
      ? raw.products.map(mapProduct).filter((p): p is StorefrontProductCard => p !== null)
      : [],
    nextCursor: asNullableString(raw.nextCursor),
  };
}

/**
 * Список карточек избранного (`storefront_favorite_products_read`). Та же карточка,
 * что у Home/Каталога; порядок сохраняет порядок запрошенных id. Невалидный ответ —
 * пустой список (архивные/удалённые товары просто отсутствуют).
 */
export function mapStorefrontProductCardList(raw: unknown): StorefrontProductCard[] {
  if (!isRecord(raw)) return [];
  return Array.isArray(raw.products)
    ? raw.products.map(mapProduct).filter((p): p is StorefrontProductCard => p !== null)
    : [];
}

/** Границы актуальных цен магазина (`storefront_catalog_price_bounds_read`). */
export function mapStorefrontCatalogPriceBounds(
  raw: unknown,
): StorefrontCatalogPriceBounds | null {
  if (!isRecord(raw)) return null;
  return {
    minPrice: asNullableNumber(raw.minPrice),
    maxPrice: asNullableNumber(raw.maxPrice),
  };
}
