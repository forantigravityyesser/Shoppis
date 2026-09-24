import { calcSubtotal, calcTotal } from '../../domain/rules/cart-rules';
import { useStore } from '../store';

export function useCart() {
  const storeId = useStore((s) => s.storeId);
  const cartByStore = useStore((s) => s.cartByStore);
  const addToCart = useStore((s) => s.addToCart);
  const updateQty = useStore((s) => s.updateQty);
  const toggleSelected = useStore((s) => s.toggleSelected);
  const removeFromCart = useStore((s) => s.removeFromCart);
  const clearCart = useStore((s) => s.clearCart);

  const items = (storeId && cartByStore[storeId]) || [];
  return {
    items,
    count: items.reduce((n, i) => n + i.quantity, 0),
    subtotal: calcSubtotal(items),
    total: calcTotal(items),
    addToCart,
    updateQty,
    toggleSelected,
    removeFromCart,
    clearCart,
  };
}
