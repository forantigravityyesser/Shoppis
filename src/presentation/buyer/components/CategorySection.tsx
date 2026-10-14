import { useTranslation } from 'react-i18next';
import type { StorefrontCategory } from '../../../application/read-models/storefront';
import CategoryItem from './CategoryItem';

interface Props {
  categories: StorefrontCategory[];
  /** Тап по категории — Каталог с выбранной категорией. */
  onSelect: (id: string) => void;
  /** «Все →» — переход в Каталог. */
  onViewAll: () => void;
}

/**
 * Секция «Категории» на Главной: горизонтальная лента с обложками и названиями.
 * Заменяет «Popular Brands» прототипа. Если категорий нет — секция не рендерится.
 * docs/13 §7.
 */
export default function CategorySection({ categories, onSelect, onViewAll }: Props) {
  const { t } = useTranslation();
  if (!categories.length) return null;

  return (
    <section className="home-section" aria-label={t('buyer.home.sectionCategories')}>
      <div className="home-section__header">
        <h2 className="home-section__title">{t('buyer.home.sectionCategories')}</h2>
        <button type="button" className="home-section__all" onClick={onViewAll}>
          {t('buyer.home.viewAllCategories')}
        </button>
      </div>
      <div className="category-row">
        {categories.map((category) => (
          <CategoryItem
            key={category.id}
            id={category.id}
            name={category.name}
            imageUrl={category.imageUrl}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
}
