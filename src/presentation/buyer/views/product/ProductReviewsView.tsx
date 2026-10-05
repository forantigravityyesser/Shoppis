import { useState } from 'react';
import { useParams } from 'react-router';
import { useStore } from '../../../../application/store';
import { useStorefrontProductReviews } from '../../../../application/hooks/useStorefrontProduct';
import { useReviewActions } from '../../../../application/hooks/useReviewActions';
import { useHaptic } from '../../../../application/hooks/useHaptic';
import SocialLayer from '../../components/product/SocialLayer';
import ReviewsHistogram from '../../../shared/product-social/ReviewsHistogram';
import ReviewCard from '../../../shared/product-social/ReviewCard';
import ReviewComposer from '../../components/product/ReviewComposer';
import { reviewErrorMessage } from '../../../shared/review-error-message';

/**
 * Слой «Отзывы» (nested route `/product/:id/reviews`).
 * PD-10a — чтение (гистограмма + список + ответы). PD-10b — запись: создание
 * отзыва (звёзды + необязательный комментарий), удаление своего, ответ на чужой
 * (1 раз). Модерация продавца — PD-10c. docs/14 §8.
 */
export default function ProductReviewsView() {
  const { id } = useParams<{ id: string }>();
  const publicId = useStore((s) => s.viewedStore?.publicId ?? null);
  const viewer = useStore((s) => s.serverUser);
  const viewerUserId = viewer?.id ?? null;

  const { summary, distribution, reviews, canReview, loading, error, refresh } =
    useStorefrontProductReviews(publicId, id ?? null, true, viewerUserId);
  const actions = useReviewActions(publicId, id ?? null);
  const { selectTick, notifySuccess } = useHaptic();

  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const actionError = reviewErrorMessage(actions.error);

  const handleCreate = async (rating: number, text: string) => {
    try {
      await actions.createReview(rating, text);
      notifySuccess();
    } catch {
      /* ошибка показана через actions.error → actionError */
    }
  };

  const handleDelete = async (reviewId: string) => {
    try {
      await actions.hideReview(reviewId);
      selectTick();
    } catch {
      /* см. actionError */
    }
  };

  const handleReply = async (reviewId: string) => {
    try {
      await actions.replyToReview(reviewId, replyText);
      notifySuccess();
      setReplyTo(null);
      setReplyText('');
    } catch {
      /* см. actionError */
    }
  };

  return (
    <SocialLayer title="Отзывы" backTo={`/product/${id ?? ''}`}>
      <div className="pd-reviews" data-testid="product-reviews">
        {error ? (
          <div className="pd-reviews__state">
            <p>Не удалось загрузить отзывы.</p>
            <button type="button" className="pd-retry" onClick={refresh}>
              Повторить
            </button>
          </div>
        ) : loading ? (
          <div className="pd-reviews__state">Загрузка…</div>
        ) : (
          <>
            <ReviewsHistogram distribution={distribution} summary={summary} />

            {canReview ? (
              <ReviewComposer
                authorName={viewer?.firstName || 'Вы'}
                onSubmit={handleCreate}
                pending={actions.pending}
                error={actionError}
              />
            ) : (
              <p className="pd-reviews__notice">
                Вы уже оставляли отзыв. Изменить или оставить новый нельзя.
              </p>
            )}

            {reviews.length > 0 ? (
              <div className="pd-reviews__list">
                {reviews.map((review) => {
                  const hasOwnReply = review.replies.some((reply) => reply.isOwn);
                  let footer = null;

                  if (review.isOwn) {
                    footer = (
                      <button
                        type="button"
                        className="pd-review__action pd-review__action--danger"
                        disabled={actions.pending}
                        onClick={() => void handleDelete(review.id)}
                      >
                        Удалить отзыв
                      </button>
                    );
                  } else if (!hasOwnReply) {
                    footer =
                      replyTo === review.id ? (
                        <div className="pd-reply-form">
                          <textarea
                            className="pd-compose__input"
                            placeholder="Ваш ответ"
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
                      );
                  }

                  return <ReviewCard key={review.id} review={review} footer={footer} />;
                })}
              </div>
            ) : (
              <p className="pd-reviews__empty">Пока нет отзывов</p>
            )}
          </>
        )}
      </div>
    </SocialLayer>
  );
}
