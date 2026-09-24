import type { CartItem } from '../../domain/models/cart';
import type { RecipientInfo } from '../../domain/models/customer';
import { insforge } from '../insforge/client';

export interface CheckoutPayload {
  items: CartItem[];
  recipientInfo: RecipientInfo;
  telegramId: string;
  storeId: string;
  username?: string;
}

export interface CheckoutResult {
  orderId: string;
  total: number;
}

/**
 * Вызов edge-функции process-checkout. Цены сервер перепроверяет сам —
 * снапшоты из корзины служат только для отображения.
 */
export async function invokeCheckout(payload: CheckoutPayload): Promise<CheckoutResult> {
  const { data, error } = await insforge.functions.invoke('process-checkout', {
    body: {
      items: payload.items
        .filter((i) => i.selected)
        .map((i) => ({
          id: i.productId,
          quantity: i.quantity,
          variantId: i.productVariantId ?? undefined,
        })),
      recipientInfo: {
        name: payload.recipientInfo.name,
        phone: payload.recipientInfo.phone,
        email: payload.recipientInfo.address,
      },
      telegramId: payload.telegramId,
      storeId: payload.storeId,
      username: payload.username,
    },
  });
  if (error) throw error;
  const result = data as { success: boolean; orderId?: string; total?: number; error?: string } | null;
  if (!result?.success || !result.orderId) {
    throw new Error(result?.error ?? 'Checkout failed');
  }
  return { orderId: result.orderId, total: Number(result.total ?? 0) };
}
