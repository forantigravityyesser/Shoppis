import { invokeFunction } from '../insforge/functions-gateway';
import type { CartItem } from '../../domain/models/cart';
import type { RecipientInfo } from '../../domain/models/customer';

export interface CheckoutPayload {
  items: CartItem[];
  recipientInfo: RecipientInfo;
  storeId: string;
  sessionToken: string;
  idempotencyKey?: string;
}

export interface CheckoutResult {
  orderId: string;
  orderNumber: string;
  totalMinor: number;
  currencyCode: string;
}

interface CheckoutResponse {
  success?: boolean;
  orderId?: string;
  orderNumber?: string;
  totalMinor?: number;
  currencyCode?: string;
  error?: string;
}

/**
 * Оформление заказа через edge-функцию process-checkout.
 * Сервер проверяет сессию, заново считает цену/остаток и создаёт заказ атомарно.
 * idempotencyKey защищает от дублей при повторном клике/ретрае.
 */
export async function invokeCheckout(payload: CheckoutPayload): Promise<CheckoutResult> {
  const idempotencyKey = payload.idempotencyKey ?? crypto.randomUUID();
  const items = payload.items
    .filter((i) => i.selected)
    .map((i) => ({ variantId: i.productVariantId ?? '', quantity: i.quantity }))
    .filter((i) => i.variantId);

  const { data, error } = await invokeFunction<CheckoutResponse>('process-checkout', {
    body: {
      storeId: payload.storeId,
      idempotencyKey,
      items,
      recipient: {
        name: payload.recipientInfo.name,
        phone: payload.recipientInfo.phone,
        address: payload.recipientInfo.address,
      },
    },
    token: payload.sessionToken,
  });
  if (error) throw new Error(error.message);

  if (!data?.success || !data.orderId) {
    throw new Error(data?.error ?? 'Checkout failed');
  }
  return {
    orderId: data.orderId,
    orderNumber: data.orderNumber ?? '',
    totalMinor: Number(data.totalMinor ?? 0),
    currencyCode: data.currencyCode ?? '',
  };
}
