import { useMemo } from 'react';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { deps } from '../composition/container';
import { useStore } from '../store';
import type { OrderListItem, OrderScope, OrderStatusFilter } from '../read-models/order';

/**
 * React Query keys заказов (docs/22 §4.3, ORD-04). Единственный server-cache
 * заказов: list — `['orders', scope, storeRef, filter]`, detail — `['order', scope, orderId]`.
 */
export const ORDER_LIST_QUERY_ROOT = 'orders' as const;
export const ORDER_DETAIL_QUERY_ROOT = 'order' as const;

export const orderKeys = {
  listRoot: [ORDER_LIST_QUERY_ROOT] as const,
  detailRoot: [ORDER_DETAIL_QUERY_ROOT] as const,
  list: (scope: OrderScope, storeRef: string | null, filter: OrderStatusFilter) =>
    [ORDER_LIST_QUERY_ROOT, scope, storeRef, filter] as const,
  detail: (scope: OrderScope, orderId: string | null) =>
    [ORDER_DETAIL_QUERY_ROOT, scope, orderId] as const,
};

const DEFAULT_PAGE_SIZE = 20;

export interface OrdersListParams {
  scope: OrderScope;
  /** Opaque storefront ref; по умолчанию — текущий `storeId`. */
  storeRef?: string | null;
  statusFilter?: OrderStatusFilter;
  pageSize?: number;
  enabled?: boolean;
}

export interface OrdersListState {
  orders: OrderListItem[];
  loading: boolean;
  /** Идёт догрузка/пере-запрос (в т.ч. смена таба через `keepPreviousData`). */
  fetching: boolean;
  error: string | null;
  hasNextPage: boolean;
  fetchNextPage: () => void;
  refetch: () => void;
}

/**
 * Список заказов (buyer/seller) с keyset-cursor пагинацией (docs/22 §4.3, §5.5).
 * Identity/scope авторизует сервер (edge + SQL); здесь только requested context.
 * `keepPreviousData` удерживает предыдущую страницу при смене таба/магазина.
 */
export function useOrders(params: OrdersListParams): OrdersListState {
  const sessionToken = useStore((s) => s.sessionToken);
  const storeId = useStore((s) => s.storeId);

  const storeRef = params.storeRef !== undefined ? params.storeRef : storeId;
  const statusFilter = params.statusFilter ?? 'all';
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;
  const enabled = (params.enabled ?? true) && Boolean(sessionToken) && Boolean(storeRef);

  const query = useInfiniteQuery({
    queryKey: orderKeys.list(params.scope, storeRef, statusFilter),
    queryFn: ({ pageParam }) =>
      deps().orderRepository.listOrders({
        sessionToken: sessionToken as string,
        scope: params.scope,
        storeRef: storeRef as string,
        statusFilter,
        cursor: pageParam,
        limit: pageSize,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled,
    placeholderData: keepPreviousData,
  });

  const orders = useMemo(() => {
    const pages = query.data?.pages ?? [];
    // Дедуп по id: keyset-страницы не должны пересекаться, но live-инвалидация
    // при сдвиге курсоров (напр. вставка нового заказа) может дать пересечение
    // страниц — тогда один заказ отрисовался бы дважды. Первое вхождение (самая
    // свежая страница) побеждает.
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

  return {
    orders,
    loading: enabled && query.isLoading,
    fetching: enabled && query.isFetching,
    error: enabled && query.isError ? (query.error as Error).message : null,
    hasNextPage: enabled && query.hasNextPage,
    fetchNextPage: () => {
      void query.fetchNextPage();
    },
    refetch: () => {
      void query.refetch();
    },
  };
}
