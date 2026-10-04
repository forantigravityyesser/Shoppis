import { useQuery } from '@tanstack/react-query';
import { deps } from '../composition/container';
import type {
  StorefrontProductDetail,
  StorefrontProductQuestion,
  StorefrontProductRating,
  StorefrontProductReview,
  StorefrontReviewDistribution,
  StorefrontViewerQuestion,
  StorefrontViewerReview,
} from '../read-models/storefront-product';

const EMPTY_RATING: StorefrontProductRating = { average: 0, count: 0 };
const EMPTY_DISTRIBUTION: StorefrontReviewDistribution[] = [5, 4, 3, 2, 1].map((rating) => ({
  rating,
  count: 0,
}));

export interface StorefrontProductState {
  /** Данные товара; null — ещё не загружены или товар не найден. */
  detail: StorefrontProductDetail | null;
  loading: boolean;
  error: string | null;
  /** Запрос успешен, но товара нет/чужой/archived. */
  notFound: boolean;
  refresh: () => void;
}

/**
 * Публичная карточка товара по `public_id` + `product_id` одним запросом
 * (`storefront_product_detail_read`). Кэш/ретраи — на `QueryClient`
 * (staleTime 5 мин, retry 1). Без обоих id запрос отключён.
 */
export function useStorefrontProduct(
  publicId: string | null,
  productId: string | null,
): StorefrontProductState {
  const enabled = Boolean(publicId && productId);
  const query = useQuery({
    queryKey: ['storefront-product', publicId, productId],
    queryFn: () =>
      deps().storefrontProductRepository.loadProductDetail(publicId as string, productId as string),
    enabled,
  });

  return {
    detail: query.data ?? null,
    loading: enabled && query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    notFound: query.isSuccess && query.data === null,
    refresh: () => {
      void query.refetch();
    },
  };
}

export interface StorefrontProductReviewsState {
  reviews: StorefrontProductReview[];
  summary: StorefrontProductRating;
  distribution: StorefrontReviewDistribution[];
  viewerReview: StorefrontViewerReview | null;
  canReview: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Ленивая лента отзывов. `enabled` управляется UI (слой «Отзывы» открыт),
 * поэтому 50 отзывов не грузятся вместе с карточкой. `viewerUserId` — для
 * «мой отзыв»/`canReview`; null для анонима. Пустой ответ = «нет отзывов».
 */
export function useStorefrontProductReviews(
  publicId: string | null,
  productId: string | null,
  enabled: boolean,
  viewerUserId: string | null,
): StorefrontProductReviewsState {
  const queryEnabled = Boolean(publicId && productId) && enabled;
  const query = useQuery({
    queryKey: ['storefront-product-reviews', publicId, productId, viewerUserId],
    queryFn: () =>
      deps().storefrontProductRepository.loadProductReviews(
        publicId as string,
        productId as string,
        viewerUserId,
      ),
    enabled: queryEnabled,
  });

  return {
    reviews: query.data?.reviews ?? [],
    summary: query.data?.summary ?? EMPTY_RATING,
    distribution: query.data?.distribution ?? EMPTY_DISTRIBUTION,
    viewerReview: query.data?.viewerReview ?? null,
    canReview: query.data?.canReview ?? true,
    loading: queryEnabled && query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    refresh: () => {
      void query.refetch();
    },
  };
}

export interface StorefrontProductQuestionsState {
  questions: StorefrontProductQuestion[];
  viewerQuestion: StorefrontViewerQuestion | null;
  canAsk: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Ленивая лента вопросов и ответов. `enabled` управляется UI (слой «Вопросы»
 * открыт). `viewerUserId` — для «мой вопрос»/`canAsk`; null для анонима.
 * Пустой ответ трактуется как «нет вопросов».
 */
export function useStorefrontProductQuestions(
  publicId: string | null,
  productId: string | null,
  enabled: boolean,
  viewerUserId: string | null,
): StorefrontProductQuestionsState {
  const queryEnabled = Boolean(publicId && productId) && enabled;
  const query = useQuery({
    queryKey: ['storefront-product-questions', publicId, productId, viewerUserId],
    queryFn: () =>
      deps().storefrontProductRepository.loadProductQuestions(
        publicId as string,
        productId as string,
        viewerUserId,
      ),
    enabled: queryEnabled,
  });

  return {
    questions: query.data?.questions ?? [],
    viewerQuestion: query.data?.viewerQuestion ?? null,
    canAsk: query.data?.canAsk ?? true,
    loading: queryEnabled && query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    refresh: () => {
      void query.refetch();
    },
  };
}
