import { useCallback, useMemo } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { deps } from '../composition/container';
import { useStore } from '../store';
import { ORDER_STALE_TIME_MS, invalidateOrderLists, orderKeys } from '../orders/order-cache';
import type { OrderListItem, OrderScope, OrderStatusFilter } from '../read-models/order';

const DEFAULT_PAGE_SIZE = 20;

export interface OrdersListParams {
  scope: OrderScope;
  /** Opaque storefront ref; по умолчанию — текущий `storeId`. */
  storeRef?: string | null;
  statusFilter?: OrderStatusFilter;
  pageSize?: number;
  enabled?: boolean;
}

/**
 * Почему список не пошёл в сеть (docs/24 §2.7 D5 / ORD-HARDEN-05).
 * `no-store` — нет store-контекста (buyer без витрины); view обязан показать это
 * отдельным состоянием, а не «заказов нет».
 */
export type OrdersDisabledReason = 'disabled' | 'no-session' | 'no-store';

export interface OrdersListState {
  orders: OrderListItem[];
  loading: boolean;
  /** Идёт догрузка следующей страницы или пере-запрос (refetch/invalidate). */
  fetching: boolean;
  error: string | null;
  hasNextPage: boolean;
  /** Причина неактивного запроса (`null` — запрос активен/возможен). */
  disabledReason: OrdersDisabledReason | null;
  fetchNextPage: () => void;
  /** Перечитать только текущий таб-запрос (retry/повтор активной выборки). */
  refetch: () => void;
  /** Перечитать ВСЕ заказы: все таб-фильтры + все детали. Для кнопки «обновить». */
  refreshAll: () => void;
}

/**
 * Список заказов (buyer/seller) с keyset-cursor пагинацией (docs/22 §4.3, §5.5).
 * Identity/scope авторизует сервер (edge + SQL); здесь только requested context.
 *
 * `keepPreviousData` намеренно НЕ используется: при смене таба/магазина данные
 * прошлой выборки не выдаются за новую — вместо «клона» чужого списка показывается
 * skeleton (query-ключ меняется, data сбрасывается в `undefined`, `loading=true`).
 */
export function useOrders(params: OrdersListParams): OrdersListState {
  const queryClient = useQueryClient();
  const sessionToken = useStore((s) => s.sessionToken);
  const storeId = useStore((s) => s.storeId);
  // Identity часть ключа (docs/24 §3.4): чужой кэш не может быть выдан как свой.
  const userId = useStore((s) => s.serverUser?.id ?? null);

  const storeRef = params.storeRef !== undefined ? params.storeRef : storeId;
  const statusFilter = params.statusFilter ?? 'all';
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;
  // Явная причина неактивного запроса (docs/24 §2.7 D5): view отличает «нет
  // магазина»/«нет сессии» от «заказов нет».
  const disabledReason: OrdersDisabledReason | null = !(params.enabled ?? true)
    ? 'disabled'
    : !sessionToken
      ? 'no-session'
      : !storeRef
        ? 'no-store'
        : null;
  const enabled = disabledReason === null;

  const query = useInfiniteQuery({
    queryKey: orderKeys.list(userId, params.scope, storeRef, statusFilter),
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
    // Короткий явный staleTime (docs/24 §3.4) вместо унаследованных 5 минут.
    staleTime: ORDER_STALE_TIME_MS,
    enabled,
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
    disabledReason,
    fetchNextPage: () => {
      void query.fetchNextPage();
    },
    refetch: () => {
      void query.refetch();
    },
    refreshAll: useCallback(() => {
      // Все табы (не только активный) + все детали: один тап = все статусы актуальны.
      void invalidateOrderLists(queryClient);
      void queryClient.invalidateQueries({ queryKey: orderKeys.detailRoot, refetchType: 'all' });
    }, [queryClient]),
  };
}
