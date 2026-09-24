/** EN-ключи статусов (совпадают с колонкой status в БД) */
export type OrderStatus = 'pending' | 'shipped' | 'delivered' | 'cancelled';

export interface Order {
  id: string;
  storeId: string;
  customerId: string;
  subtotal: number;
  total: number;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  status: OrderStatus;
  createdAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  productVariantId: string | null;
  quantity: number;
  unitPrice: number;
}
