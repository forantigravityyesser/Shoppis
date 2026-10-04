import { useState } from 'react';
import { useParams } from 'react-router';
import { useStore } from '../../../application/store';
import { useStorefrontProductReviews } from '../../../application/hooks/useStorefrontProduct';
import { useReviewActions } from '../../../application/hooks/useReviewActions';
import { useHaptic } from '../../../application/hooks/useHaptic';
import ReviewsHistogram from '../../buyer/components/product/ReviewsHistogram';
import ReviewCard from '../../buyer/components/product/ReviewCard';
import { reviewErrorMessage } from '../../shared/review-error-message';
import '../../buyer/product-detail.css';

/**
 * Вкладка «Отзывы» seller-карточки (nested route `/seller/inventory/product/:productId/reviews`).
 * Визуал один-в-один с покупательским (гистограмма + список), но продавец не может
 * оценивать/оставлять отзыв — только **отвечать** на отзывы. Ответ продавца
 * помечается бейджем «Продавец». Владелец видит отзывы и у архивных товаров
 * (миграция 0018). docs/14 §8 (PD-10c).
 */
export default function ProductReviewsView() {
  const { productId = '' } = useParams();
  const publicId = useStore((s) => s.currentStore?.publicId ?? null);
  const viewerUserId = useStore((s) => s.serverUser?.id ?? null);

  const { summary, distribution, reviews, loading, error, refresh } =
    useStorefrontProductReviews(publicId, productId || null, true, viewerUserId);
  const actions = useReviewActions(publicId, productId || null);
  const { notifySuccess, selectTick } = useHaptic();

  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const actionError = reviewErrorMessage(actions.error);

  const handleReply = async (reviewId: string) => {
    try {
      await actions.replyToReview(reviewId, replyText);
      notifySuccess();
      setReplyTo(null);
      setReplyText('');
    } catch {
      /* ошибка показана через actionError */
    }
  };

  // Продавец (владелец магазина) может скрыть любой отзыв по своему товару.
  const handleDelete = async (reviewId: string) => {
    try {
      await actions.hideReview(reviewId);
      selectTick();
    } catch {
      /* ошибка показана через actionError */
    }
  };

  if (loading) {
    return (
      <div className="glass inv-state prod-tab-empty">
        <p className="inv-state__title">Загрузка…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass inv-state prod-tab-empty">
        <p className="inv-state__title">Не удалось загрузить отзывы.</p>
        <button type="button" className="pd-retry" onClick={refresh}>
          Повторить
        </button>
      </div>
    );
  }

  return (
    <div className="pd-reviews seller-reviews" data-testid="seller-product-reviews">
      <ReviewsHistogram distribution={distribution} summary={summary} />

      {reviews.length > 0 ? (
        <div className="pd-reviews__list">
          {reviews.map((review) => {
            const hasOwnReply = review.replies.some((reply) => reply.isOwn);

            const deleteButton = (
              <button
                type="button"
                className="pd-review__action pd-review__action--danger"
                disabled={actions.pending}
                onClick={() => void handleDelete(review.id)}
              >
                Удалить отзыв
              </button>
            );

            const footer =
              replyTo === review.id ? (
                <div className="pd-reply-form">
                  <textarea
                    className="pd-compose__input"
                    placeholder="Ответ от магазина"
                    value={replyText}
                    maxLength={2000}
                    rows={2}
                    onChange={(event) => setReplyText(event.target.value)}
                  />
                  <div className="pd-reply-form__actions">
                    {actionError ? <span className="pd-compose__error">{actionError}</span> : null}
                    <button
                      type="button"
                      className="pd-compose__submit"
                      disabled={actions.pending}
                      onClick={() => void handleReply(review.id)}
                    >
                      Ответить
                    </button>
                    <button
                      type="button"
                      className="pd-review__action"
                      onClick={() => {
                        setReplyTo(null);
                        setReplyText('');
                      }}
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {!hasOwnReply ? (
                    <button
                      type="button"
                      className="pd-review__action"
                      onClick={() => {
                        setReplyTo(review.id);
                        setReplyText('');
                      }}
                    >
                      Ответить
                    </button>
                  ) : null}
                  {deleteButton}
                </>
              );

            return <ReviewCard key={review.id} review={review} footer={footer} />;
          })}
        </div>
      ) : (
        <p className="pd-reviews__empty">Пока нет отзывов</p>
      )}
    </div>
  );
}
