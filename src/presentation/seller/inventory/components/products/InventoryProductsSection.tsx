import { useMemo, useState } from 'react';
import { Package, Plus } from 'lucide-react';
import type { InventoryProductItem } from '../../../../../application/hooks/useInventory';
import InventoryProductSearch from './InventoryProductSearch';
import InventoryProductList from './InventoryProductList';

interface InventoryProductsSectionProps {
  products: InventoryProductItem[];
  onOpenProduct: (id: string) => void;
  onAddProduct: () => void;
}

/**
 * Секция «Товары» Inventory (секция по умолчанию, docs/19 §6, Phase D):
 * поиск по уже загруженному read-model + масштабируемый список + состояния.
 */
export default function InventoryProductsSection({
  products,
  onOpenProduct,
  onAddProduct,
}: InventoryProductsSectionProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((product) => product.title.toLowerCase().includes(q));
  }, [products, query]);

  return (
    <section className="inv-section">
      <div className="inv-section__head">
        <h2 className="inv-section__title">Товары</h2>
        <button type="button" className="inv-add-btn inv-add-btn--header" onClick={onAddProduct}>
          <Plus size={16} strokeWidth={2.5} />
          <span>Добавить</span>
        </button>
      </div>

      {products.length === 0 ? (
        <div className="inv-state inv-state--empty">
          <div className="inv-state__icon" aria-hidden>
            <Package size={40} strokeWidth={1.6} />
          </div>
          <p className="inv-state__title">Нет товаров</p>
          <button type="button" className="inv-add-btn" onClick={onAddProduct}>
            + Добавить товар
          </button>
        </div>
      ) : (
        <>
          <InventoryProductSearch value={query} onChange={setQuery} />
          {filtered.length === 0 ? (
            <div className="inv-state">
              <p className="inv-state__title">Ничего не найдено</p>
              <p className="inv-state__subtitle">Попробуйте изменить запрос</p>
            </div>
          ) : (
            <InventoryProductList products={filtered} onOpenProduct={onOpenProduct} />
          )}
        </>
      )}
    </section>
  );
}
