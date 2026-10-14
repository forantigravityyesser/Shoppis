import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  if (!products.length) return null;

  return (
    <section className="home-section" aria-label={t('buyer.home.sectionProducts')}>
      <div className="home-section__header">
        <h2 className="home-section__title">{t('buyer.home.sectionProducts')}</h2>
        <button type="button" className="home-section__all" onClick={onViewAll}>
          {t('buyer.home.viewAllProducts')}
        </button>
      </div>
      <ProductGrid products={products} currencySymbol={currencySymbol} onOpen={onOpen} />
    </section>
  );
}
