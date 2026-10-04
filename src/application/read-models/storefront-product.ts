import type { StorefrontStore } from './storefront';

/**
 * Публичная read-модель карточки товара покупателя. Projection приходит из
 * `storefront_product_detail_read(public_id, product_id)` одним запросом (docs/14 §12).
 * Рейтинг и счётчики считаются только по ACTIVE записям; `held_quantity` не раскрывается.
 */
export interface StorefrontProductDetail {
  store: StorefrontStore;
  product: StorefrontProduct;
  images: StorefrontProductImage[];
  /** Linking/differentiating-атрибуты (напр. Color) — показываются у названия. */
  linkAttributes: StorefrontProductAttribute[];
  /** Обычные характеристики (напр. Материал, Бренд). */
  attributes: StorefrontProductAttribute[];
  variants: StorefrontProductVariant[];
  rating: StorefrontProductRating;
  questionsCount: number;
  /** «Другие варианты» из ProductGroup; пусто → блок не показываем. */
  relatedProducts: StorefrontRelatedProduct[];
}

export interface StorefrontProduct {
  id: string;
  title: string;
  description: string;
  /** null, если категория не ACTIVE (архивная) или удалена. */
  categoryId: string | null;
}

export interface StorefrontProductImage {
  /** Полное фото (main), уже публичный URL. */
  url: string;
  /** Лёгкая миниатюра; null → fallback на `url` на клиенте. */
  thumbUrl: string | null;
  sortOrder: number;
}

export interface StorefrontProductAttribute {
  name: string;
  value: string;
}

export interface StorefrontProductVariant {
  id: string;
  name: string;
  value: string;
  /** Текущая effective price варианта, minor units (серверная, со скидкой). */
  price: number;
  /** Цена до скидки, только если скидка > 0; иначе null. */
  originalPrice: number | null;
  availableQuantity: number;
  /** false — вариант распродан, выбрать нельзя. */
  available: boolean;
}

export interface StorefrontProductRating {
  average: number;
  count: number;
}

export interface StorefrontRelatedProduct {
  id: string;
  title: string;
  /** Лёгкая миниатюра (thumb), fallback — полное фото. */
  imageUrl: string | null;
  price: number;
  originalPrice: number | null;
  available: boolean;
}

export type StorefrontReviewAuthorType = 'BUYER' | 'SELLER';

export interface StorefrontReviewReply {
  id: string;
  authorName: string;
  authorType: StorefrontReviewAuthorType;
  text: string;
  createdAt: string;
  /** Ответ оставлен текущим зрителем (для возможного удаления — PD-10b). */
  isOwn: boolean;
}

export interface StorefrontReviewDistribution {
  rating: number;
  count: number;
}

export interface StorefrontProductReview {
  id: string;
  /** Только имя автора (first_name → username → «Покупатель»). */
  authorName: string;
  rating: number;
  text: string;
  createdAt: string;
  /** Отзыв оставлен текущим зрителем. */
  isOwn: boolean;
  replies: StorefrontReviewReply[];
}

/** Собственный отзыв зрителя (если он уже оставлял ACTIVE-отзыв). */
export interface StorefrontViewerReview {
  id: string;
  rating: number;
  text: string;
  createdAt: string;
}

export interface StorefrontProductReviews {
  summary: StorefrontProductRating;
  /** Всегда 5 бакетов (5★ → 1★), включая нулевые. */
  distribution: StorefrontReviewDistribution[];
  reviews: StorefrontProductReview[];
  /** ACTIVE-отзыв зрителя или null. */
  viewerReview: StorefrontViewerReview | null;
  /** false, если у зрителя уже есть запись (в т.ч. HIDDEN) — повторный отзыв невозможен. */
  canReview: boolean;
}

export interface StorefrontProductQuestion {
  id: string;
  authorName: string;
  text: string;
  createdAt: string;
  /** Вопрос задан текущим зрителем (для удаления своего). */
  isOwn: boolean;
  /** 0..1 ответ продавца; null → показываем только вопрос, без пустого блока. */
  answer: { text: string; createdAt: string } | null;
}

/** Собственный вопрос зрителя (если он уже задавал ACTIVE-вопрос). */
export interface StorefrontViewerQuestion {
  id: string;
  text: string;
  createdAt: string;
}

export interface StorefrontProductQuestions {
  questions: StorefrontProductQuestion[];
  /** ACTIVE-вопрос зрителя или null. */
  viewerQuestion: StorefrontViewerQuestion | null;
  /** false, если у зрителя уже есть запись (в т.ч. HIDDEN) — повторный вопрос невозможен. */
  canAsk: boolean;
}
