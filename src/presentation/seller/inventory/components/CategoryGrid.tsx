import type {
  InventoryCategoryItem,
  InventoryProductItem,
} from '../../../../application/hooks/useInventory';
import type { CategoryRow } from '../layout';
import CategoryCard from './CategoryCard';

interface CategoryGridProps {
  rows: CategoryRow[];
  productsByCategory: Record<string, InventoryProductItem[]>;
  onOpenCategory: (categoryId: string) => void;
  onOpenProduct: (productId: string) => void;
  onAddProduct: (categoryId: string) => void;
  onMoreCategory?: (categoryId: string) => void;
  /** 1-based позиции категорий в каталоге покупателя (по id). */
  positionsByCategory?: Record<string, number>;
  onReorderCategory?: (categoryId: string) => void;
}

/** Контролируемая композиция рядов: wide / pair. Порядок задаёт buildCategoryRows. */
export default function CategoryGrid({
  rows,
  productsByCategory,
  onOpenCategory,
  onOpenProduct,
  onAddProduct,
  onMoreCategory,
  positionsByCategory,
  onReorderCategory,
}: CategoryGridProps) {
  const renderCard = (category: InventoryCategoryItem, variant: 'wide' | 'compact') => (
    <CategoryCard
      key={category.id}
      category={category}
      previewProducts={productsByCategory[category.id] ?? []}
      variant={variant}
      position={positionsByCategory?.[category.id]}
      onOpen={() => onOpenCategory(category.id)}
      onOpenProduct={onOpenProduct}
      onAddProduct={() => onAddProduct(category.id)}
      onMore={onMoreCategory ? () => onMoreCategory(category.id) : undefined}
      onReorder={onReorderCategory ? () => onReorderCategory(category.id) : undefined}
    />
  );

  return (
    <div className="inv-grid">
      {rows.map((row) =>
        row.type === 'wide' ? (
          <div className="inv-grid__row" key={row.key}>
            {renderCard(row.category, 'wide')}
          </div>
        ) : (
          <div className="inv-grid__row inv-grid__row--pair" key={row.key}>
            {row.items.map((item) => renderCard(item, 'compact'))}
          </div>
        ),
      )}
    </div>
  );
}
