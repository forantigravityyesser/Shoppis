import type { StorefrontStore } from '../read-models/storefront';
import type {
  StorefrontProduct,
  StorefrontProductAttribute,
  StorefrontProductDetail,
  StorefrontProductImage,
  StorefrontProductQuestion,
  StorefrontProductQuestions,
  StorefrontProductRating,
  StorefrontProductReview,
  StorefrontProductReviews,
  StorefrontProductVariant,
  StorefrontRelatedProduct,
  StorefrontReviewDistribution,
  StorefrontReviewReply,
  StorefrontViewerQuestion,
  StorefrontViewerReview,
} from '../read-models/storefront-product';

/**
 * Нормализует ответы `storefront_product_*_read` (jsonb) в публичные read-модели.
 *
 * Граница типов явная и **строгая** (docs/18 PD-H-09): `invalid → безопасный
 * ACTIVE`/`0` недопустимо для commerce. Правила:
 *  - статус магазина — только `ACTIVE`/`PAUSED`, иначе проекция невалидна;
 *  - деньги (`price`/`originalPrice`) и количества (`availableQuantity`) —
 *    конечные неотрицательные числа; невалидный вариант делает detail невалидным;
 *  - невалидный элемент «мягкого» списка (картинка без url, related с битой ценой,
 *    отзыв с оценкой вне 1..5) отбрасывается, а не подменяется нулём.
 * Ответ social-функций при невалидном store/product — `null` (пустая лента).
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

/** Конечное число (принимает numeric-строки); иначе null. `''`/`null`/`true` — не число. */
function parseNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Деньги в minor units: неотрицательное конечное число или null. */
function parseMoney(value: unknown): number | null {
  const n = parseNumber(value);
  return n !== null && n >= 0 ? n : null;
}

/** Количество: неотрицательное конечное число или null. */
function parseCount(value: unknown): number | null {
  const n = parseNumber(value);
  return n !== null && n >= 0 ? n : null;
}

/** Оценка: целое 1..5 или null. */
function parseRating(value: unknown): number | null {
  const n = parseNumber(value);
  return n !== null && n >= 1 && n <= 5 ? n : null;
}

/** «Мягкий» список: невалидные элементы отбрасываются. */
function mapList<T>(raw: unknown, mapItem: (item: unknown) => T | null): T[] {
  return Array.isArray(raw) ? raw.map(mapItem).filter((x): x is T => x !== null) : [];
}

/**
 * «Строгий» список: любой невалидный элемент → `null` (проекция невалидна).
 * `null`/отсутствие списка трактуется как пустой валидный список.
 */
function mapRequiredList<T>(raw: unknown, mapItem: (item: unknown) => T | null): T[] | null {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return [];
  const out: T[] = [];
  for (const item of raw) {
    const mapped = mapItem(item);
    if (mapped === null) return null;
    out.push(mapped);
  }
  return out;
}

function mapStore(raw: unknown): StorefrontStore | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id);
  const publicId = asString(raw.publicId);
  if (!id || !publicId) return null;
  if (raw.status !== 'ACTIVE' && raw.status !== 'PAUSED') return null;
  return {
    id,
    publicId,
    name: asString(raw.name),
    bannerUrl: asNullableString(raw.bannerUrl),
    status: raw.status,
    currencyCode: asString(raw.currencyCode) as StorefrontStore['currencyCode'],
    currencySymbol: asString(raw.currencySymbol),
  };
}

function mapProduct(raw: unknown): StorefrontProduct | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id);
  if (!id) return null;
  return {
    id,
    title: asString(raw.title),
    description: asString(raw.description),
    categoryId: asNullableString(raw.categoryId),
  };
}

function mapImage(raw: unknown): StorefrontProductImage | null {
  if (!isRecord(raw)) return null;
  const url = asString(raw.url);
  if (!url) return null;
  return {
    url,
    thumbUrl: asNullableString(raw.thumbUrl),
    sortOrder: parseCount(raw.sortOrder) ?? 0,
  };
}

function mapAttribute(raw: unknown): StorefrontProductAttribute | null {
  if (!isRecord(raw)) return null;
  return { name: asString(raw.name), value: asString(raw.value) };
}

function mapVariant(raw: unknown): StorefrontProductVariant | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id);
  if (!id) return null;
  const price = parseMoney(raw.price);
  const availableQuantity = parseCount(raw.availableQuantity);
  if (price === null || availableQuantity === null) return null;
  let originalPrice: number | null = null;
  if (raw.originalPrice != null) {
    originalPrice = parseMoney(raw.originalPrice);
    if (originalPrice === null) return null;
  }
  return {
    id,
    name: asString(raw.name),
    value: asString(raw.value),
    price,
    originalPrice,
    availableQuantity,
    available: raw.available === true,
  };
}

