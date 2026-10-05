import type { StateCreator } from 'zustand';
import { cartItemKey, clampCartQuantity } from '../../../domain/rules/cart-rules';
import type { CartItem } from '../../../domain/models/cart';
import type { RootStore } from '../index';

function sameKey(
  a: Pick<CartItem, 'productId' | 'productVariantId'>,
  b: Pick<CartItem, 'productId' | 'productVariantId'>,
): boolean {
  return (
    cartItemKey(a.productId, a.productVariantId) ===
    cartItemKey(b.productId, b.productVariantId)
  );
}

const clampQty = clampCartQuantity;

export interface CartSlice {
  /** Изоляция корзин: своя корзина в каждой витрине */
  cartByStore: Record<string, CartItem[]>;
  addToCart: (item: Omit<CartItem, 'quantity' | 'selected'> & { quantity?: number }) => void;
  updateQty: (productId: string, variantId: string | null, quantity: number) => void;
  toggleSelected: (productId: string, variantId: string | null) => void;
  /** Проставить/снять выбор у всех позиций текущей витрины (docs/18 §17). */
  setAllSelected: (selected: boolean) => void;
  /** Проставить/снять выбор адресно по ключам `cartItemKey` (docs/18 §17/§18). */
  setSelectedByKeys: (keys: string[], selected: boolean) => void;
  removeFromCart: (productId: string, variantId: string | null) => void;
  /** Удалить позиции по ключам `cartItemKey` (реконсиляция, docs/18 §10). */
  removeByKeys: (keys: string[]) => void;
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

  setAllSelected: (selected) => {
    const { storeId } = get();
    if (!storeId) return;
    set((s) => ({
      cartByStore: {
        ...s.cartByStore,
        [storeId]: (s.cartByStore[storeId] ?? []).map((i) => ({ ...i, selected })),
      },
    }));
  },

  setSelectedByKeys: (keys, selected) => {
    const { storeId } = get();
    if (!storeId || keys.length === 0) return;
    const wanted = new Set(keys);
    set((s) => ({
      cartByStore: {
        ...s.cartByStore,
        [storeId]: (s.cartByStore[storeId] ?? []).map((i) =>
          wanted.has(cartItemKey(i.productId, i.productVariantId)) ? { ...i, selected } : i,
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

  removeByKeys: (keys) => {
    const { storeId } = get();
    if (!storeId || keys.length === 0) return;
    const unwanted = new Set(keys);
    set((s) => ({
      cartByStore: {
        ...s.cartByStore,
        [storeId]: (s.cartByStore[storeId] ?? []).filter(
          (i) => !unwanted.has(cartItemKey(i.productId, i.productVariantId)),
        ),
      },
    }));
  },

  clearCart: () => {
    const { storeId } = get();
    if (!storeId) return;
    set((s) => ({ cartByStore: { ...s.cartByStore, [storeId]: [] } }));
  },
});
