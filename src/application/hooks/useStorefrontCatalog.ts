import { useCallback, useRef } from 'react';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { deps } from '../composition/container';
import type { StorefrontProductCard } from '../read-models/storefront';

/** Размер страницы каталога (серверный `limit`). docs/17 §2. */
export const CATALOG_PRODUCTS_PAGE_SIZE = 12;

/** Фильтры каталога, входящие в query key (без пагинации/limit). */
export interface StorefrontCatalogFilters {
  categoryId?: string | null;
  search?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
}

export interface StorefrontCatalogState {
  /** Все загруженные страницы (без дублей по id). */
  products: StorefrontProductCard[];
  /** Курсор последней загруженной страницы; null — страниц больше нет. */
  nextCursor: string | null;
  hasNextPage: boolean;
  /** Первичная загрузка (ещё нет данных). */
  loading: boolean;
  /** Догрузка следующей страницы. */
  fetchingNextPage: boolean;
  /** Ошибка первой загрузки (данных нет) — fatal для экрана. */
  initialError: string | null;
  /** Ошибка догрузки следующей страницы — локальная: товары сохраняются. */
  nextPageError: string | null;
  /** Загрузить следующую страницу; no-op при отсутствии страниц/уже идущей догрузке. */
  loadMore: () => void;
  refresh: () => void;
}

/**
 * Server-side поток Каталога на `useInfiniteQuery` (`storefront_catalog_products_read`):
 * категория/поиск/цена + keyset-курсор. Query key включает все фильтры, поэтому
 * **при изменении любого фильтра курсор начинается заново** (новая cache-запись,
 * `pageParam = null`) — старое состояние не «протекает» в новый фильтр, а «последний
 * ввод побеждает» обеспечивает React Query. `loadMore` защищён in-flight ref,
 * товары дедуплицируются по id. Ошибка первой загрузки (`initialError`) и догрузки
 * (`nextPageError`) разделены. docs/17 §2.4, §4 (CATALOG-05/17).
 */
export function useStorefrontCatalog(
  publicId: string | null,
  filters: StorefrontCatalogFilters = {},
  limit: number = CATALOG_PRODUCTS_PAGE_SIZE,
  enabled: boolean = true,
): StorefrontCatalogState {
  const { categoryId = null, search = null, minPrice = null, maxPrice = null } = filters;
  const queryEnabled = Boolean(publicId) && enabled;

  const query = useInfiniteQuery({
    queryKey: ['storefront-catalog', publicId, { categoryId, search, minPrice, maxPrice }],
    queryFn: ({ pageParam }) =>
      deps().storefrontCatalogRepository.loadCatalogProducts({
        publicId: publicId as string,
        limit,
        categoryId,
        search,
        minPrice,
        maxPrice,
        cursor: pageParam,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage?.nextCursor ?? undefined,
    enabled: queryEnabled,
    // При смене фильтра/поиска держим предыдущие товары, пока грузится новый набор:
    // иначе экран уходит в skeleton и поле поиска размонтируется (теряется фокус).
    placeholderData: keepPreviousData,
  });

  const { fetchNextPage, hasNextPage, isFetchingNextPage, isLoadingError, isFetchNextPageError } =
    query;

  const products = dedupeById((query.data?.pages ?? []).flatMap((page) => page?.products ?? []));
  const pages = query.data?.pages ?? [];
  const nextCursor = pages.length ? (pages[pages.length - 1]?.nextCursor ?? null) : null;

  const inFlightRef = useRef(false);
  const loadMore = useCallback(() => {
    if (inFlightRef.current || !hasNextPage) return;
    inFlightRef.current = true;
    void fetchNextPage().finally(() => {
      inFlightRef.current = false;
    });
  }, [fetchNextPage, hasNextPage]);

  const errorMessage = query.error ? (query.error as Error).message : null;

  return {
    products,
    nextCursor,
    hasNextPage: hasNextPage === true,
    loading: queryEnabled && query.isLoading,
    fetchingNextPage: queryEnabled && isFetchingNextPage,
    initialError: queryEnabled && isLoadingError ? errorMessage : null,
    nextPageError: queryEnabled && isFetchNextPageError ? errorMessage : null,
    loadMore,
    refresh: () => {
      void query.refetch();
    },
  };
}

/** Keyset-страницы не пересекаются, но дедуп по id защищает от повторного fetch/append. */
function dedupeById(list: StorefrontProductCard[]): StorefrontProductCard[] {
  const seen = new Set<string>();
  const out: StorefrontProductCard[] = [];
  for (const product of list) {
    if (seen.has(product.id)) continue;
    seen.add(product.id);
    out.push(product);
  }
  return out;
}
