import { insforge } from '../insforge/client';
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

type InvokeOptions = { body?: unknown; headers?: Record<string, string> };

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

  const { data, error } = await (insforge.functions.invoke as unknown as (
    name: string,
    options?: InvokeOptions,
  ) => Promise<{ data: unknown; error: unknown }>)('process-checkout', {
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
    headers: { Authorization: `Bearer ${payload.sessionToken}` },
  });
  if (error) throw error;

  const res = data as {
    success?: boolean;
    orderId?: string;
    orderNumber?: string;
    totalMinor?: number;
    currencyCode?: string;
    error?: string;
  } | null;
  if (!res?.success || !res.orderId) {
    throw new Error(res?.error ?? 'Checkout failed');
  }
  return {
    orderId: res.orderId,
    orderNumber: res.orderNumber ?? '',
    totalMinor: Number(res.totalMinor ?? 0),
    currencyCode: res.currencyCode ?? '',
  };
}
