import type { StateCreator } from 'zustand';
import { canCheckoutCart, checkedOutItemKeys } from '../../../domain/rules/cart-rules';
import { validateRecipient } from '../../../domain/rules/checkout-rules';
import type { RecipientInfo } from '../../../domain/models/customer';
import type { CheckoutResult } from '../../contracts/checkout';
import { deps } from '../../composition/container';
import type { RootStore } from '../index';

/**
 * Checkout-исход (docs/22 §5.9, ORD-04). Server state заказов (list/detail/status)
 * живёт в React Query (`useOrders`/`useOrderDetails`/`useOrderActions`); здесь
 * остаётся только результат оформления для экрана успеха.
 */
export interface OrderSlice {
  lastOrderId: string | null;
  /** Результат последнего успешного оформления (номер/сумма) — для экрана успеха. */
  lastOrder: CheckoutResult | null;
  /**
   * Оформить заказ. `idempotencyKey` обязателен (docs/21 §3.1-3.2): ключ задаёт
   * владелец checkout-попытки (`useCheckout`), один attempt = один ключ, повтор
   * использует тот же. Сервер отвергает пустой ключ — fallback в `checkout-api`
   * больше не генерирует его.
   */
  placeOrder: (recipient: RecipientInfo, idempotencyKey: string) => Promise<string>;
  /**
   * Opt-in Telegram-уведомлений — ОТДЕЛЬНО и ПОСЛЕ успешного заказа.
   * Запрашивает write access и, при согласии, фиксирует его на сервере и шлёт
   * «Заказ принят» покупателю (досыл для только что созданного `orderId`).
   * Никогда не влияет на заказ: отказ просто означает отсутствие уведомлений.
   */
  requestNotifications: (orderId?: string) => Promise<boolean>;
  /** Сброс checkout-исхода (смена магазина/контекста). */
  resetOrders: () => void;
  /** Сбросить результат последнего заказа (после показа экрана успеха). */
  resetCheckout: () => void;
}

export const createOrderSlice: StateCreator<RootStore, [], [], OrderSlice> = (set, get) => ({
  lastOrderId: null,
  lastOrder: null,

  placeOrder: async (recipient: RecipientInfo, idempotencyKey: string) => {
    const { storeId, sessionToken, cartByStore } = get();
    if (!storeId) throw new Error('No store selected');
    if (!sessionToken) throw new Error('Not authenticated');
    const items = cartByStore[storeId] ?? [];
    // Корзина и получатель валидируются независимо (docs/21 §3.8).
    if (!canCheckoutCart(items) || !validateRecipient(recipient).valid) {
      throw new Error('Cart or recipient is invalid');
    }
    // Позиции, которые реально уходят на сервер (выбранные с вариантом): после
    // успеха удаляем из корзины только их, невыбранные остаются (docs/18 §16).
    const orderedKeys = checkedOutItemKeys(items);

    // Разрешение на уведомления запрашивает вызывающий слой (`useCheckout`) в
    // жесте клика — сам заказ от разрешения не зависит (04 §11).
    // `idempotencyKey` не генерируем здесь: один и тот же ключ должен
    // переиспользоваться при повторе (иначе повтор создаст второй заказ, docs/21 §3.1).
    const result = await deps().checkoutApi.invokeCheckout({
      items,
      recipientInfo: recipient,
      storeId,
      sessionToken,
      idempotencyKey,
    });
    get().removeByKeys(orderedKeys);
    set({ lastOrderId: result.orderId, lastOrder: result });
    return result.orderId;
  },

  requestNotifications: async (orderId?: string) => {
    const { sessionToken } = get();
    let allowed: boolean;
    try {
      allowed = await deps().telegram.requestMessagesAccess();
    } catch {
      return false;
    }
    if (allowed && sessionToken) {
      try {
        // Сервер фиксирует согласие и, если передан `orderId`, досылает
        // «Заказ принят» покупателю (первый заказ был создан без согласия).
        await deps().notificationApi.enableTelegramNotifications(sessionToken, orderId);
      } catch (e) {
        // Согласие есть, но зафиксировать не удалось — не критично для UX.
        console.warn('[notifications] persist failed:', e);
      }
    }
    return allowed;
  },

  resetOrders: () => set({ lastOrderId: null, lastOrder: null }),

  resetCheckout: () => set({ lastOrder: null, lastOrderId: null }),
});
