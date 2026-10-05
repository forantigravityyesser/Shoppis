import { ChevronRight } from 'lucide-react';
import type { StorefrontCategory } from '../../../application/read-models/storefront';
import CategoryItem from './CategoryItem';
import '../category.css';

interface Props {
  categories: StorefrontCategory[];
  activeId: string | null;
  onSelect: (id: string) => void;
  /** Открыть «Все категории» (кнопка-стрелка в правом верхнем углу блока). */
  onViewAll: () => void;
}

const MAX_CATEGORIES = 8;

/**
 * Быстрый доступ к категориям каталога: сетка из 8 карточек того же вида, что на
 * главной (`CategoryItem` — фото/заглушка + название). Стрелка справа сверху
 * открывает «Все категории». docs/17 §4 (CAT-07c).
 */
export default function CatalogCategoryTiles({
  categories,
  activeId,
  onSelect,
  onViewAll,
}: Props) {
  const items = categories.slice(0, MAX_CATEGORIES);
  if (!items.length) return null;

  return (
    <div className="catalog-cats">
      <div className="catalog-cats__head">
        <button
          type="button"
          className="catalog-all-arrow"
          aria-label="Все категории"
          onClick={onViewAll}
        >
          <ChevronRight size={16} strokeWidth={2.6} />
        </button>
      </div>
      <div className="catalog-cats__grid">
        {items.map((category, index) => (
          <CategoryItem
            key={category.id}
            id={category.id}
            name={category.name}
            imageUrl={category.imageUrl}
            active={activeId === category.id}
            onSelect={onSelect}
            variant={index + 1}
          />
        ))}
      </div>
    </div>
  );
}
