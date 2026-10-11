import type { OrderStatusFilter } from '../../../application/read-models/order';

export interface OrderTab {
  value: OrderStatusFilter;
  label: string;
}

/** Табы списка заказов (docs/22 §5.1). «История» — фильтр-группировка, не статус. */
export const DEFAULT_ORDER_TABS: OrderTab[] = [
  { value: 'all', label: 'Все' },
  { value: 'NEW', label: 'Новые' },
  { value: 'IN_TRANSIT', label: 'В пути' },
  { value: 'DELIVERED', label: 'Доставлено' },
  { value: 'history', label: 'История' },
];
