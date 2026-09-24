import type { OrderStatus, RefusalReasonCode } from '../models/order';

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
