import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { InventoryProductItem } from '../../../../application/hooks/useInventory';
import { currencySymbol } from '../../../../domain/constants/currencies';
import { formatMoneyMinor } from '../../../../domain/rules/product-rules';
import BottomSheet from '../../../shared/components/BottomSheet';
import SafeImage from '../../../buyer/components/SafeImage';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Все товары магазина, кроме текущего. */
  products: InventoryProductItem[];
  /** id товаров, уже связанных с текущим. */
  linkedIds: Set<string>;
  /** id товара, по которому идёт операция (для блокировки кнопки). */
  pendingId: string | null;
  onToggle: (productId: string) => void;
}

/**
 * Bottom sheet «Связи»: поиск по всем товарам магазина + связать/убрать.
 * Связь двусторонняя и без транзитивности: товары появятся друг у друга в «Похожее».
 * docs/14 §7 (PD-14b).
 */
export default function LinkProductsSheet({
  open,
  onClose,
  products,
  linkedIds,
  pendingId,
  onToggle,
}: Props) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.title.toLowerCase().includes(q));
  }, [products, query]);

  return (
    <BottomSheet open={open} onClose={onClose}>
      <h2 className="sheet__title">Связи</h2>
      <p className="link-sheet__hint">
        Выберите товары — они появятся друг у друга в разделе «Похожее».
      </p>

      <label className="link-sheet__search">
        <Search size={16} aria-hidden />
        <input
          className="link-sheet__input"
          type="search"
          placeholder="Поиск товара"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>

      {filtered.length === 0 ? (
        <p className="link-sheet__empty">Ничего не найдено</p>
      ) : (
        <ul className="link-sheet__list">
          {filtered.map((product) => {
            const linked = linkedIds.has(product.id);
            return (
              <li className="link-item" key={product.id}>
                <span className="link-item__thumb" aria-hidden>
                  <SafeImage
                    src={product.imageUrl}
                    alt=""
                    fallback={<span className="link-item__emoji">{product.emoji || '📦'}</span>}
                  />
                </span>
                <span className="link-item__body">
                  <span className="link-item__title">{product.title}</span>
                  <span className="link-item__price">
                    {formatMoneyMinor(product.priceMinor, currencySymbol(product.currency))}
                  </span>
                </span>
                <button
                  type="button"
                  className={`link-item__toggle${linked ? ' link-item__toggle--on' : ''}`}
                  disabled={pendingId === product.id}
                  onClick={() => onToggle(product.id)}
                >
                  {linked ? 'Убрать' : 'Связать'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </BottomSheet>
  );
}
