import type {
  StorefrontProductRating,
  StorefrontReviewDistribution,
} from '../../../../application/read-models/storefront-product';
import RatingStars from './RatingStars';

interface Props {
  distribution: StorefrontReviewDistribution[];
  summary: StorefrontProductRating;
}

function reviewsWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'отзыв';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'отзыва';
  return 'отзывов';
}

/**
 * Гистограмма оценок: 5 горизонтальных столбцов (5★ → 1★) + счётчики,
 * сверху средняя оценка и общее число. Показывается всегда, даже при нулях.
 */
export default function ReviewsHistogram({ distribution, summary }: Props) {
  const max = Math.max(1, ...distribution.map((d) => d.count));

  return (
    <section className="pd-hist" data-testid="reviews-histogram">
      <div className="pd-hist__summary">
        <span className="pd-hist__avg">{summary.average.toFixed(1)}</span>
        <RatingStars value={summary.average} size={16} />
        <span className="pd-hist__count">
          {summary.count} {reviewsWord(summary.count)}
        </span>
      </div>

      <div className="pd-hist__rows">
        {distribution.map((d) => (
          <div className="pd-hist__row" key={d.rating}>
            <span className="pd-hist__label">{d.rating}★</span>
            <span className="pd-hist__bar">
              <span
                className="pd-hist__fill"
                style={{ width: `${Math.round((d.count / max) * 100)}%` }}
              />
            </span>
            <span className="pd-hist__num">{d.count}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
