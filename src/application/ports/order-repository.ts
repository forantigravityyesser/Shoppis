import type { Order, OrderItem } from '../../domain/models/order';

export interface OrderRepository {
  fetchBuyerOrders(storeId: string, buyerUserId: string): Promise<Order[]>;
  fetchStoreOrders(storeId: string): Promise<Order[]>;
  fetchOrderItems(orderId: string): Promise<OrderItem[]>;
}
