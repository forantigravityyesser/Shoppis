import type { OrderStatusFilter } from '../../../application/read-models/order';

/** Доменные значения таб-фильтра заказов (docs/22 §5.1). */
export const ORDER_STATUS_FILTERS: OrderStatusFilter[] = [
  'all',
  'NEW',
  'IN_TRANSIT',
  'DELIVERED',
  'history',
];

/**
 * Разбор URL-параметра `?status=` в доменный фильтр. Пусто/неизвестно → `all`
 * (безопасный дефолт; «История» — группировка, а не статус).
 */
export function parseStatusFilterParam(value: string | null): OrderStatusFilter {
  return value && (ORDER_STATUS_FILTERS as string[]).includes(value)
    ? (value as OrderStatusFilter)
    : 'all';
}

/** Обновлённый `URLSearchParams` с фильтром (удаляет `status` для `all`). */
export function withStatusFilterParam(
  current: URLSearchParams,
  value: OrderStatusFilter,
): URLSearchParams {
  const next = new URLSearchParams(current);
  if (value === 'all') next.delete('status');
  else next.set('status', value);
  return next;
}
