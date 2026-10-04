import { invokeFunction } from '../insforge/functions-gateway';

/**
 * Клиент edge-диспетчера review-actions. Мутации отзывов уходят на сервер, где
 * атомарно выполняются PL/pgSQL-функциями (migrations/0017) с actor из сессии.
 */
interface ReviewResponse {
  success?: boolean;
  result?: unknown;
  error?: string;
}

async function callReview(token: string, body: Record<string, unknown>): Promise<void> {
  const { data, error } = await invokeFunction<ReviewResponse>('review-actions', { body, token });
  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error(data?.error ?? 'Review action failed');
}

export async function createReview(
  token: string,
  productId: string,
  rating: number,
  text: string,
): Promise<void> {
  await callReview(token, { action: 'review-create', productId, rating, text });
}

export async function hideReview(token: string, reviewId: string): Promise<void> {
  await callReview(token, { action: 'review-hide', reviewId });
}

export async function replyToReview(token: string, reviewId: string, text: string): Promise<void> {
  await callReview(token, { action: 'review-reply', reviewId, text });
}
