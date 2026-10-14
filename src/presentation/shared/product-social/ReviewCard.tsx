import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { StorefrontProductReview } from '../../../application/read-models/storefront-product';
import { getInitial } from '../../../domain/rules/initial';
import { formatLongDate } from '../format-date';
import RatingStars from './RatingStars';

interface Props {
  review: StorefrontProductReview;
  /** Действия под отзывом (ответить / удалить) — собираются вызывающим слоем. */
  footer?: ReactNode;
}

/** Карточка отзыва: автор (инициал), звёзды, дата, текст, ответы и слот действий. */
export default function ReviewCard({ review, footer }: Props) {
  const { t } = useTranslation();
  return (
    <article className="pd-review" data-testid="review-card">
      <header className="pd-review__head">
        <span className="pd-review__avatar" aria-hidden>
          {getInitial(review.authorName)}
        </span>
        <div className="pd-review__who">
          <span className="pd-review__author">
            {review.authorName}
            {review.isOwn ? <span className="pd-review__own">{t('productSocial.yourReview')}</span> : null}
          </span>
          <RatingStars value={review.rating} size={13} />
        </div>
        <time className="pd-review__date">{formatLongDate(review.createdAt)}</time>
      </header>

      {review.text ? <p className="pd-review__text">{review.text}</p> : null}

      {review.replies.length > 0 ? (
        <ul className="pd-review__replies">
          {review.replies.map((reply) => (
            <li
              className={`pd-reply${reply.authorType === 'SELLER' ? ' pd-reply--seller' : ''}`}
              key={reply.id}
            >
              <span className="pd-reply__author">
                {reply.authorType === 'SELLER' ? (
                  <span className="pd-reply__badge">{t('productSocial.seller')}</span>
                ) : null}
                {reply.authorName}
                {reply.isOwn ? <span className="pd-reply__own">{t('productSocial.you')}</span> : null}
              </span>
              <span className="pd-reply__text">{reply.text}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {footer ? <div className="pd-review__footer">{footer}</div> : null}
    </article>
  );
}
