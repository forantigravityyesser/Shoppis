import type { OrderStatus } from '../models/order';

export type OrderActor = 'buyer' | 'seller';

/**
 * Линейный «продажный» поток. DELIVERED не имеет следующего статуса:
 * итог фиксируется delivery_outcome, либо переход в REFUSED. 03 §16
 */
const NEXT: Record<OrderStatus, OrderStatus | null> = {
  NEW: 'IN_TRANSIT',
  IN_TRANSIT: 'DELIVERED',
  DELIVERED: null,
  REFUSED: null,
  CANCELLED: null,
};

export function nextAllowedStatus(status: OrderStatus): OrderStatus | null {
  return NEXT[status];
}

/** Отмена: buyer — только NEW; seller — NEW и IN_TRANSIT. 02 §6 */
export function isCancellable(status: OrderStatus, actor: OrderActor): boolean {
  if (actor === 'buyer') return status === 'NEW';
  return status === 'NEW' || status === 'IN_TRANSIT';
}

/** REFUSED и CANCELLED — терминальные. 03 §16, §24 */
export function isTerminal(status: OrderStatus): boolean {
  return status === 'REFUSED' || status === 'CANCELLED';
}

/** DELIVERED завершается записью delivery_outcome (RECEIVED) либо переходом в REFUSED. 02 §7, 03 §16 */
export function isAwaitingDeliveryOutcome(status: OrderStatus): boolean {
  return status === 'DELIVERED';
}

/** Полная матрица переходов с учётом актора. 03 §16 */
export function canTransition(from: OrderStatus, to: OrderStatus, actor: OrderActor): boolean {
  if (from === to) return false;
  if (to === 'CANCELLED') return isCancellable(from, actor);
  if (actor !== 'seller') return false;
  switch (from) {
    case 'NEW':
      return to === 'IN_TRANSIT';
    case 'IN_TRANSIT':
      return to === 'DELIVERED';
    case 'DELIVERED':
      return to === 'REFUSED';
    default:
      return false;
  }
}
