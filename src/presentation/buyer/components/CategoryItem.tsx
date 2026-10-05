import { getInitial } from '../../../domain/rules/initial';
import SafeImage from './SafeImage';

interface Props {
  id: string;
  name: string;
  imageUrl: string | null;
  active?: boolean;
  onSelect: (id: string) => void;
  /** Цвет-заглушка по позиции (1..8), когда нет обложки; иначе — базовый. */
  variant?: number;
}

/**
 * Карточка категории с обложкой (для Home и Каталога): фото + название под ним.
 * Без обложки — заглушка с первой буквой; в каталоге заглушка красится по позиции
 * слота (`variant`, 1..8). docs/13 §7, docs/15 §7.3, docs/17 §4.
 */
export default function CategoryItem({
  id,
  name,
  imageUrl,
  active = false,
  onSelect,
  variant,
}: Props) {
  return (
    <button
      type="button"
      className={`category-item${active ? ' category-item--active' : ''}`}
      onClick={() => onSelect(id)}
      aria-label={name}
      aria-pressed={active}
    >
      <SafeImage
        src={imageUrl}
        alt=""
        className="category-item__img"
        fallback={
          <span
            className={`category-item__placeholder${
              variant ? ` category-item__placeholder--${((variant - 1) % 8) + 1}` : ''
            }`}
            aria-hidden
          >
            {getInitial(name)}
          </span>
        }
      />
      <span className="category-item__name">{name}</span>
    </button>
  );
}
