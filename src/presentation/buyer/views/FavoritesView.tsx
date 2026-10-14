import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../../application/store';
import { useStorefrontHome } from '../../../application/hooks/useStorefrontHome';
import { useFavorites } from '../../../application/hooks/useFavorites';
import { useStorefrontFavoriteProducts } from '../../../application/hooks/useStorefrontFavoriteProducts';
import CatalogHeader from '../components/CatalogHeader';
import ProductGrid from '../components/ProductGrid';
import CatalogSkeleton from '../components/CatalogSkeleton';
import StoreStatusView from '../components/StoreStatusView';
import '../home.css';
import '../catalog.css';

/**
 * Избранное покупателя (store-scoped). Каркас переиспользует Каталог: та же шапка
 * (назад / название / профиль), тот же лист `.home-sheet`, тот же `ProductGrid` и
 * состояния. Данные — не store: локально хранятся только id (`favoritesByStore`),
 * а карточки гидрируются публичным read'ом по списку id
 * (`useStorefrontFavoriteProducts`). Снятие ♥ убирает карточку немедленно через
 * живой `ids`; клик по сердцу на карточке и в карточке товара уже пишут в тот же store.
 */
export default function FavoritesView() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const viewedStore = useStore((s) => s.viewedStore);
  const serverUser = useStore((s) => s.serverUser);
  const publicId = viewedStore?.publicId ?? null;

  const { ids } = useFavorites();
  const { home, loading, error, notFound, refresh } = useStorefrontHome(publicId);
  // Paused/closed store — не публичная товарная поверхность: не запускаем hydration,
  // пока магазин не ACTIVE (parity с Каталогом).
  const storeActive = home?.store.status === 'ACTIVE';
  const favorites = useStorefrontFavoriteProducts(publicId, ids, storeActive);

  const header = (
    <CatalogHeader
      title={t('buyer.favorites.title')}
      buyerAvatarUrl={serverUser?.photoUrl ?? null}
      buyerName={serverUser?.firstName ?? ''}
      onProfile={() => navigate('/account')}
    />
  );

  if (loading || favorites.loading) {
    return <CatalogSkeleton />;
  }

  if (error) {
    return (
      <div className="home">
        {header}
        <div className="home-sheet catalog-sheet">
          <div className="catalog-error" role="alert">
            <p className="catalog-error__title">{t('buyer.favorites.loadError')}</p>
            <p className="catalog-error__text">{t('buyer.catalog.loadErrorHint')}</p>
            <button type="button" className="home-retry" onClick={refresh}>
              {t('common.retry')}
            </button>
          </div>
        </div>
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

  const products = favorites.products;

  return (
    <div className="home">
      {header}
      <div className="home-sheet catalog-sheet">
        {favorites.error ? (
          <div className="catalog-error" role="alert" data-testid="favorites-error">
            <p className="catalog-error__title">{t('buyer.favorites.loadError')}</p>
            <p className="catalog-error__text">{t('buyer.catalog.loadErrorHint')}</p>
            <button type="button" className="home-retry" onClick={favorites.refresh}>
              {t('common.retry')}
            </button>
          </div>
        ) : products.length > 0 ? (
          <ProductGrid
            products={products}
            currencySymbol={home.store.currencySymbol}
            onOpen={(productId) => navigate(`/product/${productId}`)}
          />
        ) : (
          <div className="catalog-empty" role="status">
            <p className="catalog-empty__title">{t('buyer.favorites.emptyTitle')}</p>
            <p className="catalog-empty__text">{t('buyer.favorites.emptyText')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
