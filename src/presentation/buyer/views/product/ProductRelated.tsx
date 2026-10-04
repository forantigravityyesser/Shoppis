import { useOutletContext } from 'react-router';
import type { StorefrontProductDetail } from '../../../../application/read-models/storefront-product';
import RelatedProducts from '../../components/product/RelatedProducts';

/**
 * Вкладка «Похожее» в карточке товара: сетка мини-карточек связанных товаров
 * (explicit links, без транзитивности). Пусто → пустое состояние. docs/14 §7.
 */
export default function ProductRelated() {
  const detail = useOutletContext<StorefrontProductDetail | undefined>();
  if (!detail) return null;

  const products = detail.relatedProducts;

  return (
    <section className="pd-related" data-testid="product-related">
      {products.length > 0 ? (
        <RelatedProducts products={products} currencySymbol={detail.store.currencySymbol} />
      ) : (
        <p className="pd-related__empty">Пока нет похожих товаров</p>
      )}
    </section>
  );
}
