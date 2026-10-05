import type {
  StorefrontProductQuestions,
  StorefrontProductReviews,
} from '../read-models/storefront-product';

/**
 * Seller-чтение social-лент товара, включая ARCHIVED.
 *
 * Отличие от публичного `StorefrontProductRepository`: actor приходит из серверной
 * сессии (edge `review-actions`/`question-actions`), а не из параметра запроса,
 * и проверяется владелец магазина. Так seller не читает buyer-проекцию и не
 * зависит от клиентского viewer id. docs/18 PD-H-01 / PD-H-06.
 */
export interface SellerProductSocialRepository {
  /** `sessionToken` обязателен: без сессии запрос к owner-only RPC не имеет смысла. */
  loadProductReviews(productId: string, sessionToken: string): Promise<StorefrontProductReviews>;
  loadProductQuestions(
    productId: string,
    sessionToken: string,
  ): Promise<StorefrontProductQuestions>;
}
