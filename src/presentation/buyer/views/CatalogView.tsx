import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';
import { useStore } from '../../../application/store';
import { useStorefrontHome } from '../../../application/hooks/useStorefrontHome';
import { useStorefrontCatalog } from '../../../application/hooks/useStorefrontCatalog';
import { useStorefrontCatalogPriceBounds } from '../../../application/hooks/useStorefrontCatalogPriceBounds';
import { formatMoneyMinor } from '../../../domain/rules/product-rules';
import { useInfiniteScrollSentinel } from '../../shared/hooks/useInfiniteScrollSentinel';
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
  const { t } = useTranslation();
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
  /** Remount sheet при открытии: сброс драфта фильтра без effect (docs/20 §11). */
  const [filterKey, setFilterKey] = useState(0);
  const [searchDraft, setSearchDraft] = useState(search);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<number | null>(null);
  // Актуальные URL-параметры для debounced-записи (не устаревают при паузе ввода).
  const paramsRef = useRef(searchParams);
  useEffect(() => {
    paramsRef.current = searchParams;
  }, [searchParams]);

  // Внешнее изменение `q` (back/forward, переход с Home, ссылка) синхронизирует поле:
  // URL — источник истины. Паттерн React «adjust state during render» (вместо effect,
  // чтобы не плодить set-state-in-effect). Отложенную запись снимаем отдельным
  // эффектом без setState, чтобы старый debounce не перетёр внешнее значение.
  const [syncedSearch, setSyncedSearch] = useState(search);
  if (syncedSearch !== search) {
    setSyncedSearch(search);
    setSearchDraft(search);
  }
  useEffect(() => {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }, [search]);

  const shouldFocus = searchParams.get('focus') === '1';
  // Фокус поиска с Home (CAT-13): навигация синхронная (useTransitions=false),
  // поэтому useLayoutEffect вызывается внутри пользовательского тапа — клавиатура
  // открывается в Telegram/WebView. Ждём, пока поле реально смонтируется (сначала
  // может быть скелетон), и затем убираем одноразовый `focus` из URL.
  useLayoutEffect(() => {
    if (!shouldFocus) return;
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    // `focus` одноразовый: убираем из URL, чтобы возврат из товара не открывал
    // клавиатуру повторно (Back должен вернуть каталог в прежнем виде). docs/17 CAT-13.
    const next = new URLSearchParams(searchParams);
    next.delete('focus');
    setSearchParams(next, { replace: true });
  }, [shouldFocus, searchParams, setSearchParams, loading, catalog.loading, home]);

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
      title={t('buyer.catalog.title')}
      buyerAvatarUrl={serverUser?.photoUrl ?? null}
      buyerName={serverUser?.firstName ?? ''}
      onProfile={() => navigate('/account')}
    />
  );

  // Скелетон всего экрана — только пока грузится контекст витрины. Товарный поток
  // грузим внутри уже отрисованной оболочки: поле поиска должно существовать сразу
  // (синхронный автофокус из Home открывает клавиатуру; CAT-13).
  if (loading) {
    return <CatalogSkeleton />;
  }

  if (error ?? catalog.initialError) {
    return (
      <div className="home">
        {header}
        <div className="home-sheet">
          <div className="catalog-error" role="alert">
            <p className="catalog-error__title">{t('buyer.catalog.loadError')}</p>
            <p className="catalog-error__text">{t('buyer.catalog.loadErrorHint')}</p>
            <button
              type="button"
              className="home-retry"
              onClick={() => {
                refresh();
                catalog.refresh();
              }}
            >
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

  const products = catalog.products;
  const priceActive = minPrice != null || maxPrice != null;
  const categoryName = categoryId
    ? (home.categories.find((c) => c.id === categoryId)?.name ?? t('buyer.catalog.categoryFallback'))
    : null;
  /** Подпись ценового фильтра: диапазон / «от» / «до». null — фильтра нет. */
  const fmtPrice = (value: number) => formatMoneyMinor(value, home.store.currencySymbol);
  const priceLabel =
    minPrice != null && maxPrice != null
      ? t('buyer.catalog.priceRange', { min: fmtPrice(minPrice), max: fmtPrice(maxPrice) })
      : minPrice != null
        ? t('buyer.catalog.priceFrom', { price: fmtPrice(minPrice) })
        : maxPrice != null
          ? t('buyer.catalog.priceTo', { price: fmtPrice(maxPrice) })
          : null;

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
            aria-label={t('buyer.catalog.filtersAria')}
            aria-pressed={priceActive}
            onClick={() => {
              setFilterOpen(true);
              setFilterKey((k) => k + 1);
            }}
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
          {products.length === 0 && catalog.loading ? (
            <div className="product-grid" aria-hidden>
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="skel skel--card" />
              ))}
            </div>
          ) : (
            <ProductGrid
              products={products}
              currencySymbol={home.store.currencySymbol}
              onOpen={(productId) => navigate(`/product/${productId}`)}
            />
          )}
          {catalog.updating ? (
            <div
              className="catalog-updating"
              role="status"
              aria-label={t('buyer.catalog.updatingAria')}
              data-testid="catalog-updating"
            >
              <span className="home-stream-spinner" aria-hidden />
            </div>
          ) : null}
        </div>
        {products.length > 0 ? (
          catalog.nextPageError ? (
            <div className="home-stream-error" role="alert" data-testid="catalog-stream-error">
              <span className="home-stream-error__text">{t('buyer.catalog.streamError')}</span>
              <button type="button" className="home-stream-error__retry" onClick={catalog.loadMore}>
                {t('common.retry')}
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
                  aria-label={t('buyer.catalog.loadingAria')}
                  data-testid="catalog-stream-loading"
                >
                  <span className="home-stream-spinner" aria-hidden />
                </div>
              ) : null}
            </>
          )
        ) : null}
        {products.length === 0 && !catalog.loading ? (
          <div className="catalog-empty" role="status">
            {search ? (
              <>
                <p className="catalog-empty__title">{t('buyer.catalog.emptySearchTitle')}</p>
                <p className="catalog-empty__text">
                  {t('buyer.catalog.emptySearchText', { query: search })}
                </p>
              </>
            ) : priceActive ? (
              <>
                <p className="catalog-empty__title">{t('buyer.catalog.emptyPriceTitle')}</p>
                <p className="catalog-empty__text">{t('buyer.catalog.emptyPriceText')}</p>
              </>
            ) : categoryId ? (
              <>
                <p className="catalog-empty__title">{t('buyer.catalog.emptyCategoryTitle')}</p>
                <p className="catalog-empty__text">{t('buyer.catalog.emptyCategoryText')}</p>
              </>
            ) : (
              <>
                <p className="catalog-empty__title">{t('buyer.catalog.emptyTitle')}</p>
                <p className="catalog-empty__text">{t('buyer.catalog.emptyText')}</p>
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
        key={filterKey}
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
