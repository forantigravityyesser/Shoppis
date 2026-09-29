import type { CartItem } from '../../domain/models/cart';
import type { RecipientInfo } from '../../domain/models/customer';

/** Вход оформления заказа через edge-функцию process-checkout. */
export interface CheckoutPayload {
  items: CartItem[];
  recipientInfo: RecipientInfo;
  storeId: string;
  sessionToken: string;
  idempotencyKey?: string;
}

/** Результат оформления заказа. */
export interface CheckoutResult {
  orderId: string;
  orderNumber: string;
  totalMinor: number;
  currencyCode: string;
}
