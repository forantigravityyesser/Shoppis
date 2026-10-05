import type {
  InventoryCategoryItem,
  InventoryProductItem,
} from '../../../../application/hooks/useInventory';
import CategoryCard from './CategoryCard';

interface CategoryGridProps {
  categories: InventoryCategoryItem[];
  productsByCategory: Record<string, InventoryProductItem[]>;
  onOpenCategory: (categoryId: string) => void;
  onOpenProduct: (productId: string) => void;
  onAddProduct: (categoryId: string) => void;
  /** 1-based позиции категорий в каталоге покупателя (по id). */
  positionsByCategory?: Record<string, number>;
  onReorderCategory?: (categoryId: string) => void;
}

/**
 * Список категорий полноширинными строками (docs/19 Phase E): каждая категория —
 * одна строка во всю ширину, визуал карточки не меняется. Порядок — порядок витрины.
 */
export default function CategoryGrid({
  categories,
  productsByCategory,
  onOpenCategory,
  onOpenProduct,
  onAddProduct,
  positionsByCategory,
  onReorderCategory,
}: CategoryGridProps) {
  return (
    <div className="inv-grid">
      {categories.map((category) => (
        <div className="inv-grid__row" key={category.id}>
          <CategoryCard
            category={category}
            previewProducts={productsByCategory[category.id] ?? []}
            position={positionsByCategory?.[category.id]}
            onOpen={() => onOpenCategory(category.id)}
            onOpenProduct={onOpenProduct}
            onAddProduct={() => onAddProduct(category.id)}
            onReorder={onReorderCategory ? () => onReorderCategory(category.id) : undefined}
          />
        </div>
      ))}
    </div>
  );
}
