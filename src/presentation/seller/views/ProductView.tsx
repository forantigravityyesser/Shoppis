import { Suspense, useEffect, useRef, useState } from 'react';
import { Eye } from 'lucide-react';
import { NavLink, Outlet, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useProductDetail } from '../../../application/hooks/useProduct';
import { useProductPreview } from '../../../application/hooks/useProductPreview';
import {
  useSellerProductQuestions,
  useSellerProductReviews,
} from '../../../application/hooks/useSellerProductSocial';
import { useSeenReviewIds } from '../../../application/hooks/useSellerSocialSeen';
import { useStore } from '../../../application/store';
import { currencySymbol } from '../../../domain/constants/currencies';
import { formatMoneyMinor } from '../../../domain/rules/product-rules';
import BackButton from '../../shared/components/BackButton';
import ScreenLoader from '../../shared/components/ScreenLoader';
import { useResetScroll } from '../../shared/hooks/useResetScroll';
import { useStuck } from '../../shared/hooks/useStuck';
import '../inventory/inventory.css';

/**
 * Карточка товара: стеклянная шапка (галерея, цена, статус) + таб-бар.
 * Контент вкладок рендерится через <Outlet/> (вложенные роуты /reviews, /questions, /preview).
 *
 * Индикаторы вкладок (правка заказчика, docs/19 §24–27):
 * — «Отзывы»: число непросмотренных; при заходе на вкладку обнуляется.
 * — «Вопросы»: число вопросов без ответа; просмотренным считается отвеченный.
 */
export default function ProductView() {
  const { t } = useTranslation();
  const currentStore = useStore((s) => s.currentStore);
  const { openProductPreview } = useProductPreview();
  const { productId = '' } = useParams();
  const { product, loading } = useProductDetail(productId);
  const productKey = productId || null;
  const { reviews } = useSellerProductReviews(productKey);
  const { questions } = useSellerProductQuestions(productKey);
  const seenReviewIds = useSeenReviewIds(productKey);
  const [imageIndex, setImageIndex] = useState(0);

  const tabs = [
    { to: '', label: t('seller.product.tabs.card'), end: true },
    { to: 'reviews', label: t('seller.product.tabs.reviews'), end: false },
    { to: 'questions', label: t('seller.product.tabs.questions'), end: false },
    { to: 'preview', label: t('seller.product.tabs.storefront'), end: false },
  ];

  // «Назад» залипает в левом верхнем углу при скролле (визуал как в других вкладках).
  const headerRef = useRef<HTMLElement>(null);
  const stuck = useStuck(headerRef);

  // Экран-деталь всегда открывается сверху (не переносим скролл с инвентаря).
  const rootRef = useRef<HTMLDivElement>(null);
  useResetScroll(rootRef, product?.id);

  // Предзагружаем чанки разделов карточки: переключение Отзывы/Вопросы/Витрина
  // происходит без «пустого» экрана (lazy уже загружен).
  useEffect(() => {
    void import('./ProductReviewsView').catch(() => undefined);
    void import('./ProductQuestionsView').catch(() => undefined);
    void import('./ProductPreviewView').catch(() => undefined);
  }, []);

  const unreadReviews = reviews.filter((review) => !seenReviewIds.has(review.id)).length;
  const openQuestions = questions.filter((question) => question.answer === null).length;
  const badges: Record<string, number> = {
    reviews: unreadReviews,
    questions: openQuestions,
  };

  if (!product) {
    return (
      <div className="screen">
        <div className="screen__header screen__header--row">
          <BackButton fallback="/seller/inventory" />
          <h1 className="screen__title">{t('seller.product.title')}</h1>
        </div>
        <div className="card card__muted">
          {loading ? t('common.loading') : t('seller.product.notFound')}
        </div>
      </div>
    );
  }

  const base = `/seller/inventory/product/${product.id}`;
  const images = product.images;
  const activeImage = images[Math.min(imageIndex, images.length - 1)] ?? null;
  // Предпросмотр «как покупатель» доступен только для товара на активной
  // витрине: storefront-read не отдаёт архивные товары и магазин на паузе.
  const canPreview =
    product.status === 'ACTIVE' &&
    currentStore?.status === 'ACTIVE' &&
    Boolean(currentStore?.publicId);

  return (
    <div className="screen prod" ref={rootRef}>
      <div className="sticky-rail sticky-rail--start">
        <BackButton
          fallback="/seller/inventory"
          className={stuck ? 'back-btn--floating' : undefined}
        />
      </div>
      <header className="prod-head" ref={headerRef}>
        <span className="screen__header-spacer" aria-hidden />
        <h1 className="prod-head__title">{product.title}</h1>
        <span className={`prod-status prod-status--${product.status.toLowerCase()}`}>
          {product.status === 'ACTIVE'
            ? t('seller.product.statusActive')
            : t('seller.product.statusArchived')}
        </span>
      </header>

      <section className="glass prod-hero">
        <div className="prod-hero__media">
          {activeImage ? (
            <img
              className="prod-hero__img"
              src={activeImage.thumbUrl ?? activeImage.url}
              alt=""
              decoding="async"
              fetchPriority="high"
            />
          ) : (
            <span className="prod-hero__emoji">{product.emoji}</span>
          )}
        </div>
        <div className="prod-hero__info">
          <div className="prod-hero__price-row">
            <div className="prod-hero__price">
              {formatMoneyMinor(product.priceMinor, currencySymbol(product.currency))}
              {product.discountPercent > 0 ? (
                <span className="prod-hero__discount">−{product.discountPercent}%</span>
              ) : null}
            </div>
            {canPreview ? (
              <button
                type="button"
                className="prod-hero__preview"
                data-tour="product-preview"
                aria-label={t('seller.product.previewAsBuyer')}
                title={t('seller.product.previewAsBuyer')}
                onClick={() => openProductPreview(product.id, base)}
              >
                <Eye size={18} />
              </button>
            ) : null}
          </div>
          <div className="prod-hero__meta">
            <span>{product.categoryName}</span>
          </div>
          {product.description ? <p className="prod-hero__desc">{product.description}</p> : null}
        </div>
      </section>

      {images.length > 1 ? (
        <div className="prod-thumbs">
          {images.map((image, index) => (
            <button
              key={image.url}
              type="button"
              className={`prod-thumb${index === imageIndex ? ' prod-thumb--active' : ''}`}
              onClick={() => setImageIndex(index)}
              aria-label={t('seller.product.photoAria', { number: index + 1 })}
            >
              <img src={image.thumbUrl ?? image.url} alt="" loading="lazy" decoding="async" />
            </button>
          ))}
        </div>
      ) : null}

      <nav className="glass prod-tabs">
        {tabs.map((tab) => {
          const badge = badges[tab.to] ?? 0;
          return (
            <NavLink
              key={tab.label}
              to={tab.to ? `${base}/${tab.to}` : base}
              end={tab.end}
              replace
              className={({ isActive }) => `prod-tab${isActive ? ' prod-tab--active' : ''}`}
            >
              <span>{tab.label}</span>
              {badge > 0 ? (
                <span
                  className="prod-tab__badge"
                  aria-label={t('seller.product.newBadge', { count: badge })}
                >
                  {badge > 99 ? '99+' : badge}
                </span>
              ) : null}
            </NavLink>
          );
        })}
      </nav>

      <Suspense fallback={<ScreenLoader compact />}>
        <Outlet />
      </Suspense>
    </div>
  );
}
