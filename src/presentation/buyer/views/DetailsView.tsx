import { Share2, Star } from 'lucide-react';
import { NavLink, Outlet, useLocation, useParams } from 'react-router';
import { useStore } from '../../../application/store';
import { useStorefrontProduct } from '../../../application/hooks/useStorefrontProduct';
import BackButton from '../../shared/components/BackButton';
import StoreStatusView from '../components/StoreStatusView';
import ProductGallery from '../components/product/ProductGallery';
import VariantSelector from '../components/product/VariantSelector';
import DetailsCtaBar from '../components/product/DetailsCtaBar';
import ProductDetailSkeleton from '../components/product/ProductDetailSkeleton';
import ProductAbout from './product/ProductAbout';
import { useProductSelection } from '../hooks/useProductSelection';
import { useProductActions } from '../hooks/useProductActions';
import '../product-detail.css';

const TABS = [
  { to: '.', label: 'О товаре', key: 'about' },
  { to: 'reviews', label: 'Отзывы', key: 'reviews' },
  { to: 'questions', label: 'Вопросы', key: 'questions' },
  { to: 'related', label: 'Похожее', key: 'related' },
] as const;

/**
 * Product Detail shell (layout). Загружает публичную карточку
 * (`storefront_product_detail_read`) и рендерит каркас: фото (полэкрана) с
 * кнопками в углах, белый лист (миниатюры, название + рейтинг, варианты),
 * голубая панель вкладок и плавающий CTA. Оркестрация вынесена в
 * `useProductSelection` (вариант/цена/наличие) и `useProductActions`
 * (избранное/корзина/share) — docs/18 PD-H-15. docs/14 §2-3, §5, §15.
 */
export default function DetailsView() {
  const { id } = useParams<{ id: string }>();
  const { pathname } = useLocation();
  const viewedStore = useStore((s) => s.viewedStore);
  const authLoading = useStore((s) => s.authLoading);

  const publicId = viewedStore?.publicId ?? null;
  const { detail, loading, error, notFound, refresh } = useStorefrontProduct(publicId, id ?? null);

  const selection = useProductSelection(detail);
  const actions = useProductActions(detail, selection.selectedVariant);

  if (authLoading || loading) {
    return <ProductDetailSkeleton />;
  }

  if (error) {
    return (
      <div className="pd-root" data-testid="product-detail-shell" data-product-id={id}>
        <div className="pd-state">
          <div className="pd-state__icon" aria-hidden>
            😕
          </div>
          <h1 className="pd-state__title">Не удалось загрузить товар</h1>
          <button type="button" className="pd-retry" onClick={refresh}>
            Повторить
          </button>
        </div>
      </div>
    );
  }

  if (notFound || !detail) {
    return (
      <div className="pd-root" data-testid="product-detail-shell" data-product-id={id}>
        <div className="pd-state">
          <div className="pd-state__icon" aria-hidden>
            🔍
          </div>
          <h1 className="pd-state__title">Товар не найден</h1>
          <p className="pd-state__text">Возможно, товар снят с продажи или ссылка устарела.</p>
          <BackButton fallback="/" />
        </div>
      </div>
    );
  }

  if (detail.store.status === 'PAUSED') {
    return (
      <StoreStatusView
        variant="paused"
        storeName={detail.store.name}
        logoUrl={viewedStore?.logoUrl ?? null}
        supportHandle={viewedStore?.supportHandle}
      />
    );
  }

  // Нормализуем путь (снимаем trailing slash) — единообразно для CTA и слоя:
  // `/product/123/` ведёт себя как `/product/123` (PD-R-03).
  const path = pathname.replace(/\/+$/, '') || '/';
  // Слой Отзывов/Вопросов — оверлей поверх shell; «О товаре» остаётся под ним,
  // поэтому позиция скролла карточки сохраняется (docs/14 §3.3).
  const isLayer = /^\/product\/[^/]+\/(reviews|questions)$/.test(path);
  // CTA (избранное + цена + «в корзину») — только на корневом экране товара.
  const showCta = path === `/product/${id}`;

  return (
    <div className="pd-root">
      <div className="pd" data-testid="product-detail-shell" data-product-id={id}>
        <div className="pd__media">
          <header className="pd__header">
            <BackButton fallback="/" />
            <button
              type="button"
              className="pd-icon-btn"
              aria-label="Поделиться"
              onClick={actions.share}
            >
              <Share2 size={20} />
            </button>
          </header>
          <ProductGallery
            key={detail.product.id}
            images={detail.images}
            title={detail.product.title}
          />
        </div>

        <div className="pd__sheet">
          <div className="pd__identity">
            <h1 className="pd__title">{detail.product.title}</h1>
            <span className="pd__rating" data-testid="product-rating">
              <Star size={13} fill="currentColor" strokeWidth={0} aria-hidden />
              {detail.rating.count > 0
                ? `${detail.rating.average.toFixed(1)} (${detail.rating.count})`
                : '0'}
            </span>
          </div>

          {detail.linkAttributes.length > 0 ? (
            <div className="pd-link-attrs" data-testid="product-link-attrs">
              {detail.linkAttributes.map((attr, index) => (
                <span className="pd-link-attr" key={`${attr.name}-${index}`}>
                  {attr.name}: <strong>{attr.value}</strong>
                </span>
              ))}
            </div>
          ) : null}

          <VariantSelector
            variants={detail.variants}
            selectedId={selection.selectedVariantId}
            onSelect={selection.selectVariant}
          />
        </div>

        <div className="pd__panel">
          <nav className="pd__tabs">
            {TABS.map((tab) => (
              <NavLink
                key={tab.key}
                to={tab.to}
                end
                className={({ isActive }) => (isActive ? 'pd__tab pd__tab--active' : 'pd__tab')}
              >
                {tab.label}
              </NavLink>
            ))}
          </nav>

          <div className="pd__content">
            {isLayer ? <ProductAbout detail={detail} /> : <Outlet context={detail} />}
          </div>

          {/* Слой Отзывов/Вопросов — оверлей (портал); «О товаре» остаётся под ним. */}
          {isLayer ? <Outlet context={detail} /> : null}
        </div>

        {showCta ? (
          <DetailsCtaBar
            priceLabel={selection.priceLabel || '—'}
            originalPriceLabel={selection.originalPriceLabel}
            soldOut={selection.soldOut}
            canAdd={selection.canAdd}
            isFavorite={actions.isFavorite}
            onToggleFavorite={actions.toggleFavorite}
            onAddToCart={actions.addToCart}
          />
        ) : null}
      </div>
    </div>
  );
}
