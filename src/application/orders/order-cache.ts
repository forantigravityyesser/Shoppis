import type { QueryClient } from '@tanstack/react-query';
import type { OrderScope, OrderStatusFilter, SalesGroup } from '../read-models/order';

/**
 * React Query keys заказов (docs/22 §4.3, docs/24 §3.4, ORD-HARDEN-04).
 *
 * Ключ включает identity (`userId`): кэш одного пользователя не может быть выдан
 * другому при смене сессии, даже если кэш не успели очистить. `null` — нет
 * авторизованной личности (запрос при этом всё равно disabled по sessionToken).
 *
 *   list   — `['orders', userId, scope, storeRef, filter]`
 *   detail — `['order', userId, scope, orderId]`
 *   sales  — `['orders', userId, 'seller', storeRef, 'sales', group]`
 *
 * `sales` живёт под тем же корнем `['orders', …]`: realtime/refresh/actions,
 * инвалидирующие `orderKeys.listRoot`, обновляют и списки продаж (docs/25 §3.4).
 */
const ORDER_LIST_QUERY_ROOT = 'orders' as const;
const ORDER_DETAIL_QUERY_ROOT = 'order' as const;

/** Явный короткий staleTime для orders-запросов вместо унаследованных 5 минут. */
export const ORDER_STALE_TIME_MS = 15_000;

export const orderKeys = {
  listRoot: [ORDER_LIST_QUERY_ROOT] as const,
  detailRoot: [ORDER_DETAIL_QUERY_ROOT] as const,
  list: (
    userId: string | null,
    scope: OrderScope,
    storeRef: string | null,
    filter: OrderStatusFilter,
  ) => [ORDER_LIST_QUERY_ROOT, userId, scope, storeRef, filter] as const,
  sales: (userId: string | null, storeRef: string | null, group: SalesGroup) =>
    [ORDER_LIST_QUERY_ROOT, userId, 'seller', storeRef, 'sales', group] as const,
  detail: (userId: string | null, scope: OrderScope, orderId: string | null) =>
    [ORDER_DETAIL_QUERY_ROOT, userId, scope, orderId] as const,
};

/**
 * Инвалидирует ВСЕ кэши списка заказов — включая НЕактивные таб-фильтры — и форсирует
 * их перечитывание (`refetchType: 'all'`). Ключевое: при смене статуса меняется
 * принадлежность заказа табу, поэтому недостаточно обновить активный таб — иначе
 * неактивный остаётся со старым статусом и один заказ «клонируется» в двух вкладках
 * (docs/22 ORD-14). Используется realtime-хуком, командным контуром и refresh-кнопкой.
 */
export function invalidateOrderLists(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: orderKeys.listRoot, refetchType: 'all' });
}

/**
 * Полностью убрать кэш заказов (смена/сброс identity). Вызывается при
 * `clearSession` и смене `serverUser`, чтобы заказы прошлого пользователя не
 * переживали смену личности (docs/24 §3.4).
 */
export function clearOrderCache(queryClient: QueryClient): void {
  queryClient.removeQueries({ queryKey: orderKeys.listRoot });
  queryClient.removeQueries({ queryKey: orderKeys.detailRoot });
}
