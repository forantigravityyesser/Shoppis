/** EN-ключи статусов (совпадают с колонкой status в БД). 02 §6, 03 §16 */
export type OrderStatus = 'NEW' | 'IN_TRANSIT' | 'DELIVERED' | 'REFUSED' | 'CANCELLED';

/** Итог вручения, который фиксирует продавец после DELIVERED. 02 §7, 03 §16 */
export type DeliveryOutcome = 'RECEIVED' | 'REFUSED';

/** Контролируемый список причин отказа. 02 §7 */
export type RefusalReasonCode =
  | 'BUYER_CHANGED_MIND'
  | 'COULD_NOT_CONTACT_BUYER'
  | 'DELIVERY_TERMS'
  | 'PRODUCT_NOT_MATCHED_EXPECTATIONS'
  | 'OTHER';

export type OrderActorType = 'buyer' | 'seller' | 'system';

/** Immutable historical snapshot of the order. 03 §13 */
export interface Order {
  id: string;
  publicOrderNumber: string;
  storeId: string;
  buyerUserId: string;
  buyerFullNameSnapshot: string;
  buyerPhoneSnapshot: string;
  buyerAddressSnapshot: string;
  buyerTelegramUsernameSnapshot: string | null;
  status: OrderStatus;
  /** Заполняется при фиксации итога вручения (RECEIVED остаётся DELIVERED). */
  deliveryOutcome: DeliveryOutcome | null;
  refusalReasonCode: RefusalReasonCode | null;
  currencyCode: string;
  subtotalMinor: number;
  totalMinor: number;
  createdAt: string;
  updatedAt: string;
  cancelledAt: string | null;
  completedAt: string | null;
  refusedAt: string | null;
}

/** Immutable item snapshot. 03 §14 */
export interface OrderItem {
  id: string;
  orderId: string;
  productId: string | null;
  variantId: string | null;
  productTitleSnapshot: string;
  productDescriptionSnapshot: string | null;
  productImageSnapshot: string | null;
  linkingAttributesSnapshot: Array<{ name: string; value: string }>;
  variantNameSnapshot: string | null;
  variantValueSnapshot: string | null;
  quantity: number;
  originalUnitPriceMinor: number;
  discountPercent: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
  currencyCode: string;
}

/** Историю переходов фиксирует сервер. 03 §15 */
export interface OrderStatusHistory {
  id: string;
  orderId: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  actorType: OrderActorType;
  actorUserId: string | null;
  reasonCode: string | null;
  createdAt: string;
}
