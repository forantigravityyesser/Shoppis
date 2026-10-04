import type { StorefrontProductCard } from '../../../application/read-models/storefront';
import ProductGrid from './ProductGrid';

interface Props {
  products: StorefrontProductCard[];
  currencySymbol: string;
  onOpen: (id: string) => void;
  /** «Смотреть все →» — переход в Каталог. */
  onViewAll: () => void;
}

/**
 * Секция «Товары» на Главной: рендерит полученную страницу товарного потока +
 * «Смотреть все →» в Каталог. Лимит задаётся сервером в `useStorefrontHomeProducts`
 * (никакого «все товары + slice»). docs/15 §5.
 */
export default function ProductSection({ products, currencySymbol, onOpen, onViewAll }: Props) {
  if (!products.length) return null;

  return (
    <section className="home-section" aria-label="Товары">
      <div className="home-section__header">
        <h2 className="home-section__title">Товары</h2>
        <button type="button" className="home-section__all" onClick={onViewAll}>
          Смотреть все →
        </button>
      </div>
      <ProductGrid products={products} currencySymbol={currencySymbol} onOpen={onOpen} />
    </section>
  );
}
