import { Heart } from 'lucide-react';
import { useFavorites } from '../../../application/hooks/useFavorites';

interface Props {
  productId: string;
}

/**
 * Сердце в белом контейнере, который визуально вырезает угол карточки.
 * Избранное store-scoped (zustand persist). Клик не открывает товар. docs/13 §9, §17.
 */
export default function FavoriteButton({ productId }: Props) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const active = isFavorite(productId);

  return (
    <button
      type="button"
      className={`favorite-btn${active ? ' favorite-btn--active' : ''}`}
      aria-label={active ? 'Убрать из избранного' : 'В избранное'}
      aria-pressed={active}
      onClick={(event) => {
        event.stopPropagation();
        toggleFavorite(productId);
      }}
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
