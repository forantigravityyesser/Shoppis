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
 * Defensive parsing: projection приходит из БД, но граница типов остаётся явной.
 * Ответ social-функций при невалидном store/product — `null`; лента трактуется
 * как пустая (detail уже отсекает такие случаи).
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

function mapList<T>(raw: unknown, mapItem: (item: unknown) => T | null): T[] {
  return Array.isArray(raw) ? raw.map(mapItem).filter((x): x is T => x !== null) : [];
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
    status: raw.status === 'PAUSED' ? 'PAUSED' : 'ACTIVE',
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
    sortOrder: asNumber(raw.sortOrder),
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
  return {
    id,
    name: asString(raw.name),
    value: asString(raw.value),
    price: asNumber(raw.price),
    originalPrice: raw.originalPrice == null ? null : asNumber(raw.originalPrice),
    availableQuantity: asNumber(raw.availableQuantity),
    available: raw.available === true,
  };
}

function mapRelated(raw: unknown): StorefrontRelatedProduct | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id);
  if (!id) return null;
  return {
    id,
    title: asString(raw.title),
    imageUrl: asNullableString(raw.imageUrl),
    price: asNumber(raw.price),
    originalPrice: raw.originalPrice == null ? null : asNumber(raw.originalPrice),
    available: raw.available === true,
  };
}

function mapRating(raw: unknown): StorefrontProductRating {
  if (!isRecord(raw)) return { average: 0, count: 0 };
  return { average: asNumber(raw.average), count: asNumber(raw.count) };
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
  if (!id) return null;
  return {
    id,
    authorName: asString(raw.authorName) || 'Покупатель',
    rating: asNumber(raw.rating),
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
      const rating = asNumber(item.rating);
      if (rating < 1 || rating > 5) return null;
      return { rating, count: asNumber(item.count) };
    })
    .filter((item): item is StorefrontReviewDistribution => item !== null);
  return mapped.length > 0 ? mapped : EMPTY_DISTRIBUTION;
}

function mapViewerReview(raw: unknown): StorefrontViewerReview | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id);
  if (!id) return null;
  return {
    id,
    rating: asNumber(raw.rating),
    text: asString(raw.text),
    createdAt: asString(raw.createdAt),
  };
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
  return {
    id,
    text: asString(raw.text),
    createdAt: asString(raw.createdAt),
  };
}

export function mapStorefrontProductDetail(raw: unknown): StorefrontProductDetail | null {
  if (!isRecord(raw)) return null;
  const store = mapStore(raw.store);
  const product = mapProduct(raw.product);
  if (!store || !product) return null;
  return {
    store,
    product,
    images: mapList(raw.images, mapImage),
    linkAttributes: mapList(raw.linkAttributes, mapAttribute),
    attributes: mapList(raw.attributes, mapAttribute),
    variants: mapList(raw.variants, mapVariant),
    rating: mapRating(raw.rating),
    questionsCount: asNumber(raw.questionsCount),
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
