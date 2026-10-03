import { sellerAvatarInitial } from '../../../domain/rules/seller-avatar';
import { useImageFallback } from '../hooks/useImageFallback';

interface Props {
  id: string;
  name: string;
  imageUrl: string | null;
  active?: boolean;
  onSelect: (id: string) => void;
}

/**
 * Карточка категории с обложкой (для Каталога): фото + название под ним.
 * Без обложки — заглушка с первой буквой. docs/13 §7.
 */
export default function CategoryItem({ id, name, imageUrl, active = false, onSelect }: Props) {
  const { failed, onError } = useImageFallback(imageUrl);

  return (
    <button
      type="button"
      className={`category-item${active ? ' category-item--active' : ''}`}
      onClick={() => onSelect(id)}
      aria-label={name}
      aria-pressed={active}
    >
      {imageUrl && !failed ? (
        <img
          className="category-item__img"
          src={imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          onError={onError}
        />
      ) : (
        <span className="category-item__placeholder" aria-hidden>
          {sellerAvatarInitial(name)}
        </span>
      )}
      <span className="category-item__name">{name}</span>
    </button>
  );
}
