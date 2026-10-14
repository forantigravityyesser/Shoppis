import { useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { deps } from '../composition/container';
import { useStore } from '../store';
import { ORDER_STALE_TIME_MS, orderKeys } from '../orders/order-cache';
import type { OrderListItem, SalesGroup } from '../read-models/order';

const DEFAULT_PAGE_SIZE = 20;

export interface SellerSalesParams {
  group: SalesGroup;
  /** Opaque storefront ref; по умолчанию — текущий `storeId`. */
  storeRef?: string | null;
  pageSize?: number;
  enabled?: boolean;
}

/** Причина неактивного запроса (симметрично `useOrders.disabledReason`). */
export type SalesDisabledReason = 'disabled' | 'no-session' | 'no-store';

export interface SellerSalesState {
  orders: OrderListItem[];
  /** Сумма всей группы (не страницы) в текущей валюте магазина. */
  totalMinor: number;
  loading: boolean;
  fetching: boolean;
  error: string | null;
  hasNextPage: boolean;
  disabledReason: SalesDisabledReason | null;
  fetchNextPage: () => void;
  refetch: () => void;
}

/**
 * Список продаж (docs/25 §3.4) — проекция заказов с keyset-пагинацией через
 * `order-queries` (action `sales`). Ключ под корнем `['orders']`, поэтому
 * realtime-инвалидация заказов обновляет и списки продаж.
 */
export function useSellerSales(params: SellerSalesParams): SellerSalesState {
  const sessionToken = useStore((s) => s.sessionToken);
  const storeId = useStore((s) => s.storeId);
  const userId = useStore((s) => s.serverUser?.id ?? null);

  const storeRef = params.storeRef !== undefined ? params.storeRef : storeId;
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;
  const disabledReason: SalesDisabledReason | null = !(params.enabled ?? true)
    ? 'disabled'
    : !sessionToken
      ? 'no-session'
      : !storeRef
        ? 'no-store'
        : null;
  const enabled = disabledReason === null;

  const query = useInfiniteQuery({
    queryKey: orderKeys.sales(userId, storeRef, params.group),
    queryFn: ({ pageParam }) =>
      deps().orderRepository.listSales({
        sessionToken: sessionToken as string,
        storeRef: storeRef as string,
        group: params.group,
        cursor: pageParam,
        limit: pageSize,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: ORDER_STALE_TIME_MS,
    enabled,
  });

  const orders = useMemo(() => {
    const pages = query.data?.pages ?? [];
    // Дедуп по id на случай пересечения keyset-страниц при live-инвалидации.
    const seen = new Set<string>();
    const unique: OrderListItem[] = [];
    for (const page of pages) {
      for (const order of page.orders) {
        if (seen.has(order.id)) continue;
        seen.add(order.id);
        unique.push(order);
      }
    }
    return unique;
  }, [query.data]);

  // Сумма группы одинакова на каждой странице (считается по всей группе) — берём первую.
  const totalMinor = query.data?.pages?.[0]?.totalMinor ?? 0;

  return {
    orders,
    totalMinor,
    loading: enabled && query.isLoading,
    fetching: enabled && query.isFetching,
    error: enabled && query.isError ? (query.error as Error).message : null,
    hasNextPage: enabled && query.hasNextPage,
    disabledReason,
    fetchNextPage: () => {
      void query.fetchNextPage();
    },
    refetch: () => {
      void query.refetch();
    },
  };
}
