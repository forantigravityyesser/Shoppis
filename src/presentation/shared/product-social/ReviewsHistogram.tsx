import { useTranslation } from 'react-i18next';
import type {
  StorefrontProductRating,
  StorefrontReviewDistribution,
} from '../../../application/read-models/storefront-product';
import RatingStars from './RatingStars';

interface Props {
  distribution: StorefrontReviewDistribution[];
  summary: StorefrontProductRating;
}

/**
 * Гистограмма оценок: 5 горизонтальных столбцов (5★ → 1★) + счётчики,
 * сверху средняя оценка и общее число. Показывается всегда, даже при нулях.
 */
export default function ReviewsHistogram({ distribution, summary }: Props) {
  const { t } = useTranslation();
  const max = Math.max(1, ...distribution.map((d) => d.count));

  return (
    <section className="pd-hist" data-testid="reviews-histogram">
      <div className="pd-hist__summary">
        <span className="pd-hist__avg">{summary.average.toFixed(1)}</span>
        <RatingStars value={summary.average} size={16} />
        <span className="pd-hist__count">
          {t('productSocial.reviews', { count: summary.count })}
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
