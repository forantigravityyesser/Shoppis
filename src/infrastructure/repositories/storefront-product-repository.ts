import { insforge } from '../insforge/client';
import {
  mapStorefrontProductDetail,
  mapStorefrontProductQuestions,
  mapStorefrontProductReviews,
} from '../../application/mappers/storefront-product-mappers';
import type {
  StorefrontProductDetail,
  StorefrontProductQuestions,
  StorefrontProductReviews,
} from '../../application/read-models/storefront-product';

/**
 * Публичный read карточки товара по opaque `public_id` + `product_id`.
 * RPC-функции сами проверяют boundary и отдают buyer-проекцию (docs/14 §12).
 * Detail: `null` — товар не найден/чужой/archived. Social-ленты грузятся лениво
 * и при невалидном ответе трактуются как пустые.
 *
 * `viewerUserId` — только неавторитетная UI-подсказка (`isOwn`/`canReview`),
 * не identity для доступа: ARCHIVED публично недоступен никому (docs/18 PD-H-01).
 */
export async function loadProductDetail(
  storePublicId: string,
  productId: string,
): Promise<StorefrontProductDetail | null> {
  if (!storePublicId || !productId) return null;
  const { data, error } = await insforge.database.rpc('storefront_product_detail_read', {
    p_public_id: storePublicId,
    p_product_id: productId,
  });
  if (error) throw error;
  return mapStorefrontProductDetail(data);
}

export async function loadProductReviews(
  storePublicId: string,
  productId: string,
  viewerUserId: string | null,
): Promise<StorefrontProductReviews> {
  if (!storePublicId || !productId) return mapStorefrontProductReviews(null);
  const { data, error } = await insforge.database.rpc('storefront_product_reviews_read', {
    p_public_id: storePublicId,
    p_product_id: productId,
    p_viewer_user_id: viewerUserId,
  });
  if (error) throw error;
  return mapStorefrontProductReviews(data);
}

export async function loadProductQuestions(
  storePublicId: string,
  productId: string,
  viewerUserId: string | null,
): Promise<StorefrontProductQuestions> {
  if (!storePublicId || !productId) return mapStorefrontProductQuestions(null);
  const { data, error } = await insforge.database.rpc('storefront_product_questions_read', {
    p_public_id: storePublicId,
    p_product_id: productId,
    p_viewer_user_id: viewerUserId,
  });
  if (error) throw error;
  return mapStorefrontProductQuestions(data);
}