function mapRelated(raw: unknown): StorefrontRelatedProduct | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id);
  if (!id) return null;
  const price = parseMoney(raw.price);
  if (price === null) return null;
  let originalPrice: number | null = null;
  if (raw.originalPrice != null) {
    originalPrice = parseMoney(raw.originalPrice);
    if (originalPrice === null) return null;
  }
  return {
    id,
    title: asString(raw.title),
    imageUrl: asNullableString(raw.imageUrl),
    price,
    originalPrice,
    available: raw.available === true,
  };
}

function mapRating(raw: unknown): StorefrontProductRating {
  if (!isRecord(raw)) return { average: 0, count: 0 };
  return { average: parseNumber(raw.average) ?? 0, count: parseCount(raw.count) ?? 0 };
}

function mapReply(raw: unknown): StorefrontReviewReply | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id);
  if (!id) return null;
  return {
    id,
    authorName: asString(raw.authorName) || 'Покупатель',
    authorType: raw.authorType === 'SELLER' ? 'SELLER' : 'BUYER',
    text: asString(raw.text),
    createdAt: asString(raw.createdAt),
    isOwn: raw.isOwn === true,
  };
}

function mapReview(raw: unknown): StorefrontProductReview | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id);
  const rating = parseRating(raw.rating);
  if (!id || rating === null) return null;
  return {
    id,
    authorName: asString(raw.authorName) || 'Покупатель',
    rating,
    text: asString(raw.text),
    createdAt: asString(raw.createdAt),
    isOwn: raw.isOwn === true,
    replies: mapList(raw.replies, mapReply),
  };
}

const EMPTY_DISTRIBUTION: StorefrontReviewDistribution[] = [5, 4, 3, 2, 1].map((rating) => ({
  rating,
  count: 0,
}));

function mapDistribution(raw: unknown): StorefrontReviewDistribution[] {
  if (!Array.isArray(raw)) return EMPTY_DISTRIBUTION;
  const mapped = raw
    .map((item) => {
      if (!isRecord(item)) return null;
      const rating = parseRating(item.rating);
      if (rating === null) return null;
      return { rating, count: parseCount(item.count) ?? 0 };
    })
    .filter((item): item is StorefrontReviewDistribution => item !== null);
  return mapped.length > 0 ? mapped : EMPTY_DISTRIBUTION;
}

function mapViewerReview(raw: unknown): StorefrontViewerReview | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id);
  const rating = parseRating(raw.rating);
  if (!id || rating === null) return null;
  return { id, rating, text: asString(raw.text), createdAt: asString(raw.createdAt) };
}

function mapQuestion(raw: unknown): StorefrontProductQuestion | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id);
  if (!id) return null;
  const answer = isRecord(raw.answer)
    ? { text: asString(raw.answer.text), createdAt: asString(raw.answer.createdAt) }
    : null;
  return {
    id,
    authorName: asString(raw.authorName) || 'Покупатель',
    text: asString(raw.text),
    createdAt: asString(raw.createdAt),
    isOwn: raw.isOwn === true,
    answer,
  };
}

function mapViewerQuestion(raw: unknown): StorefrontViewerQuestion | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id);
  if (!id) return null;
  return { id, text: asString(raw.text), createdAt: asString(raw.createdAt) };
}

export function mapStorefrontProductDetail(raw: unknown): StorefrontProductDetail | null {
  if (!isRecord(raw)) return null;
  const store = mapStore(raw.store);
  const product = mapProduct(raw.product);
  if (!store || !product) return null;

  // Варианты покупаемые: невалидная цена/количество делают карточку невалидной,
  // а не показывают ложный «0».
  const variants = mapRequiredList(raw.variants, mapVariant);
  if (variants === null) return null;

  return {
    store,
    product,
    images: mapList(raw.images, mapImage),
    linkAttributes: mapList(raw.linkAttributes, mapAttribute),
    attributes: mapList(raw.attributes, mapAttribute),
    variants,
    rating: mapRating(raw.rating),
    questionsCount: parseCount(raw.questionsCount) ?? 0,
    relatedProducts: mapList(raw.relatedProducts, mapRelated),
  };
}

export function mapStorefrontProductReviews(raw: unknown): StorefrontProductReviews {
  if (!isRecord(raw)) {
    return {
      summary: { average: 0, count: 0 },
      distribution: EMPTY_DISTRIBUTION,
      reviews: [],
      viewerReview: null,
      canReview: true,
    };
  }
  return {
    summary: mapRating(raw.summary),
    distribution: mapDistribution(raw.distribution),
    reviews: mapList(raw.reviews, mapReview),
    viewerReview: mapViewerReview(raw.viewerReview),
    // По умолчанию «можно» (напр. аноним); сервер присылает false при существующей записи.
    canReview: raw.canReview !== false,
  };
}

export function mapStorefrontProductQuestions(raw: unknown): StorefrontProductQuestions {
  if (!isRecord(raw)) {
    return { questions: [], viewerQuestion: null, canAsk: true };
  }
  return {
    questions: mapList(raw.questions, mapQuestion),
    viewerQuestion: mapViewerQuestion(raw.viewerQuestion),
    // По умолчанию «можно» (напр. аноним); сервер присылает false при существующей записи.
    canAsk: raw.canAsk !== false,
  };
}
