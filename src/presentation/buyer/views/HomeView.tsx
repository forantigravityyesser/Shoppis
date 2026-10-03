import { useNavigate } from 'react-router';
import { useStore } from '../../../application/store';
import { useStorefrontHome } from '../../../application/hooks/useStorefrontHome';
import HomeHeader from '../components/HomeHeader';
import HomeBanner from '../components/HomeBanner';
import CategorySection from '../components/CategorySection';
import ProductSection from '../components/ProductSection';
import HomeSkeleton from '../components/HomeSkeleton';
import StoreStatusView from '../components/StoreStatusView';
import '../category.css';
import '../home.css';

/**
 * Главная витрины покупателя. Данные — одним запросом (`storefront_home_read`)
 * через `useStorefrontHome`. Статус-гейт: loading → skeleton, не найдено / PAUSED →
 * состояние, ACTIVE → шапка, белый лист: баннер + категории с фото + товары.
 */
export default function HomeView() {
  const navigate = useNavigate();
  const viewedStore = useStore((s) => s.viewedStore);
  const authLoading = useStore((s) => s.authLoading);

  const publicId = viewedStore?.publicId ?? null;
  const { home, loading, error, notFound, refresh } = useStorefrontHome(publicId);

  if (authLoading || loading) {
    return <HomeSkeleton />;
  }

  if (error) {
    return (
      <div className="home home-error">
        <div className="card card__muted">Не удалось загрузить магазин.</div>
        <button type="button" className="home-retry" onClick={refresh}>
          Повторить
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
        sellerAvatarUrl={home.store.sellerAvatarUrl}
        supportHandle={viewedStore?.supportHandle}
      />
    );
  }

  return (
    <div className="home">
      <HomeHeader
        storeName={home.store.name}
        sellerAvatarUrl={home.store.sellerAvatarUrl}
        onSearch={() => navigate('/catalog?focus=1')}
        onProfile={() => navigate('/account')}
      />
      <div className="home-sheet">
        <HomeBanner bannerUrl={home.store.bannerUrl} storeName={home.store.name} />
        <CategorySection
          categories={home.categories}
          onSelect={(categoryId) => navigate(`/catalog?category=${categoryId}`)}
          onViewAll={() => navigate('/catalog')}
        />
        <ProductSection
          products={home.products}
          currencySymbol={home.store.currencySymbol}
          onOpen={(productId) => navigate(`/product/${productId}`)}
          onViewAll={() => navigate('/catalog')}
        />
      </div>
    </div>
  );
}
