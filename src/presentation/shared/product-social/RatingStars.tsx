import { Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Props {
  value: number;
  size?: number;
}

/** Только отображение оценки (5 звёзд). Интерактив — PD-10b. */
export default function RatingStars({ value, size = 14 }: Props) {
  const { t } = useTranslation();
  const filled = Math.round(value);
  return (
    <span className="pd-stars" aria-label={t('productSocial.ratingAria', { value })}>
      {[1, 2, 3, 4, 5].map((n) => {
        const on = n <= filled;
        return (
          <Star
            key={n}
            size={size}
            strokeWidth={2}
            aria-hidden
            className={on ? 'pd-stars__icon pd-stars__icon--on' : 'pd-stars__icon'}
            fill={on ? 'currentColor' : 'none'}
          />
        );
      })}
    </span>
  );
}
