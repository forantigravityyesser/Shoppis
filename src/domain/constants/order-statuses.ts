import type { DeliveryOutcome, OrderStatus, RefusalReasonCode } from '../models/order';

/**
 * Метаданные статуса заказа: только i18n-ключ подписи (без локализованного
 * текста — домен остаётся свободным от i18n). Резолвинг ключа делает presentation
 * через `t()`.
 */
export const ORDER_STATUS_META = {
  NEW: { labelKey: 'domain.orderStatus.NEW' },
  IN_TRANSIT: { labelKey: 'domain.orderStatus.IN_TRANSIT' },
  DELIVERED: { labelKey: 'domain.orderStatus.DELIVERED' },
  REFUSED: { labelKey: 'domain.orderStatus.REFUSED' },
  CANCELLED: { labelKey: 'domain.orderStatus.CANCELLED' },
} as const satisfies Record<OrderStatus, { labelKey: string }>;

export const REFUSAL_REASON_META = {
  BUYER_CHANGED_MIND: { labelKey: 'domain.refusalReason.BUYER_CHANGED_MIND' },
  COULD_NOT_CONTACT_BUYER: { labelKey: 'domain.refusalReason.COULD_NOT_CONTACT_BUYER' },
  DELIVERY_TERMS: { labelKey: 'domain.refusalReason.DELIVERY_TERMS' },
  PRODUCT_NOT_MATCHED_EXPECTATIONS: {
    labelKey: 'domain.refusalReason.PRODUCT_NOT_MATCHED_EXPECTATIONS',
  },
  OTHER: { labelKey: 'domain.refusalReason.OTHER' },
} as const satisfies Record<RefusalReasonCode, { labelKey: string }>;

export type OrderStatusLabelKey =
  | (typeof ORDER_STATUS_META)[OrderStatus]['labelKey']
  | 'domain.orderStatus.unknown';

export type RefusalReasonLabelKey =
  | (typeof REFUSAL_REASON_META)[RefusalReasonCode]['labelKey']
  | 'domain.refusalReason.unknown';

/** Контролируемые enum-значения статуса заказа (docs/24 §2.4, ORD-HARDEN-06). */
export const ORDER_STATUSES = [
  'NEW',
  'IN_TRANSIT',
  'DELIVERED',
  'REFUSED',
  'CANCELLED',
] as const satisfies readonly OrderStatus[];

/** Контролируемые коды причины отказа (02 §7; CHECK `0051`). */
export const REFUSAL_REASON_CODES = [
  'BUYER_CHANGED_MIND',
  'COULD_NOT_CONTACT_BUYER',
  'DELIVERY_TERMS',
  'PRODUCT_NOT_MATCHED_EXPECTATIONS',
  'OTHER',
] as const satisfies readonly RefusalReasonCode[];

/** Контролируемые итоги вручения (03 §16). */
export const DELIVERY_OUTCOMES = ['RECEIVED', 'REFUSED'] as const satisfies readonly DeliveryOutcome[];

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === 'string' && (ORDER_STATUSES as readonly string[]).includes(value);
}

export function isRefusalReasonCode(value: unknown): value is RefusalReasonCode {
  return typeof value === 'string' && (REFUSAL_REASON_CODES as readonly string[]).includes(value);
}

export function isDeliveryOutcome(value: unknown): value is DeliveryOutcome {
  return typeof value === 'string' && (DELIVERY_OUTCOMES as readonly string[]).includes(value);
}

/**
 * Safe-getters (docs/24 §2.4): неизвестное значение enum не должно ломать рендер.
 * Принимают `string`, т.к. значение приходит из внешних данных до валидации.
 * Возвращают i18n-ключ для резолвинга через `t()`.
 */
export function orderStatusLabelKey(status: string | null | undefined): OrderStatusLabelKey {
  if (status && status in ORDER_STATUS_META) {
    return ORDER_STATUS_META[status as OrderStatus].labelKey;
  }
  return 'domain.orderStatus.unknown';
}

export function refusalReasonLabelKey(code: string | null | undefined): RefusalReasonLabelKey {
  if (code && code in REFUSAL_REASON_META) {
    return REFUSAL_REASON_META[code as RefusalReasonCode].labelKey;
  }
  return 'domain.refusalReason.unknown';
}
