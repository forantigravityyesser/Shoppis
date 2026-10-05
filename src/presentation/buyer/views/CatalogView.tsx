import { useCallback, useEffect, useRef, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';
import { useStore } from '../../../application/store';
import { useStorefrontHome } from '../../../application/hooks/useStorefrontHome';
import { useStorefrontCatalog } from '../../../application/hooks/useStorefrontCatalog';
import { useStorefrontCatalogPriceBounds } from '../../../application/hooks/useStorefrontCatalogPriceBounds';
import { formatMoneyMinor } from '../../../domain/rules/product-rules';
import { useInfiniteScrollSentinel } from '../hooks/useInfiniteScrollSentinel';
import ProductGrid from '../components/ProductGrid';
import CatalogCategoryTiles from '../components/CatalogCategoryTiles';
import CatalogHeader from '../components/CatalogHeader';
import CatalogFilterSheet from '../components/CatalogFilterSheet';
import CatalogAppliedFilters from '../components/CatalogAppliedFilters';
import AllCategoriesSheet from '../components/AllCategoriesSheet';
import SearchBar from '../components/SearchBar';
import StoreStatusView from '../components/StoreStatusView';
import CatalogSkeleton from '../components/CatalogSkeleton';
import '../home.css';
import '../catalog.css';

/** Задержка дебаунса поиска: URL/запрос обновляются после паузы ввода. docs/17 §4 (CAT-08). */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Каталог покупателя: server-driven (категория/поиск/цена/пагинация — на сервере).
 * Визуал и фон — от Home (`.home` + `.home-sheet`). Шапка: назад / название / профиль.
 * URL — источник истины: `category`, `q`, `minPrice`, `maxPrice` (docs/17 §2.8).
 * Поиск дебаунсится (300ms), фильтр цены применяется по кнопке (CAT-09).
 */
export default function CatalogView() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const viewedStore = useStore((s) => s.viewedStore);
  const serverUser = useStore((s) => s.serverUser);
  const publicId = viewedStore?.publicId ?? null;

  const categoryId = searchParams.get('category');
  const search = searchParams.get('q') ?? '';
  const minPrice = parsePriceParam(searchParams.get('minPrice'));
  const maxPrice = parsePriceParam(searchParams.get('maxPrice'));

  const { home, loading, error, notFound, refresh } = useStorefrontHome(publicId);
  // Paused/closed store — не публичная товарная поверхность: не запускаем ни товары,
  // ни границы цен, пока магазин не ACTIVE (defense-in-depth к guard в 0030).
  const storeActive = home?.store.status === 'ACTIVE';
  const catalog = useStorefrontCatalog(
    publicId,
    { categoryId, search, minPrice, maxPrice },
    undefined,
    storeActive,
  );
  const {
    bounds,
    loading: boundsLoading,
    error: boundsError,
    refresh: refreshBounds,
  } = useStorefrontCatalogPriceBounds(publicId, storeActive);

  const sentinelRef = useInfiniteScrollSentinel({
    onLoadMore: catalog.loadMore,
    enabled: catalog.hasNextPage && !catalog.fetchingNextPage && !catalog.nextPageError,
  });

  const [allOpen, setAllOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchDraft, setSearchDraft] = useState(search);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<number | null>(null);
  // Актуальные URL-параметры для debounced-записи (не устаревают при паузе ввода).
  const paramsRef = useRef(searchParams);
  useEffect(() => {
    paramsRef.current = searchParams;
  }, [searchParams]);

  // Внешнее изменение `q` (back/forward, переход с Home, ссылка) синхронизирует поле:
  // URL — источник истины. Заодно снимаем отложенную запись, чтобы старый debounce
  // не перетёр только что пришедшее внешнее значение.
  useEffect(() => {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    setSearchDraft(search);
  }, [search]);

  const shouldFocus = searchParams.get('focus') === '1';
  useEffect(() => {
    if (!shouldFocus) return;
    inputRef.current?.focus();
    // `focus` одноразовый: убираем из URL, чтобы возврат из товара не открывал
    // клавиатуру повторно (Back должен вернуть каталог в прежнем виде). docs/17 CAT-13.
    const next = new URLSearchParams(searchParams);
    next.delete('focus');
    setSearchParams(next, { replace: true });
  }, [shouldFocus, searchParams, setSearchParams]);

  // Снимаем отложенную запись при уходе с экрана.
  useEffect(
    () => () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    },
    [],
  );

  const setParams = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(paramsRef.current);
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === '') next.delete(key);
        else next.set(key, value);
      }
      next.delete('focus');
      setSearchParams(next, { replace: true });
    },
    [setSearchParams],
  );

  const onSearchChange = (value: string) => {
    setSearchDraft(value);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    // Очистку применяем сразу — без лишнего сетевого запроса на пустой строке.
    if (value.trim() === '') {
      setParams({ q: null });
      return;
    }
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null;
      setParams({ q: value });
    }, SEARCH_DEBOUNCE_MS);
  };

  const header = (
    <CatalogHeader
      title="Каталог"
      buyerAvatarUrl={serverUser?.photoUrl ?? null}
      buyerName={serverUser?.firstName ?? ''}
      onProfile={() => navigate('/account')}
    />
  );

  if (loading || catalog.loading) {
    return <CatalogSkeleton />;
  }

  if (error ?? catalog.initialError) {
    return (
      <div className="home">
        {header}
        <div className="home-sheet">
          <div className="catalog-error" role="alert">
            <p className="catalog-error__title">Не удалось загрузить каталог</p>
            <p className="catalog-error__text">Проверьте соединение и попробуйте снова.</p>
            <button
              type="button"
              className="home-retry"
              onClick={() => {
                refresh();
                catalog.refresh();
              }}
            >
              Повторить
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

  const products = catalog.products;
  const priceActive = minPrice != null || maxPrice != null;
  const categoryName = categoryId
    ? (home.categories.find((c) => c.id === categoryId)?.name ?? 'Категория')
    : null;
  const priceLabel = buildPriceLabel(minPrice, maxPrice, home.store.currencySymbol);

  return (
    <div className="home">
      {header}
      <div className="home-sheet catalog-sheet">
        {home.categories.length ? (
          <CatalogCategoryTiles
            categories={home.categories}
            activeId={categoryId}
            onSelect={(id) => setParams({ category: id })}
            onViewAll={() => setAllOpen(true)}
          />
        ) : null}

        <div className="catalog-search-row">
          <SearchBar ref={inputRef} value={searchDraft} onChange={onSearchChange} />
          <button
            type="button"
            className={`catalog-filter-btn${priceActive ? ' catalog-filter-btn--active' : ''}`}
            aria-label="Фильтры"
            aria-pressed={priceActive}
            onClick={() => setFilterOpen(true)}
          >
            <SlidersHorizontal size={20} strokeWidth={2.4} />
            {priceActive ? <span className="catalog-filter-btn__dot" aria-hidden /> : null}
          </button>
        </div>

        <CatalogAppliedFilters
          categoryName={categoryName}
          priceLabel={priceLabel}
          onRemoveCategory={() => setParams({ category: null })}
          onRemovePrice={() => setParams({ minPrice: null, maxPrice: null })}
        />

        <div
          className={`catalog-results${catalog.updating ? ' catalog-results--updating' : ''}`}
          aria-busy={catalog.updating}
        >
          <ProductGrid
            products={products}
            currencySymbol={home.store.currencySymbol}
            onOpen={(productId) => navigate(`/product/${productId}`)}
          />
          {catalog.updating ? (
            <div
              className="catalog-updating"
              role="status"
              aria-label="Обновление каталога"
              data-testid="catalog-updating"
            >
              <span className="home-stream-spinner" aria-hidden />
            </div>
          ) : null}
        </div>
        {products.length > 0 ? (
          catalog.nextPageError ? (
            <div className="home-stream-error" role="alert" data-testid="catalog-stream-error">
              <span className="home-stream-error__text">Не удалось загрузить ещё товары</span>
              <button type="button" className="home-stream-error__retry" onClick={catalog.loadMore}>
                Повторить
              </button>
            </div>
          ) : (
            <>
              <div
                ref={sentinelRef}
                className="home-stream-sentinel"
                aria-hidden
                data-testid="catalog-stream-sentinel"
              />
              {catalog.fetchingNextPage ? (
                <div
                  className="home-stream-loading"
                  role="status"
                  aria-label="Загрузка товаров"
                  data-testid="catalog-stream-loading"
                >
                  <span className="home-stream-spinner" aria-hidden />
                </div>
              ) : null}
            </>
          )
        ) : null}
        {products.length === 0 ? (
          <div className="catalog-empty" role="status">
            {search ? (
              <>
                <p className="catalog-empty__title">Ничего не нашлось</p>
                <p className="catalog-empty__text">
                  По запросу «{search}» товаров нет. Попробуйте изменить запрос.
                </p>
              </>
            ) : priceActive ? (
              <>
                <p className="catalog-empty__title">Нет товаров в этом диапазоне</p>
                <p className="catalog-empty__text">Попробуйте изменить фильтр по цене.</p>
              </>
            ) : categoryId ? (
              <>
                <p className="catalog-empty__title">В этой категории пока нет товаров</p>
                <p className="catalog-empty__text">Загляните в другие категории.</p>
              </>
            ) : (
              <>
                <p className="catalog-empty__title">Товаров пока нет</p>
                <p className="catalog-empty__text">В этом магазине пока нечего показать.</p>
              </>
            )}
          </div>
        ) : null}
      </div>

      <AllCategoriesSheet
        open={allOpen}
        categories={home.categories}
        activeId={categoryId}
        onClose={() => setAllOpen(false)}
        onSelect={(id) => setParams({ category: id })}
      />

      <CatalogFilterSheet
        open={filterOpen}
        bounds={bounds}
        loading={boundsLoading}
        error={boundsError}
        onRetry={refreshBounds}
        currencySymbol={home.store.currencySymbol}
        appliedMin={minPrice}
        appliedMax={maxPrice}
        onClose={() => setFilterOpen(false)}
        onApply={(min, max) =>
          setParams({
            minPrice: min != null ? String(min) : null,
            maxPrice: max != null ? String(max) : null,
          })
        }
      />
    </div>
  );
}

/** Числовой URL-параметр цены; пусто/мусор → null. */
function parsePriceParam(value: string | null): number | null {
  if (value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Подпись ценового фильтра: диапазон / «от» / «до». null — фильтра нет. */
function buildPriceLabel(min: number | null, max: number | null, symbol: string): string | null {
  const fmt = (value: number) => formatMoneyMinor(value, symbol);
  if (min != null && max != null) return `${fmt(min)} – ${fmt(max)}`;
  if (min != null) return `от ${fmt(min)}`;
  if (max != null) return `до ${fmt(max)}`;
  return null;
}
