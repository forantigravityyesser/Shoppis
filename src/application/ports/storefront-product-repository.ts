import type {
  StorefrontProductDetail,
  StorefrontProductQuestions,
  StorefrontProductReviews,
} from '../read-models/storefront-product';

/**
 * Публичное чтение карточки товара покупателя по opaque `public_id` + `product_id`.
 * RPC-функции сами проверяют boundary (store → product → ACTIVE) и отдают готовую
 * проекцию (docs/14 §12). Detail: `null` — товар не найден/чужой/archived.
 * Social-ленты ленивые: пустой ответ эквивалентен «нет данных».
 */
export interface StorefrontProductRepository {
  loadProductDetail(storePublicId: string, productId: string): Promise<StorefrontProductDetail | null>;
  /** `viewerUserId` — для отметки «мой» отзыв/ответ и `canReview`; null для анонима. */
  loadProductReviews(
    storePublicId: string,
    productId: string,
    viewerUserId: string | null,
  ): Promise<StorefrontProductReviews>;
  /** `viewerUserId` — для отметки «мой» вопрос и `canAsk`; null для анонима. */
  loadProductQuestions(
    storePublicId: string,
    productId: string,
    viewerUserId: string | null,
  ): Promise<StorefrontProductQuestions>;
}
