import { useCallback, useRef } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { deps } from '../composition/container';
import type { StorefrontProductCard } from '../read-models/storefront';

/** Размер страницы товарного потока Home (серверный `limit`). docs/15 §5.2. */
export const HOME_PRODUCTS_PAGE_SIZE = 6;

export interface StorefrontHomeProductsState {
  /** Все загруженные страницы (без дублей по id). */
  products: StorefrontProductCard[];
  /** Курсор последней загруженной страницы; null — страниц больше нет. */
  nextCursor: string | null;
  hasNextPage: boolean;
  /** Первичная загрузка (ещё нет данных). */
  loading: boolean;
  /** Догрузка следующей страницы. */
  fetchingNextPage: boolean;
  error: string | null;
  /** Загрузить следующую страницу; no-op при отсутствии страниц/уже идущей догрузке. */
  loadMore: () => void;
  refresh: () => void;
}

/**
 * Товарный поток Home на `useInfiniteQuery`: первая страница + append следующих
 * (`storefront_home_products_read`, keyset-курсор). `loadMore` защищён от
 * повторного/параллельного вызова (in-flight ref), products дедуплицируются по id.
 * UI-триггер догрузки (IntersectionObserver) — HARDEN-06. docs/15 §5.5-5.7.
 */
export function useStorefrontHomeProducts(
  publicId: string | null,
  limit: number = HOME_PRODUCTS_PAGE_SIZE,
): StorefrontHomeProductsState {
  const enabled = Boolean(publicId);
  const query = useInfiniteQuery({
    queryKey: ['storefront-home-products', publicId, limit],
    queryFn: ({ pageParam }) =>
      deps().storefrontRepository.loadStorefrontHomeProducts(publicId as string, pageParam, limit),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage?.nextCursor ?? undefined,
    enabled,
  });

  const { fetchNextPage, hasNextPage, isFetchingNextPage } = query;

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

  return {
    products,
    nextCursor,
    hasNextPage: hasNextPage === true,
    loading: enabled && query.isLoading,
    fetchingNextPage: enabled && isFetchingNextPage,
    error: query.error ? (query.error as Error).message : null,
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
