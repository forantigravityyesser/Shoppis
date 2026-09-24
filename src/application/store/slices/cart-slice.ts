import type { StateCreator } from 'zustand';
import { MAX_CART_QTY } from '../../../domain/constants/limits';
import type { CartItem } from '../../../domain/models/cart';
import type { RootStore } from '../index';

function sameKey(a: Pick<CartItem, 'productId' | 'productVariantId'>, b: Pick<CartItem, 'productId' | 'productVariantId'>): boolean {
  return a.productId === b.productId && (a.productVariantId ?? null) === (b.productVariantId ?? null);
}

const clampQty = (qty: number): number =>
  Math.min(Math.max(Math.floor(qty) || 1, 1), MAX_CART_QTY);

export interface CartSlice {
  /** Изоляция корзин: своя корзина в каждой витрине */
  cartByStore: Record<string, CartItem[]>;
  addToCart: (item: Omit<CartItem, 'quantity' | 'selected'> & { quantity?: number }) => void;
  updateQty: (productId: string, variantId: string | null, quantity: number) => void;
  toggleSelected: (productId: string, variantId: string | null) => void;
  removeFromCart: (productId: string, variantId: string | null) => void;
  clearCart: () => void;
}

export const createCartSlice: StateCreator<RootStore, [], [], CartSlice> = (set, get) => ({
  cartByStore: {},

  addToCart: (item) => {
    const { storeId } = get();
    if (!storeId) return;
    const qty = clampQty(item.quantity ?? 1);
    set((s) => {
      const current = s.cartByStore[storeId] ?? [];
      const existing = current.find((i) => sameKey(i, item));
      const next = existing
        ? current.map((i) =>
            sameKey(i, item) ? { ...i, quantity: clampQty(i.quantity + qty), selected: true } : i,
          )
        : [...current, { ...item, quantity: qty, selected: true }];
      return { cartByStore: { ...s.cartByStore, [storeId]: next } };
    });
  },

  updateQty: (productId, variantId, quantity) => {
    const { storeId } = get();
    if (!storeId) return;
    const key = { productId, productVariantId: variantId };
    set((s) => ({
      cartByStore: {
        ...s.cartByStore,
        [storeId]: (s.cartByStore[storeId] ?? []).map((i) =>
          sameKey(i, key) ? { ...i, quantity: clampQty(quantity) } : i,
        ),
      },
    }));
  },

  toggleSelected: (productId, variantId) => {
    const { storeId } = get();
    if (!storeId) return;
    const key = { productId, productVariantId: variantId };
    set((s) => ({
      cartByStore: {
        ...s.cartByStore,
        [storeId]: (s.cartByStore[storeId] ?? []).map((i) =>
          sameKey(i, key) ? { ...i, selected: !i.selected } : i,
        ),
      },
    }));
  },

  removeFromCart: (productId, variantId) => {
    const { storeId } = get();
    if (!storeId) return;
    const key = { productId, productVariantId: variantId };
    set((s) => ({
      cartByStore: {
        ...s.cartByStore,
        [storeId]: (s.cartByStore[storeId] ?? []).filter((i) => !sameKey(i, key)),
      },
    }));
  },

  clearCart: () => {
    const { storeId } = get();
    if (!storeId) return;
    set((s) => ({ cartByStore: { ...s.cartByStore, [storeId]: [] } }));
  },
});
