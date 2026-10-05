import { loadSellerQuestions } from '../functions/question-api';
import { loadSellerReviews } from '../functions/review-api';
import {
  mapStorefrontProductQuestions,
  mapStorefrontProductReviews,
} from '../../application/mappers/storefront-product-mappers';
import type {
  StorefrontProductQuestions,
  StorefrontProductReviews,
} from '../../application/read-models/storefront-product';

/**
 * Seller-чтение social-лент через edge (actor из сессии) поверх owner-only RPC
 * `seller_product_reviews_read` / `seller_product_questions_read` (миграция 0028).
 * Возвращает ту же проекцию, что и публичный read, поэтому переиспользуем мапперы.
 */
export async function loadProductReviews(
  productId: string,
  sessionToken: string,
): Promise<StorefrontProductReviews> {
  if (!productId || !sessionToken) return mapStorefrontProductReviews(null);
  const raw = await loadSellerReviews(sessionToken, productId);
  return mapStorefrontProductReviews(raw);
}

export async function loadProductQuestions(
  productId: string,
  sessionToken: string,
): Promise<StorefrontProductQuestions> {
  if (!productId || !sessionToken) return mapStorefrontProductQuestions(null);
  const raw = await loadSellerQuestions(sessionToken, productId);
  return mapStorefrontProductQuestions(raw);
}
