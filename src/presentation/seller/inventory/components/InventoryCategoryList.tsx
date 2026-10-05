import type {
  InventoryCategoryItem,
  InventoryProductItem,
} from '../../../../application/hooks/useInventory';
import InventoryCategoryRow from './InventoryCategoryRow';

interface InventoryCategoryListProps {
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
 * Список категорий полноширинными строками (docs/19 Phase E, docs/20 §3.3): каждая
 * категория — одна строка во всю ширину; это список, а не grid. Порядок — порядок витрины.
 */
export default function InventoryCategoryList({
  categories,
  productsByCategory,
  onOpenCategory,
  onOpenProduct,
  onAddProduct,
  positionsByCategory,
  onReorderCategory,
}: InventoryCategoryListProps) {
  return (
    <div className="inv-cat-list">
      {categories.map((category) => (
        <div className="inv-cat-row" key={category.id}>
          <InventoryCategoryRow
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
