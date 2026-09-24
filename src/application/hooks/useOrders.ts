import { useStore } from '../store';

export function useOrders() {
  const storeId = useStore((s) => s.storeId);
  const ordersByStore = useStore((s) => s.ordersByStore);
  const ordersLoading = useStore((s) => s.ordersLoading);
  const ordersError = useStore((s) => s.ordersError);
  const lastOrderId = useStore((s) => s.lastOrderId);
  const fetchBuyerOrders = useStore((s) => s.fetchBuyerOrders);
  const fetchStoreOrders = useStore((s) => s.fetchStoreOrders);
  const fetchItems = useStore((s) => s.fetchItems);
  const changeStatus = useStore((s) => s.changeStatus);
  const placeOrder = useStore((s) => s.placeOrder);
  return {
    orders: (storeId && ordersByStore[storeId]) || [],
    ordersLoading,
    ordersError,
    lastOrderId,
    fetchBuyerOrders,
    fetchStoreOrders,
    fetchItems,
    changeStatus,
    placeOrder,
  };
}
