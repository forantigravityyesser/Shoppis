import { useRef, type MouseEvent } from 'react';
import { Heart } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFavorites } from '../../../application/hooks/useFavorites';
import { useStore } from '../../../application/store';

interface Props {
  productId: string;
  /** Фото товара — для «летящей» карточки в таб «Избранное». */
  imageUrl?: string | null;
}

/**
 * Сердце в белом контейнере, который визуально вырезает угол карточки.
 * Избранное store-scoped (zustand persist). Клик не открывает товар. docs/13 §9, §17.
 * При добавлении в избранное из точки сердца стартует «летящая» карточка к табу
 * «Избранное» в нижней навигации (см. `FlyingAnimations`).
 */
export default function FavoriteButton({ productId, imageUrl = null }: Props) {
  const { t } = useTranslation();
  const { isFavorite, toggleFavorite } = useFavorites();
  const pushAnimation = useStore((s) => s.pushAnimation);
  const ref = useRef<HTMLButtonElement>(null);
  const active = isFavorite(productId);

  const handleClick = (event: MouseEvent) => {
    event.stopPropagation();
    if (!active) {
      const rect = ref.current?.getBoundingClientRect();
      const reducedMotion =
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (rect && !reducedMotion) {
        pushAnimation({
          imageUrl: imageUrl ?? '',
          target: 'favorites',
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        });
      }
    }
    toggleFavorite(productId);
  };

  return (
    <button
      ref={ref}
      type="button"
      className={`favorite-btn${active ? ' favorite-btn--active' : ''}`}
      aria-label={active ? t('buyer.favorites.removeAria') : t('buyer.favorites.addAria')}
      aria-pressed={active}
      onClick={handleClick}
    >
      <Heart
        className="favorite-btn__icon"
        size={18}
        strokeWidth={2.5}
        fill={active ? 'currentColor' : 'none'}
      />
    </button>
  );
}
