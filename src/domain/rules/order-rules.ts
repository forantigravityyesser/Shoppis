import type { OrderStatus } from '../models/order';

const NEXT: Record<OrderStatus, OrderStatus | null> = {
  pending: 'shipped',
  shipped: 'delivered',
  delivered: null,
  cancelled: null,
};

export function nextAllowedStatus(status: OrderStatus): OrderStatus | null {
  return NEXT[status];
}

export function isCancellable(status: OrderStatus): boolean {
  return status === 'pending' || status === 'shipped';
}
