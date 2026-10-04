import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useStore } from '../store';
import { deps } from '../composition/container';

export interface ReviewActionsState {
  createReview: (rating: number, text: string) => Promise<void>;
  hideReview: (reviewId: string) => Promise<void>;
  replyToReview: (reviewId: string, text: string) => Promise<void>;
  pending: boolean;
  /** Код/сообщение последней ошибки мутации (напр. ALREADY_REVIEWED) или null. */
  error: string | null;
}

/**
 * Мутации отзывов (создать / скрыть свой / ответить). Токен берём из сессии
 * (actor на сервере — только из неё). После успеха инвалидируем ленту отзывов
 * и карточку (рейтинг/summary). docs/14 §8.
 */
export function useReviewActions(
  publicId: string | null,
  productId: string | null,
): ReviewActionsState {
  const queryClient = useQueryClient();
  const sessionToken = useStore((s) => s.sessionToken);

  const invalidate = () => {
    if (publicId && productId) {
      void queryClient.invalidateQueries({
        queryKey: ['storefront-product-reviews', publicId, productId],
      });
      void queryClient.invalidateQueries({ queryKey: ['storefront-product', publicId, productId] });
    }
  };

  const create = useMutation({
    mutationFn: (vars: { rating: number; text: string }) => {
      if (!sessionToken || !productId) return Promise.reject(new Error('UNAUTHORIZED'));
      return deps().reviewApi.createReview(sessionToken, productId, vars.rating, vars.text);
    },
    onSuccess: invalidate,
  });

  const hide = useMutation({
    mutationFn: (reviewId: string) => {
      if (!sessionToken) return Promise.reject(new Error('UNAUTHORIZED'));
      return deps().reviewApi.hideReview(sessionToken, reviewId);
    },
    onSuccess: invalidate,
  });

  const reply = useMutation({
    mutationFn: (vars: { reviewId: string; text: string }) => {
      if (!sessionToken) return Promise.reject(new Error('UNAUTHORIZED'));
      return deps().reviewApi.replyToReview(sessionToken, vars.reviewId, vars.text);
    },
    onSuccess: invalidate,
  });

  const error = (create.error ?? hide.error ?? reply.error) as Error | null;

  return {
    createReview: (rating, text) => create.mutateAsync({ rating, text }).then(() => undefined),
    hideReview: (reviewId) => hide.mutateAsync(reviewId).then(() => undefined),
    replyToReview: (reviewId, text) =>
      reply.mutateAsync({ reviewId, text }).then(() => undefined),
    pending: create.isPending || hide.isPending || reply.isPending,
    error: error ? error.message : null,
  };
}
