import type { StateCreator } from 'zustand';
import { canCheckoutCart, checkedOutItemKeys } from '../../../domain/rules/cart-rules';
import { canTransition, type OrderActor } from '../../../domain/rules/order-rules';
import { validateRecipient } from '../../../domain/rules/checkout-rules';
import type {
  DeliveryOutcome,
  Order,
  OrderItem,
  OrderStatus,
  RefusalReasonCode,
} from '../../../domain/models/order';
import type { RecipientInfo } from '../../../domain/models/customer';
import type { CheckoutResult } from '../../contracts/checkout';
import { deps } from '../../composition/container';
import type { RootStore } from '../index';

export interface OrderSlice {
  ordersByStore: Record<string, Order[]>;
  orderItemsByOrder: Record<string, OrderItem[]>;
  ordersLoading: boolean;
  ordersError: string | null;
  lastOrderId: string | null;
  /** Результат последнего успешного оформления (номер/сумма) — для экрана успеха. */
  lastOrder: CheckoutResult | null;
  fetchBuyerOrders: () => Promise<void>;
  fetchStoreOrders: () => Promise<void>;
  fetchItems: (orderId: string) => Promise<OrderItem[]>;
  changeStatus: (orderId: string, status: OrderStatus, actor?: OrderActor) => Promise<void>;
  cancelOrder: (orderId: string, actor?: OrderActor, reason?: string) => Promise<void>;
  recordDeliveryOutcome: (
    orderId: string,
    outcome: DeliveryOutcome,
    reason?: RefusalReasonCode,
  ) => Promise<void>;
  reconcileInventory: (
    variantId: string,
    quantity: number,
    reason?: string,
    orderId?: string,
  ) => Promise<void>;
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
  resetOrders: () => void;
  /** Сбросить результат последнего заказа (после показа экрана успеха). */
  resetCheckout: () => void;
}

export const createOrderSlice: StateCreator<RootStore, [], [], OrderSlice> = (set, get) => {
  const refresh = async () => {
    if (get().context === 'seller') {
      await get().fetchStoreOrders();
    } else {
      await get().fetchBuyerOrders();
    }
  };

  return {
    ordersByStore: {},
    orderItemsByOrder: {},
    ordersLoading: false,
    ordersError: null,
    lastOrderId: null,
    lastOrder: null,

    fetchBuyerOrders: async () => {
      const { storeId, serverUser } = get();
      if (!storeId || !serverUser) return;
      set({ ordersLoading: true, ordersError: null });
      try {
        const orders = await deps().orderRepository.fetchBuyerOrders(storeId, serverUser.id);
        set((s) => ({
          ordersByStore: { ...s.ordersByStore, [storeId]: orders },
          ordersLoading: false,
        }));
      } catch (e) {
        set({ ordersLoading: false, ordersError: (e as Error).message });
        throw e;
      }
    },

    fetchStoreOrders: async () => {
      const { storeId } = get();
      if (!storeId) return;
      set({ ordersLoading: true, ordersError: null });
      try {
        const orders = await deps().orderRepository.fetchStoreOrders(storeId);
        set((s) => ({
          ordersByStore: { ...s.ordersByStore, [storeId]: orders },
          ordersLoading: false,
        }));
      } catch (e) {
        set({ ordersLoading: false, ordersError: (e as Error).message });
        throw e;
      }
    },

    fetchItems: async (orderId: string) => {
      const cached = get().orderItemsByOrder[orderId];
      if (cached) return cached;
      const items = await deps().orderRepository.fetchOrderItems(orderId);
      set((s) => ({ orderItemsByOrder: { ...s.orderItemsByOrder, [orderId]: items } }));
      return items;
    },

    changeStatus: async (orderId: string, status: OrderStatus, actor: OrderActor = 'seller') => {
      const { storeId, ordersByStore, sessionToken } = get();
      if (!storeId) throw new Error('No store selected');
      if (!sessionToken) throw new Error('Not authenticated');
      const current = (ordersByStore[storeId] ?? []).find((o) => o.id === orderId);
      if (!current) throw new Error('Order not found');
      if (!canTransition(current.status, status, actor)) {
        throw new Error(`Transition ${current.status} → ${status} is not allowed for ${actor}`);
      }
      set({ ordersLoading: true, ordersError: null });
      try {
        await deps().orderApi.transitionOrder(sessionToken, orderId, status);
        await refresh();
        set({ ordersLoading: false });
      } catch (e) {
        set({ ordersLoading: false, ordersError: (e as Error).message });
        throw e;
      }
    },

    cancelOrder: async (orderId: string, actor: OrderActor = 'seller', reason?: string) => {
      const { sessionToken } = get();
      if (!sessionToken) throw new Error('Not authenticated');
      set({ ordersLoading: true, ordersError: null });
      try {
        await deps().orderApi.cancelOrder(sessionToken, orderId, actor, reason);
        await refresh();
        set({ ordersLoading: false });
      } catch (e) {
        set({ ordersLoading: false, ordersError: (e as Error).message });
        throw e;
      }
    },

    recordDeliveryOutcome: async (
      orderId: string,
      outcome: DeliveryOutcome,
      reason?: RefusalReasonCode,
    ) => {
      const { sessionToken } = get();
      if (!sessionToken) throw new Error('Not authenticated');
      set({ ordersLoading: true, ordersError: null });
      try {
        await deps().orderApi.recordDeliveryOutcome(sessionToken, orderId, outcome, reason);
        await refresh();
        set({ ordersLoading: false });
      } catch (e) {
        set({ ordersLoading: false, ordersError: (e as Error).message });
        throw e;
      }
    },

    reconcileInventory: async (
      variantId: string,
      quantity: number,
      reason?: string,
      orderId?: string,
    ) => {
      const { sessionToken, storeId } = get();
      if (!sessionToken) throw new Error('Not authenticated');
      await deps().orderApi.reconcileInventory(sessionToken, variantId, quantity, reason, orderId);
      if (storeId) await get().fetchCatalog(storeId);
    },

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

      set({ ordersLoading: true, ordersError: null });
      try {
        // Разрешение на уведомления запрашивает вызывающий слой (`useCheckout`)
        // в жесте клика, ДО checkout: это повышает шанс доставки первого
        // уведомления «Заказ принят». Сам заказ от разрешения не зависит (04 §11).
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
        set({ lastOrderId: result.orderId, lastOrder: result, ordersLoading: false });
        // Заказ уже создан: сбой обновления списка заказов — не ошибка оформления
        // (иначе пользователь увидит «ошибку» на успешный заказ и может повторить).
        try {
          await get().fetchBuyerOrders();
        } catch (refreshError) {
          console.error('[orders] post-checkout refresh failed:', refreshError);
        }
        return result.orderId;
      } catch (e) {
        set({ ordersLoading: false, ordersError: (e as Error).message });
        throw e;
      }
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

    resetOrders: () =>
      set({
        ordersByStore: {},
        orderItemsByOrder: {},
        lastOrderId: null,
        lastOrder: null,
        ordersError: null,
      }),

    resetCheckout: () => set({ lastOrder: null, lastOrderId: null, ordersError: null }),
  };
};
