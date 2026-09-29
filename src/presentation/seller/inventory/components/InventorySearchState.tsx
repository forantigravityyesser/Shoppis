import type {
  InventoryCategoryItem,
  InventoryProductItem,
} from '../../../../application/hooks/useInventory';
import { pluralRu } from '../layout';

interface InventorySearchStateProps {
  query: string;
  categories: InventoryCategoryItem[];
  products: InventoryProductItem[];
  categoryNameById: Record<string, string>;
  onOpenCategory: (categoryId: string) => void;
  onOpenProduct: (productId: string) => void;
}

/** Контекстный поиск внутри Inventory Home: категории + товары. Спека §30–31. */
export default function InventorySearchState({
  query,
  categories,
  products,
  categoryNameById,
  onOpenCategory,
  onOpenProduct,
}: InventorySearchStateProps) {
  if (!query.trim()) {
    return (
      <div className="inv-state inv-state--hint">
        <p className="inv-state__subtitle">Начните вводить название товара или категории</p>
      </div>
    );
  }

  if (categories.length === 0 && products.length === 0) {
    return (
      <div className="inv-state">
        <p className="inv-state__title">Ничего не найдено</p>
        <p className="inv-state__subtitle">Попробуйте изменить запрос</p>
      </div>
    );
  }

  return (
    <div className="inv-results">
      {categories.length > 0 ? (
        <section className="inv-results__group">
          <h2 className="inv-section__title">Категории</h2>
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              className="inv-result"
              onClick={() => onOpenCategory(category.id)}
            >
              <span className="inv-result__emoji" aria-hidden>
                {category.emoji}
              </span>
              <span className="inv-result__body">
                <span className="inv-result__title">{category.name}</span>
                <span className="inv-result__meta">
                  {category.productCount}{' '}
                  {pluralRu(category.productCount, ['товар', 'товара', 'товаров'])}
                </span>
              </span>
            </button>
          ))}
        </section>
      ) : null}

      {products.length > 0 ? (
        <section className="inv-results__group">
          <h2 className="inv-section__title">Товары</h2>
          {products.map((product) => (
            <button
              key={product.id}
              type="button"
              className="inv-result"
              onClick={() => onOpenProduct(product.id)}
            >
              <span className="inv-result__emoji" aria-hidden>
                {product.emoji || '📦'}
              </span>
              <span className="inv-result__body">
                <span className="inv-result__title">{product.title}</span>
                <span className="inv-result__meta">{productMeta(product, categoryNameById)}</span>
              </span>
            </button>
          ))}
        </section>
      ) : null}
    </div>
  );
}

function productMeta(
  product: InventoryProductItem,
  categoryNameById: Record<string, string>,
): string {
  if (product.stockState === 'out_of_stock') return 'Нет в наличии';
  if (product.stockState === 'hidden') return 'Скрыт';
  const category = product.categoryId ? categoryNameById[product.categoryId] : null;
  const stock =
    product.stockState === 'low_stock'
      ? `${product.stockAvailable} шт. · заканчивается`
      : `${product.stockAvailable} шт.`;
  return category ? `${category} · ${stock}` : stock;
}
