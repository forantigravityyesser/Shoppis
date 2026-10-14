import type {
  OrderDetails,
  OrderListPage,
  OrderScope,
  OrderStatusFilter,
  SalesGroup,
  SalesListPage,
} from '../read-models/order';

/** Query-only ports for the Orders read contour (docs/22 §4.2). No writes live here. */
export interface OrderListQuery {
  sessionToken: string;
  scope: OrderScope;
  /** Opaque storefront reference (public_id; legacy internal id is resolved server-side). */
  storeRef: string;
  statusFilter?: OrderStatusFilter;
  cursor?: string | null;
  limit?: number;
}

export interface OrderDetailsQuery {
  sessionToken: string;
  scope: OrderScope;
  orderId: string;
}

/** Запрос списка продаж (seller-only, docs/25 §3.2). */
export interface SalesListQuery {
  sessionToken: string;
  storeRef: string;
  group: SalesGroup;
  cursor?: string | null;
  limit?: number;
}

export interface OrderRepository {
  listOrders(query: OrderListQuery): Promise<OrderListPage>;
  /** Foreign / nonexistent order resolves to the same safe `null`. */
  getOrderDetails(query: OrderDetailsQuery): Promise<OrderDetails | null>;
  /** Продажи (вкладка «Продажи») — проекция заказов по исходу вручения (docs/25). */
  listSales(query: SalesListQuery): Promise<SalesListPage>;
}
