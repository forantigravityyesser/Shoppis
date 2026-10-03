import type { StorefrontProductCard } from '../../../application/read-models/storefront';
import ProductGrid from './ProductGrid';

/** Сколько карточек показываем на Главной (остальное — в Каталоге). docs/13 §2, §7. */
export const HOME_PRODUCTS_LIMIT = 6;

interface Props {
  products: StorefrontProductCard[];
  currencySymbol: string;
  onOpen: (id: string) => void;
  /** «Смотреть все →» — переход в Каталог. */
  onViewAll: () => void;
  limit?: number;
}

/**
 * Секция «Товары» на Главной: ограниченная подборка + «Смотреть все →» в Каталог.
 * Home остаётся лёгкой и продающей, весь ассортимент — в Каталоге. docs/13 §2, §7.
 */
export default function ProductSection({
  products,
  currencySymbol,
  onOpen,
  onViewAll,
  limit = HOME_PRODUCTS_LIMIT,
}: Props) {
  if (!products.length) return null;

  return (
    <section className="home-section" aria-label="Товары">
      <div className="home-section__header">
        <h2 className="home-section__title">Товары</h2>
        <button type="button" className="home-section__all" onClick={onViewAll}>
          Смотреть все →
        </button>
      </div>
      <ProductGrid
        products={products.slice(0, limit)}
        currencySymbol={currencySymbol}
        onOpen={onOpen}
      />
    </section>
  );
}
