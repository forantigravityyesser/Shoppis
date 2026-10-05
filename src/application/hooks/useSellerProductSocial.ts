import { useQuery } from '@tanstack/react-query';
import { useStore } from '../store';
import { deps } from '../composition/container';
import type {
  StorefrontProductQuestion,
  StorefrontProductRating,
  StorefrontProductReview,
  StorefrontReviewDistribution,
} from '../read-models/storefront-product';

const EMPTY_RATING: StorefrontProductRating = { average: 0, count: 0 };
const EMPTY_DISTRIBUTION: StorefrontReviewDistribution[] = [5, 4, 3, 2, 1].map((rating) => ({
  rating,
  count: 0,
}));

export interface SellerProductReviewsState {
  reviews: StorefrontProductReview[];
  summary: StorefrontProductRating;
  distribution: StorefrontReviewDistribution[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export interface SellerProductQuestionsState {
  questions: StorefrontProductQuestion[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/** Сводка для индикаторов в списке Inventory (Phase D). */
export interface SellerProductSocialSummary {
  /** id отзывов товара — непросмотренные считаются на клиенте по seen-store. */
  reviewIds: string[];
  /** Число вопросов без ответа продавца («просмотрен» = отвечен, docs/19 §25). */
  unansweredQuestions: number;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Seller-ленты отзывов/вопросов через edge (actor из серверной сессии),
 * owner-only RPC `seller_product_*_read` (миграция 0028). Работают и для
 * ARCHIVED-товаров. Без сессии запрос отключён. docs/18 PD-H-01.
 */
export function useSellerProductReviews(productId: string | null): SellerProductReviewsState {
  const sessionToken = useStore((s) => s.sessionToken);
  const enabled = Boolean(productId && sessionToken);
  const query = useQuery({
    queryKey: ['seller-product-reviews', productId],
    queryFn: () =>
      deps().sellerProductSocialRepository.loadProductReviews(
        productId as string,
        sessionToken as string,
      ),
    enabled,
  });

  return {
    reviews: query.data?.reviews ?? [],
    summary: query.data?.summary ?? EMPTY_RATING,
    distribution: query.data?.distribution ?? EMPTY_DISTRIBUTION,
    loading: enabled && query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    refresh: () => {
      void query.refetch();
    },
  };
}

export function useSellerProductQuestions(productId: string | null): SellerProductQuestionsState {
  const sessionToken = useStore((s) => s.sessionToken);
  const enabled = Boolean(productId && sessionToken);
  const query = useQuery({
    queryKey: ['seller-product-questions', productId],
    queryFn: () =>
      deps().sellerProductSocialRepository.loadProductQuestions(
        productId as string,
        sessionToken as string,
      ),
    enabled,
  });

  return {
    questions: query.data?.questions ?? [],
    loading: enabled && query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    refresh: () => {
      void query.refetch();
    },
  };
}

/**
 * Компактная сводка отзывов/вопросов товара для индикаторов в списке Inventory:
 * одна React Query-запись, внутри — параллельные seller-чтения вместо полных проекций
 * в UI. React Query кэширует (staleTime), поэтому список не перезапрашивает при ре-рендере.
 * docs/19 §6.2 (Phase D). При росте каталога точку можно заменить одним bulk-RPC.
 */
export function useSellerProductSocialSummary(productId: string | null): SellerProductSocialSummary {
  const sessionToken = useStore((s) => s.sessionToken);
  const enabled = Boolean(productId && sessionToken);
  const query = useQuery({
    queryKey: ['seller-product-social-summary', productId],
    queryFn: async () => {
      const repo = deps().sellerProductSocialRepository;
      const [reviews, questions] = await Promise.all([
        repo.loadProductReviews(productId as string, sessionToken as string),
        repo.loadProductQuestions(productId as string, sessionToken as string),
      ]);
      return {
        reviewIds: reviews.reviews.map((review) => review.id),
        unansweredQuestions: questions.questions.filter((question) => question.answer === null)
          .length,
      };
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });

  return {
    reviewIds: query.data?.reviewIds ?? [],
    unansweredQuestions: query.data?.unansweredQuestions ?? 0,
    loading: enabled && query.isLoading,
    error: query.error ? (query.error as Error).message : null,
    refresh: () => {
      void query.refetch();
    },
  };
}
