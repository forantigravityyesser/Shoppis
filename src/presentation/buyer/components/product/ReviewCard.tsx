import type { ReactNode } from 'react';
import type { StorefrontProductReview } from '../../../../application/read-models/storefront-product';
import { getInitial } from '../../../../domain/rules/initial';
import RatingStars from './RatingStars';

interface Props {
  review: StorefrontProductReview;
  /** Действия под отзывом (ответить / удалить) — собираются вызывающим слоем. */
  footer?: ReactNode;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Карточка отзыва: автор (инициал), звёзды, дата, текст, ответы и слот действий. */
export default function ReviewCard({ review, footer }: Props) {
  return (
    <article className="pd-review" data-testid="review-card">
      <header className="pd-review__head">
        <span className="pd-review__avatar" aria-hidden>
          {getInitial(review.authorName)}
        </span>
        <div className="pd-review__who">
          <span className="pd-review__author">
            {review.authorName}
            {review.isOwn ? <span className="pd-review__own">Ваш отзыв</span> : null}
          </span>
          <RatingStars value={review.rating} size={13} />
        </div>
        <time className="pd-review__date">{formatDate(review.createdAt)}</time>
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
                  <span className="pd-reply__badge">Продавец</span>
                ) : null}
                {reply.authorName}
                {reply.isOwn ? <span className="pd-reply__own">Вы</span> : null}
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
