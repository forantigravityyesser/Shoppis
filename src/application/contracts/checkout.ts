import type { CartItem } from '../../domain/models/cart';
import type { RecipientInfo } from '../../domain/models/customer';

/** Вход оформления заказа через edge-функцию process-checkout. */
export interface CheckoutPayload {
  items: CartItem[];
  recipientInfo: RecipientInfo;
  storeId: string;
  sessionToken: string;
  /**
   * Обязательный ключ идемпотентности (docs/21 §3.1-3.2): один attempt = один
   * ключ. Сервер (`process-checkout` / `create_order_atomic`) отвергает пустой
   * ключ, поэтому fallback-генерация здесь запрещена.
   */
  idempotencyKey: string;
}

/** Результат оформления заказа. */
export interface CheckoutResult {
  orderId: string;
  orderNumber: string;
  totalMinor: number;
  currencyCode: string;
}
