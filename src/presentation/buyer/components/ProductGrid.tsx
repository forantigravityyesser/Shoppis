import type { StorefrontProductCard } from '../../../application/read-models/storefront';
import ProductCard from './ProductCard';

interface Props {
  products: StorefrontProductCard[];
  currencySymbol: string;
  onOpen: (id: string) => void;
}

/** Сетка карточек товаров в 2 колонки. docs/13 §9. */
export default function ProductGrid({ products, currencySymbol, onOpen }: Props) {
  if (!products.length) return null;

  return (
    <div className="product-grid">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          currencySymbol={currencySymbol}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}
