import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { deps } from '../composition/container';
import { useStore } from '../store';
import { DASHBOARD_STALE_TIME_MS, dashboardKeys, invalidateSellerDashboard } from '../dashboard/dashboard-cache';
import type { SellerDashboardSummary } from '../read-models/seller-dashboard';

export interface SellerDashboardParams {
  /** Opaque storefront ref; по умолчанию — текущий `storeId`. */
  storeRef?: string | null;
  enabled?: boolean;
}

/**
 * Почему сводка не пошла в сеть (симметрично `useOrders.disabledReason`).
 * View обязан отличать «нет сессии/магазина» от «данных нет».
 */
export type DashboardDisabledReason = 'disabled' | 'no-session' | 'no-store';

export interface SellerDashboardState {
  summary: SellerDashboardSummary | null;
  loading: boolean;
  error: string | null;
  disabledReason: DashboardDisabledReason | null;
  refetch: () => void;
}

/**
 * Сводка главной продавца (docs/25 §3.4): один серверный read (`seller_dashboard_read`)
 * + realtime-инвалидация по изменениям заказов магазина (best-effort). Данные
 * считает сервер; клиент только запрашивает.
 */
export function useSellerDashboard(params: SellerDashboardParams = {}): SellerDashboardState {
  const queryClient = useQueryClient();
  const sessionToken = useStore((s) => s.sessionToken);
  const storeId = useStore((s) => s.storeId);
  // Identity часть ключа (docs/24 §3.4): чужой кэш не выдаётся как свой.
  const userId = useStore((s) => s.serverUser?.id ?? null);

  const storeRef = params.storeRef !== undefined ? params.storeRef : storeId;
  const disabledReason: DashboardDisabledReason | null = !(params.enabled ?? true)
    ? 'disabled'
    : !sessionToken
      ? 'no-session'
      : !storeRef
        ? 'no-store'
        : null;
  const enabled = disabledReason === null;

  const query = useQuery({
    queryKey: dashboardKeys.summary(userId, storeRef),
    queryFn: () =>
      deps().sellerDashboardRepository.getSummary({
        sessionToken: sessionToken as string,
        storeRef: storeRef as string,
      }),
    // Дешёвый одиночный RPC: всегда перечитываем при входе (счётчики инвентаря).
    staleTime: DASHBOARD_STALE_TIME_MS,
    enabled,
  });

  // Realtime: изменение заказа магазина → инвалидация сводки. Сокет best-effort;
  // без него экран работает (просто без live-обновления).
  useEffect(() => {
    if (!enabled || !storeRef) return;
    const invalidate = () => {
      void invalidateSellerDashboard(queryClient);
    };
    return deps().orderRealtime.subscribeStoreOrders(storeRef, {
      onChange: invalidate,
      onResync: invalidate,
    });
  }, [enabled, storeRef, queryClient]);

  return {
    summary: enabled ? (query.data ?? null) : null,
    loading: enabled && query.isLoading,
    error: enabled && query.isError ? (query.error as Error).message : null,
    disabledReason,
    refetch: () => {
      void query.refetch();
    },
  };
}
