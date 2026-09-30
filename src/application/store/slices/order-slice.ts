import type { StateCreator } from 'zustand';
import { canCheckout } from '../../../domain/rules/cart-rules';
import { canTransition, type OrderActor } from '../../../domain/rules/order-rules';
import type {
  DeliveryOutcome,
  Order,
  OrderItem,
  OrderStatus,
  RefusalReasonCode,
} from '../../../domain/models/order';
import type { RecipientInfo } from '../../../domain/models/customer';
import { deps } from '../../composition/container';
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

    reconcileInventory: async (variantId: string, quantity: number, reason?: string) => {
      const { sessionToken, storeId } = get();
      if (!sessionToken) throw new Error('Not authenticated');
      await deps().orderApi.reconcileInventory(sessionToken, variantId, quantity, reason);
      if (storeId) await get().fetchCatalog(storeId);
    },

    placeOrder: async (recipient: RecipientInfo) => {
      const { storeId, sessionToken, cartByStore } = get();
      if (!storeId) throw new Error('No store selected');
      if (!sessionToken) throw new Error('Not authenticated');
      const items = cartByStore[storeId] ?? [];
      if (!canCheckout(items, recipient)) throw new Error('Cart or recipient is invalid');

      set({ ordersLoading: true, ordersError: null });
      try {
        // BEST-EFFORT: промпт Telegram — до checkout, чтобы у «Заказ принят» был
        // шанс дойти. Метод ограничен по времени и никогда не бросает; отказ или
        // таймаут не влияют на создание заказа.
        try {
          await deps().telegram.requestMessagesAccess();
        } catch {
          // no-op: уведомление не должно ломать заказ
        }
        const { orderId } = await deps().checkoutApi.invokeCheckout({
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
