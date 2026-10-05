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
 *
 * `viewerUserId` в social-чтениях — только неавторитетная UI-подсказка
 * (`isOwn` / `viewerReview` / `canReview`), не identity для доступа: ARCHIVED
 * публично недоступен никому (docs/18 PD-H-01). Seller-модерация — через
 * `SellerProductSocialRepository` (edge, actor из сессии).
 */
export interface StorefrontProductRepository {
  loadProductDetail(storePublicId: string, productId: string): Promise<StorefrontProductDetail | null>;
  /** `viewerUserId` — UI-подсказка «мой отзыв»/`canReview`; null для анонима. */
  loadProductReviews(
    storePublicId: string,
    productId: string,
    viewerUserId: string | null,
  ): Promise<StorefrontProductReviews>;
  /** `viewerUserId` — UI-подсказка «мой вопрос»/`canAsk`; null для анонима. */
  loadProductQuestions(
    storePublicId: string,
    productId: string,
    viewerUserId: string | null,
  ): Promise<StorefrontProductQuestions>;
}
