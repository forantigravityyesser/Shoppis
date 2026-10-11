import type { DeliveryOutcome, OrderStatus, RefusalReasonCode } from '../models/order';

export const ORDER_STATUS_META: Record<OrderStatus, { labelRu: string }> = {
  NEW: { labelRu: 'Новый' },
  IN_TRANSIT: { labelRu: 'В пути' },
  DELIVERED: { labelRu: 'Доставлено' },
  REFUSED: { labelRu: 'Отказ' },
  CANCELLED: { labelRu: 'Отменён' },
};

export const REFUSAL_REASON_META: Record<RefusalReasonCode, { labelRu: string }> = {
  BUYER_CHANGED_MIND: { labelRu: 'Покупатель передумал' },
  COULD_NOT_CONTACT_BUYER: { labelRu: 'Не удалось связаться с покупателем' },
  DELIVERY_TERMS: { labelRu: 'Условия доставки' },
  PRODUCT_NOT_MATCHED_EXPECTATIONS: { labelRu: 'Товар не соответствует ожиданиям' },
  OTHER: { labelRu: 'Другое' },
};

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
 */
export function orderStatusLabel(status: string | null | undefined): string {
  if (status && status in ORDER_STATUS_META) return ORDER_STATUS_META[status as OrderStatus].labelRu;
  return 'Неизвестный статус';
}

export function refusalReasonLabel(code: string | null | undefined): string {
  if (code && code in REFUSAL_REASON_META) return REFUSAL_REASON_META[code as RefusalReasonCode].labelRu;
  return 'Причина не указана';
}
