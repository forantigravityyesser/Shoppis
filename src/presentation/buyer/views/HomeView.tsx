import { useState } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../../application/store';
import { useStorefrontHome } from '../../../application/hooks/useStorefrontHome';
import {
  HOME_PRODUCTS_PAGE_SIZE,
  useStorefrontHomeProducts,
} from '../../../application/hooks/useStorefrontHomeProducts';
import { useInfiniteScrollSentinel } from '../../shared/hooks/useInfiniteScrollSentinel';
import HomeHeader from '../components/HomeHeader';
import HomeBanner from '../components/HomeBanner';
import StoreDescriptionPopover from '../components/StoreDescriptionPopover';
import CategorySection from '../components/CategorySection';
import ProductSection from '../components/ProductSection';
import HomeSkeleton from '../components/HomeSkeleton';
import StoreStatusView from '../components/StoreStatusView';
import '../category.css';
import '../home.css';

/**
 * Главная витрины покупателя. Данные разделены: статичный контекст
 * (`useStorefrontHome`: store + категории) и товарный поток
 * (`useStorefrontHomeProducts`: первая страница с серверным лимитом).
 * Статус-гейт: loading → skeleton, не найдено / PAUSED → состояние,
 * ACTIVE → шапка, баннер, категории, товары. docs/15 §5-6.
 */
export default function HomeView() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const viewedStore = useStore((s) => s.viewedStore);
  const serverUser = useStore((s) => s.serverUser);
  const authLoading = useStore((s) => s.authLoading);

  const [descriptionOpen, setDescriptionOpen] = useState(false);

  const publicId = viewedStore?.publicId ?? null;
  const { home, loading, error, notFound, refresh } = useStorefrontHome(publicId);
  // Товарный поток включаем только для ACTIVE: PAUSED не должен тянуть products.
  // Опора на `viewedStore.status` до резолва контекста сохраняет параллельный
  // старт context+products (без waterfall); свежий `home.store.status` — приоритетнее.
  const storeActive = (home?.store.status ?? viewedStore?.status) === 'ACTIVE';
  const productStream = useStorefrontHomeProducts(publicId, HOME_PRODUCTS_PAGE_SIZE, storeActive);
  const sentinelRef = useInfiniteScrollSentinel({
    onLoadMore: productStream.loadMore,
    enabled:
      productStream.hasNextPage &&
      !productStream.fetchingNextPage &&
      !productStream.nextPageError,
  });

  const retry = () => {
    refresh();
    productStream.refresh();
  };

  // Поиск: синхронный переход (flushSync) внутри тапа, чтобы автофокус поля в
  // каталоге попал в пользовательский жест — иначе в Telegram/WebView клавиатура
  // не открывается. Работает вместе с useTransitions={false} (main.tsx).
  const openSearch = () => {
    flushSync(() => navigate('/catalog?focus=1'));
  };

  if (authLoading || loading || productStream.loading) {
    return <HomeSkeleton />;
  }

  const loadError = error ?? productStream.initialError;
  if (loadError) {
    return (
      <div className="home home-error">
        <div className="card card__muted">{t('buyer.home.loadError')}</div>
        <button type="button" className="home-retry" onClick={retry}>
          {t('common.retry')}
        </button>
      </div>
    );
  }

  if (notFound || !home) {
    return <StoreStatusView variant="notFound" />;
  }

  if (home.store.status === 'PAUSED') {
    return (
      <StoreStatusView
        variant="paused"
        storeName={home.store.name}
        logoUrl={viewedStore?.logoUrl ?? null}
        supportHandle={viewedStore?.supportHandle}
      />
    );
  }

  return (
    <div className="home">
      <HomeHeader
        storeName={home.store.name}
        storeDescription={home.store.description}
        descriptionOpen={descriptionOpen}
        buyerAvatarUrl={serverUser?.photoUrl ?? null}
        buyerName={serverUser?.firstName ?? ''}
        onSearch={openSearch}
        onProfile={() => navigate('/account')}
        onToggleDescription={() => setDescriptionOpen((v) => !v)}
      />
      <div className="home-sheet">
        {home.store.description ? (
          <StoreDescriptionPopover
            open={descriptionOpen}
            description={home.store.description}
            onClose={() => setDescriptionOpen(false)}
          />
        ) : null}
        <HomeBanner bannerUrl={home.store.bannerUrl} storeName={home.store.name} />
        <CategorySection
          categories={home.categories}
          onSelect={(categoryId) => navigate(`/catalog?category=${categoryId}`)}
          onViewAll={() => navigate('/catalog')}
        />
        <ProductSection
          products={productStream.products}
          currencySymbol={home.store.currencySymbol}
          onOpen={(productId) => navigate(`/product/${productId}`)}
          onViewAll={() => navigate('/catalog')}
        />
        {productStream.products.length > 0 ? (
          productStream.nextPageError ? (
            <div className="home-stream-error" role="alert" data-testid="home-stream-error">
              <span className="home-stream-error__text">{t('buyer.home.streamError')}</span>
              <button
                type="button"
                className="home-stream-error__retry"
                onClick={productStream.loadMore}
              >
                {t('common.retry')}
              </button>
            </div>
          ) : (
            <>
              <div
                ref={sentinelRef}
                className="home-stream-sentinel"
                aria-hidden
                data-testid="home-stream-sentinel"
              />
              {productStream.fetchingNextPage ? (
                <div
                  className="home-stream-loading"
                  role="status"
                  aria-label={t('buyer.home.loadingAria')}
                  data-testid="home-stream-loading"
                >
                  <span className="home-stream-spinner" aria-hidden />
                </div>
              ) : null}
            </>
          )
        ) : null}
      </div>
    </div>
  );
}
