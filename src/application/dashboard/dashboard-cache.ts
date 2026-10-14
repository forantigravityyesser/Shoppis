import type { QueryClient } from '@tanstack/react-query';

/**
 * React Query keys сводки главной продавца (docs/25 §3.4).
 *
 * Ключ включает identity (`userId`) — по той же причине, что и orders-кэш
 * (docs/24 §3.4): чужой кэш не может быть выдан как свой при смене сессии.
 *
 *   summary — `['seller-dashboard', userId, storeRef]`
 *
 * `staleTime: 0`: сводка — дешёвый одиночный RPC; всегда перечитываем при входе
 * на экран, чтобы счётчики инвентаря были актуальны после работы в Inventory.
 */
const DASHBOARD_QUERY_ROOT = 'seller-dashboard' as const;

export const DASHBOARD_STALE_TIME_MS = 0;

export const dashboardKeys = {
  root: [DASHBOARD_QUERY_ROOT] as const,
  summary: (userId: string | null, storeRef: string | null) =>
    [DASHBOARD_QUERY_ROOT, userId, storeRef] as const,
};

/** Инвалидирует сводку главной (realtime заказов, retry). */
export function invalidateSellerDashboard(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: dashboardKeys.root, refetchType: 'all' });
}
