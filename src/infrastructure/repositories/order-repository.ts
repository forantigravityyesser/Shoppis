import { requestOrderDetails, requestOrderList } from '../functions/order-query-api';
import { mapOrderDetails, mapOrderListPage } from '../../application/mappers/order-mappers';
import type {
  OrderDetailsQuery,
  OrderListQuery,
  OrderRepository,
} from '../../application/ports/order-repository';
import type { OrderDetails, OrderListPage } from '../../application/read-models/order';

/**
 * Orders read repository (query-only).
 *
 * Читает через edge `order-queries`: actor identity берётся из подписанной сессии,
 * авторизация — в SQL (`order_list_read` / `order_detail_read`); клиент не делает
 * прямых табличных reads и не передаёт actor/buyer id как permission (docs/22 §4.3-4.4).
 * Сырые проекции нормализуются в read models application-маппером.
 */

export const listOrders: OrderRepository['listOrders'] = async (
  query: OrderListQuery,
): Promise<OrderListPage> => {
  const raw = await requestOrderList(query.sessionToken, {
    scope: query.scope,
    storeRef: query.storeRef,
    statusFilter: query.statusFilter,
    cursor: query.cursor,
    limit: query.limit,
  });
  return mapOrderListPage(raw);
};

export const getOrderDetails: OrderRepository['getOrderDetails'] = async (
  query: OrderDetailsQuery,
): Promise<OrderDetails | null> => {
  const raw = await requestOrderDetails(query.sessionToken, {
    scope: query.scope,
    orderId: query.orderId,
  });
  return mapOrderDetails(raw);
};
