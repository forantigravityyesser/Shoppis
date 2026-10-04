import { useEffect, useMemo, useRef, useState } from 'react';
import { LayoutGrid } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';
import { useStore } from '../../../application/store';
import { useStorefrontHome } from '../../../application/hooks/useStorefrontHome';
import { useStorefrontHomeProducts } from '../../../application/hooks/useStorefrontHomeProducts';
import ProductGrid from '../components/ProductGrid';
import CategoryItem from '../components/CategoryItem';
import SearchBar from '../components/SearchBar';
import StoreStatusView from '../components/StoreStatusView';
import CatalogSkeleton from '../components/CatalogSkeleton';
import '../category.css';
import '../catalog.css';

/**
 * Прототип Каталога покупателя: поиск по названию, категории-чипы, сетка товаров.
 * Данные — контекст (`useStorefrontHome`) + первая (широкая) страница товаров
 * (`useStorefrontHomeProducts`), фильтрация на клиенте. Настоящий Каталог
 * (server-side search/filters/sort/pagination) — отдельная будущая feature
 * (docs/15 §8); здесь только поддерживаем работоспособность.
 */
// Прототип тянет одну широкую страницу того же RPC, что и Home; серверный потолок
// `p_limit` = 24 (HOME-FIX-02). Реальный Каталог получит свой paginated-RPC (docs/15 §8).
const CATALOG_PRODUCTS_LIMIT = 24;

export default function CatalogView() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const viewedStore = useStore((s) => s.viewedStore);
  const publicId = viewedStore?.publicId ?? null;
  const { home, loading, error, notFound, refresh } = useStorefrontHome(publicId);
  const productStream = useStorefrontHomeProducts(publicId, CATALOG_PRODUCTS_LIMIT);

  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(searchParams.get('category'));
  const inputRef = useRef<HTMLInputElement>(null);

  const shouldFocus = searchParams.get('focus') === '1';
  useEffect(() => {
    if (shouldFocus) inputRef.current?.focus();
  }, [shouldFocus]);

  const products = useMemo(() => {
    const list = productStream.products;
    const q = query.trim().toLowerCase();
    return list.filter(
      (p) =>
        (!categoryId || p.categoryId === categoryId) &&
        (!q || p.title.toLowerCase().includes(q)),
    );
  }, [productStream.products, query, categoryId]);

  if (loading || productStream.loading) {
    return <CatalogSkeleton />;
  }

  if (error ?? productStream.initialError) {
    return (
      <div className="catalog">
        <h1 className="catalog__title">Каталог</h1>
        <button
          type="button"
          className="home-retry"
          onClick={() => {
            refresh();
            productStream.refresh();
          }}
        >
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
        logoUrl={viewedStore?.logoUrl ?? null}
        supportHandle={viewedStore?.supportHandle}
      />
    );
  }

  return (
    <div className="catalog">
      <h1 className="catalog__title">Каталог</h1>
      <SearchBar ref={inputRef} value={query} onChange={setQuery} />

      {home.categories.length ? (
        <div className="category-row catalog__cats">
          <button
            type="button"
            className={`category-item${categoryId ? '' : ' category-item--active'}`}
            onClick={() => setCategoryId(null)}
            aria-label="Все"
            aria-pressed={!categoryId}
          >
            <span className="category-item__placeholder" aria-hidden>
              <LayoutGrid size={22} strokeWidth={2} />
            </span>
            <span className="category-item__name">Все</span>
          </button>
          {home.categories.map((category) => (
            <CategoryItem
              key={category.id}
              id={category.id}
              name={category.name}
              imageUrl={category.imageUrl}
              active={categoryId === category.id}
              onSelect={(id) => setCategoryId(id)}
            />
          ))}
        </div>
      ) : null}

      <ProductGrid
        products={products}
        currencySymbol={home.store.currencySymbol}
        onOpen={(productId) => navigate(`/product/${productId}`)}
      />
      {products.length === 0 ? <div className="catalog__empty">Ничего не найдено</div> : null}
    </div>
  );
}
