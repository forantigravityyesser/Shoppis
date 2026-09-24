import type { StateCreator } from 'zustand';
import { canCheckout } from '../../../domain/rules/cart-rules';
import { isCancellable, nextAllowedStatus } from '../../../domain/rules/order-rules';
import type { Order, OrderItem, OrderStatus } from '../../../domain/models/order';
import type { RecipientInfo } from '../../../domain/models/customer';
import { invokeCheckout } from '../../../infrastructure/functions/checkout-api';
import {
  fetchBuyerOrders as fetchBuyerOrdersRepo,
  fetchOrderItems as fetchOrderItemsRepo,
  fetchStoreOrders as fetchStoreOrdersRepo,
  updateOrderStatus as updateOrderStatusRepo,
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
  changeStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  placeOrder: (recipient: RecipientInfo) => Promise<string>;
  resetOrders: () => void;
}

export const createOrderSlice: StateCreator<RootStore, [], [], OrderSlice> = (set, get) => ({
  ordersByStore: {},
  orderItemsByOrder: {},
  ordersLoading: false,
  ordersError: null,
  lastOrderId: null,

  fetchBuyerOrders: async () => {
    const { storeId, user } = get();
    if (!storeId || !user) return;
    set({ ordersLoading: true, ordersError: null });
    try {
      const orders = await fetchBuyerOrdersRepo(storeId, user.id);
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

  changeStatus: async (orderId: string, status: OrderStatus) => {
    const { storeId, ordersByStore } = get();
    if (!storeId) throw new Error('No store selected');
    const current = (ordersByStore[storeId] ?? []).find((o) => o.id === orderId);
    if (!current) throw new Error('Order not found');
    const allowed = status === 'cancelled' ? isCancellable(current.status) : nextAllowedStatus(current.status) === status;
    if (!allowed) throw new Error(`Transition ${current.status} → ${status} is not allowed`);
    const updated = await updateOrderStatusRepo(orderId, status);
    set((s) => ({
      ordersByStore: {
        ...s.ordersByStore,
        [storeId]: (s.ordersByStore[storeId] ?? []).map((o) => (o.id === orderId ? updated : o)),
      },
    }));
  },

  placeOrder: async (recipient: RecipientInfo) => {
    const { storeId, user, cartByStore } = get();
    if (!storeId) throw new Error('No store selected');
    if (!user) throw new Error('No Telegram user');
    const items = cartByStore[storeId] ?? [];
    if (!canCheckout(items, recipient)) throw new Error('Cart or recipient is invalid');

    set({ ordersLoading: true, ordersError: null });
    try {
      // Официальный промпт Telegram — до checkout, иначе «Заказ принят» не дойдёт
      await requestMessagesAccess();
      const { orderId } = await invokeCheckout({
        items,
        recipientInfo: recipient,
        telegramId: user.id,
        storeId,
        username: user.username,
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

  resetOrders: () => set({ ordersByStore: {}, orderItemsByOrder: {}, lastOrderId: null, ordersError: null }),
});
