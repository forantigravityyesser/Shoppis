import { useState } from 'react';
import { Share2, Star } from 'lucide-react';
import { NavLink, Outlet, useLocation, useParams } from 'react-router';
import { useStore } from '../../../application/store';
import { useStorefrontProduct } from '../../../application/hooks/useStorefrontProduct';
import { useStorefrontLink } from '../../../application/hooks/useStorefrontLink';
import { useOpenTelegramLink } from '../../../application/hooks/useOpenTelegramLink';
import { useHaptic } from '../../../application/hooks/useHaptic';
import { useFavorites } from '../../../application/hooks/useFavorites';
import { useCart } from '../../../application/hooks/useCart';
import { formatMoneyMinor } from '../../../domain/rules/product-rules';
import BackButton from '../../shared/components/BackButton';
import StoreStatusView from '../components/StoreStatusView';
import ProductGallery from '../components/product/ProductGallery';
import VariantSelector from '../components/product/VariantSelector';
import DetailsCtaBar from '../components/product/DetailsCtaBar';
import ProductDetailSkeleton from '../components/product/ProductDetailSkeleton';
import ProductAbout from './product/ProductAbout';
import '../product-detail.css';

const TABS = [
  { to: '.', label: 'О товаре', key: 'about' },
  { to: 'reviews', label: 'Отзывы', key: 'reviews' },
  { to: 'questions', label: 'Вопросы', key: 'questions' },
  { to: 'related', label: 'Похожее', key: 'related' },
] as const;

/**
 * Product Detail shell (layout). Загружает публичную карточку
 * (`storefront_product_detail_read`) и держит каркас под эскиз: фото (полэкрана)
 * с кнопками в углах, белый лист (миниатюры, название + рейтинг, варианты),
 * голубая панель вкладок и плавающий CTA. Интерактив галереи — PD-06; выбор
 * варианта/цены/наличия — PD-07 (здесь): `selectedVariantId`, sold-out disabled,
 * цена в CTA меняется по варианту. docs/14 §2-3, §5, §15.
 */
export default function DetailsView() {
  const { id } = useParams<{ id: string }>();
  const { pathname } = useLocation();
  const viewedStore = useStore((s) => s.viewedStore);
  const authLoading = useStore((s) => s.authLoading);

  const publicId = viewedStore?.publicId ?? null;
  const { detail, loading, error, notFound, refresh } = useStorefrontProduct(publicId, id ?? null);

  const storefrontUrl = useStorefrontLink(publicId ?? '');
  const openTelegramLink = useOpenTelegramLink();
  const { selectTick, notifySuccess } = useHaptic();
  const showToast = useStore((s) => s.showToast);
  const { isFavorite, toggleFavorite } = useFavorites();
  const { addToCart } = useCart();

  // Выбор варианта привязан к товару: при переходе на другой товар сбрасывается
  // во время рендера (сравнение productId), без setState в эффекте.
  const productId = detail?.product.id ?? null;
  const [variantChoice, setVariantChoice] = useState<{
    productId: string | null;
    variantId: string;
  } | null>(null);

  const handleShare = () => {
    if (!detail) return;
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(
      storefrontUrl,
    )}&text=${encodeURIComponent(detail.product.title)}`;
    openTelegramLink(shareUrl);
  };

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

  const symbol = detail.store.currencySymbol;
  // Дефолт — первый доступный вариант; выбор пользователя имеет приоритет.
  const defaultVariant = detail.variants.find((v) => v.available) ?? detail.variants[0] ?? null;
  const selectedVariantId =
    variantChoice && variantChoice.productId === productId ? variantChoice.variantId : null;
  const selectedVariant = detail.variants.find((v) => v.id === selectedVariantId) ?? defaultVariant;
  const priceLabel = selectedVariant ? formatMoneyMinor(selectedVariant.price, symbol) : '';
  const originalPriceLabel =
    selectedVariant?.originalPrice != null
      ? formatMoneyMinor(selectedVariant.originalPrice, symbol)
      : null;
  const soldOut = detail.variants.length > 0 && detail.variants.every((v) => !v.available);
  const canAdd = Boolean(selectedVariant?.available);
  const favorite = isFavorite(detail.product.id);
  // Слой Отзывов/Вопросов — оверлей поверх shell; «О товаре» остаётся под ним,
  // поэтому позиция скролла карточки сохраняется (docs/14 §3.3).
  const isLayer = /^\/product\/[^/]+\/(reviews|questions)\/?$/.test(pathname);
  // CTA (избранное + цена + «в корзину») — только на корневом экране товара.
  // На вложенных разделах (Отзывы/Вопросы/Похожее) его нет; слой закрывается
  // анимацией, и CTA появляется ровно в момент перехода на «О товаре».
  const showCta = pathname === `/product/${id}`;

  const handleSelectVariant = (variantId: string) => {
    selectTick();
    setVariantChoice({ productId, variantId });
  };

  const handleToggleFavorite = () => {
    selectTick();
    toggleFavorite(detail.product.id);
  };

  const handleAddToCart = () => {
    if (!selectedVariant?.available) return;
    // Cart ничего не резервирует; финальная проверка — на checkout.
    addToCart({
      productId: detail.product.id,
      productVariantId: selectedVariant.id,
      quantity: 1,
      price: selectedVariant.price,
    });
    notifySuccess();
    showToast({
      text: 'Добавлено в корзину',
      imageUrl: detail.images[0]?.thumbUrl ?? detail.images[0]?.url ?? null,
    });
  };

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
              onClick={handleShare}
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
            selectedId={selectedVariant?.id ?? null}
            onSelect={handleSelectVariant}
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
            priceLabel={priceLabel || '—'}
            originalPriceLabel={originalPriceLabel}
            soldOut={soldOut}
            canAdd={canAdd}
            isFavorite={favorite}
            onToggleFavorite={handleToggleFavorite}
            onAddToCart={handleAddToCart}
          />
        ) : null}
      </div>
    </div>
  );
}
