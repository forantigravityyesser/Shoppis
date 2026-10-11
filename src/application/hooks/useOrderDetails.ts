import { useQuery } from '@tanstack/react-query';
import { deps } from '../composition/container';
import { useStore } from '../store';
import { ORDER_STALE_TIME_MS, orderKeys } from '../orders/order-cache';
import type { OrderDetails, OrderScope } from '../read-models/order';

export interface OrderDetailsParams {
  scope: OrderScope;
  orderId: string | null;
  enabled?: boolean;
}

export interface OrderDetailsState {
  order: OrderDetails | null;
  loading: boolean;
  error: string | null;
  /** Заказ не найден/недоступен (единый safe not-found) — не ошибка сети. */
  notFound: boolean;
  refetch: () => void;
}

/**
 * Деталь заказа (buyer/seller) — один composed read (docs/22 §5.5, ORD-04).
 * Чужой/несуществующий заказ резолвится в `null` (сервер не раскрывает существование).
 */
export function useOrderDetails(params: OrderDetailsParams): OrderDetailsState {
  const sessionToken = useStore((s) => s.sessionToken);
  // Identity часть ключа (docs/24 §3.4): чужой кэш не может быть выдан как свой.
  const userId = useStore((s) => s.serverUser?.id ?? null);
  const enabled = (params.enabled ?? true) && Boolean(sessionToken) && Boolean(params.orderId);

  const query = useQuery({
    queryKey: orderKeys.detail(userId, params.scope, params.orderId),
    queryFn: () =>
      deps().orderRepository.getOrderDetails({
        sessionToken: sessionToken as string,
        scope: params.scope,
        orderId: params.orderId as string,
      }),
    // Короткий явный staleTime (docs/24 §3.4) вместо унаследованных 5 минут.
    staleTime: ORDER_STALE_TIME_MS,
    enabled,
  });

  return {
    order: enabled ? (query.data ?? null) : null,
    loading: enabled && query.isLoading,
    error: enabled && query.isError ? (query.error as Error).message : null,
    notFound: enabled && query.isSuccess && query.data === null,
    refetch: () => {
      void query.refetch();
    },
  };
}
