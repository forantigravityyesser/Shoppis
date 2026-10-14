import type { DeliveryOutcome, OrderStatus, RefusalReasonCode } from '../../domain/models/order';

/** Actor scope of an orders query. Identity itself comes from the session, not from here. */
export type OrderScope = 'buyer' | 'seller';

/**
 * UI tab filter (docs/22 §5.1). `history` is a grouping (REFUSED + CANCELLED),
 * not a domain status; the raw statuses stay exactly five.
 */
export type OrderStatusFilter = 'all' | 'NEW' | 'IN_TRANSIT' | 'DELIVERED' | 'history';

/** One preview card item (list projection, 1..3 per order). */
export interface OrderPreviewItem {
  imageUrl: string | null;
  title: string;
  variantLabel: string | null;
  quantity: number;
}

/** Light list projection — what the orders list screen needs (docs/22 §5.3). */
export interface OrderListItem {
  id: string;
  publicOrderNumber: string;
  status: OrderStatus;
  createdAt: string;
  totalMinor: number;
  currencyCode: string;
  currencySymbol: string;
  itemCount: number;
  previewItems: OrderPreviewItem[];
}

/** A page of orders plus the keyset cursor for the next page (null = last page). */
export interface OrderListPage {
  orders: OrderListItem[];
  nextCursor: string | null;
}

/**
 * Группа вкладки «Продажи» (docs/25 §1.5): `earned` — полученные заказы
 * (`delivery_outcome = RECEIVED`), `potential` — `IN_TRANSIT` или `DELIVERED`
 * без зафиксированного исхода. Не является таб-фильтром заказов.
 */
export type SalesGroup = 'earned' | 'potential';

/** Страница продаж: тот же список, что и у заказов, плюс сумма всей группы. */
export interface SalesListPage extends OrderListPage {
  /** Сумма `total_minor` по всей группе (не по странице), в текущей валюте. */
  totalMinor: number;
}

/** Full item snapshot inside the detail projection — historical values only. */
export interface OrderItemView {
  productTitleSnapshot: string;
  productImageSnapshot: string | null;
  variantNameSnapshot: string | null;
  variantValueSnapshot: string | null;
  linkingAttributesSnapshot: Array<{ name: string; value: string }>;
  quantity: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
}

/** Delivery snapshot recorded at checkout. */
export interface OrderDelivery {
  fullName: string;
  phone: string;
  address: string;
}

/**
 * Actor-scoped contact (docs/22 §5.4): the buyer sees the store support handle,
 * the seller sees the buyer Telegram username snapshot; the non-applicable side is null.
 */
export interface OrderContact {
  supportHandle: string | null;
  telegramUsername: string | null;
}

/** Composed detail projection — one read for order + items + contact (docs/22 §5.3). */
export interface OrderDetails {
  id: string;
  publicOrderNumber: string;
  status: OrderStatus;
  deliveryOutcome: DeliveryOutcome | null;
  refusalReasonCode: RefusalReasonCode | null;
  currencyCode: string;
  currencySymbol: string;
  subtotalMinor: number;
  totalMinor: number;
  createdAt: string;
  updatedAt: string;
  cancelledAt: string | null;
  completedAt: string | null;
  refusedAt: string | null;
  delivery: OrderDelivery;
  contact: OrderContact;
  items: OrderItemView[];
}
