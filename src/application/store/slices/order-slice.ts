import type { StateCreator } from 'zustand';
import { canCheckout } from '../../../domain/rules/cart-rules';
import { canTransition, type OrderActor } from '../../../domain/rules/order-rules';
import type { DeliveryOutcome, Order, OrderItem, OrderStatus, RefusalReasonCode } from '../../../domain/models/order';
import type { RecipientInfo } from '../../../domain/models/customer';
import { invokeCheckout } from '../../../infrastructure/functions/checkout-api';
import {
  cancelOrder as cancelOrderApi,
  recordDeliveryOutcome as recordDeliveryOutcomeApi,
  reconcileInventory as reconcileInventoryApi,
  transitionOrder as transitionOrderApi,
} from '../../../infrastructure/functions/order-api';
import {
  fetchBuyerOrders as fetchBuyerOrdersRepo,
  fetchOrderItems as fetchOrderItemsRepo,
  fetchStoreOrders as fetchStoreOrdersRepo,
} from '../../../infrastructure/repositories/order-repository';
import { requestMessagesAccess } from '../../../infrastructure/telegram/telegram-share';
import type { RootStore } from '../index';

export interface OrderSlice {
  ordersByStore: Record<string, Order[]>;
  orderItemsByOrder: Record<string, OrderItem[]>;
  ordersLoading: boolean;
  ordersError: string | null;
  lastOrderId: string | null;
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
  reconcileInventory: (variantId: string, quantity: number, reason?: string) => Promise<void>;
  placeOrder: (recipient: RecipientInfo) => Promise<string>;
  resetOrders: () => void;
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

    fetchBuyerOrders: async () => {
      const { storeId, serverUser } = get();
      if (!storeId || !serverUser) return;
      set({ ordersLoading: true, ordersError: null });
      try {
        const orders = await fetchBuyerOrdersRepo(storeId, serverUser.id);
        set((s) => ({ ordersByStore: { ...s.ordersByStore, [storeId]: orders }, ordersLoading: false }));
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
        const orders = await fetchStoreOrdersRepo(storeId);
        set((s) => ({ ordersByStore: { ...s.ordersByStore, [storeId]: orders }, ordersLoading: false }));
      } catch (e) {
        set({ ordersLoading: false, ordersError: (e as Error).message });
        throw e;
      }
    },

    fetchItems: async (orderId: string) => {
      const cached = get().orderItemsByOrder[orderId];
      if (cached) return cached;
      const items = await fetchOrderItemsRepo(orderId);
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
        await transitionOrderApi(sessionToken, orderId, status);
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
        await cancelOrderApi(sessionToken, orderId, actor, reason);
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
        await recordDeliveryOutcomeApi(sessionToken, orderId, outcome, reason);
        await refresh();
        set({ ordersLoading: false });
      } catch (e) {
        set({ ordersLoading: false, ordersError: (e as Error).message });
        throw e;
      }
    },

    reconcileInventory: async (variantId: string, quantity: number, reason?: string) => {
      const { sessionToken, storeId } = get();
      if (!sessionToken) throw new Error('Not authenticated');
      await reconcileInventoryApi(sessionToken, variantId, quantity, reason);
      if (storeId) await get().fetchCatalog(storeId);
    },

    placeOrder: async (recipient: RecipientInfo) => {
      const { storeId, user, sessionToken, cartByStore } = get();
      if (!storeId) throw new Error('No store selected');
      if (!user) throw new Error('No Telegram user');
      if (!sessionToken) throw new Error('Not authenticated');
      const items = cartByStore[storeId] ?? [];
      if (!canCheckout(items, recipient)) throw new Error('Cart or recipient is invalid');

      set({ ordersLoading: true, ordersError: null });
      try {
        // Официальный промпт Telegram — до checkout, иначе «Заказ принят» не дойдёт
        await requestMessagesAccess();
        const { orderId } = await invokeCheckout({
          items,
          recipientInfo: recipient,
          storeId,
          sessionToken,
          idempotencyKey: crypto.randomUUID(),
        });
        get().clearCart();
        set({ lastOrderId: orderId, ordersLoading: false });
        await get().fetchBuyerOrders();
        return orderId;
      } catch (e) {
        set({ ordersLoading: false, ordersError: (e as Error).message });
        throw e;
      }
    },

    resetOrders: () =>
      set({ ordersByStore: {}, orderItemsByOrder: {}, lastOrderId: null, ordersError: null }),
  };
};
