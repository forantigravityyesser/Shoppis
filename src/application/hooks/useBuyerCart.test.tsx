// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { CartItem } from '../../domain/models/cart';
import type { CartItemProjection, CartReadResult } from '../read-models/cart';
import type { StorefrontStore } from '../read-models/storefront';

const h = vi.hoisted(() => ({
  state: { items: [] as CartItem[] },
  loadCartItems: vi.fn(),
  removeByKeys: vi.fn(),
  setAllSelected: vi.fn(),
  setSelectedByKeys: vi.fn(),
  toggleSelected: vi.fn(),
  updateQty: vi.fn(),
  remove: vi.fn(),
}));

vi.mock('../composition/container', () => ({
  deps: () => ({ cartRepository: { loadCartItems: h.loadCartItems } }),
}));

vi.mock('./useCart', () => ({
  useCart: () => ({
    items: h.state.items,
    count: 0,
    subtotal: 0,
    total: 0,
    addToCart: () => {},
    updateQty: h.updateQty,
    toggleSelected: h.toggleSelected,
    removeFromCart: h.remove,
    setAllSelected: h.setAllSelected,
    setSelectedByKeys: h.setSelectedByKeys,
    removeByKeys: h.removeByKeys,
    clearCart: () => {},
  }),
}));

import { useBuyerCart } from './useBuyerCart';
import { cartItemKey } from '../../domain/rules/cart-rules';

const STORE: StorefrontStore = {
  id: 's1',
  publicId: 'pub1',
  name: 'Shop',
  bannerUrl: null,
  status: 'ACTIVE',
  currencyCode: 'USD',
  currencySymbol: '$',
};

function item(overrides: Partial<CartItem> = {}): CartItem {
  return { productId: 'p1', productVariantId: 'v1', quantity: 1, price: 1000, selected: true, ...overrides };
}

function projection(overrides: Partial<CartItemProjection> = {}): CartItemProjection {
  return {
    productId: 'p1',
    variantId: 'v1',
    productAvailable: true,
    variantAvailable: true,
    title: 'T-Shirt',
    imageUrl: null,
    variantName: 'Size',
    variantValue: 'M',
    unitPrice: 1000,
    availableQuantity: 10,
    ...overrides,
  };
}

function read(store: StorefrontStore = STORE, items: CartItemProjection[] = [projection()]): CartReadResult {
  return { store, items };
}

let client: QueryClient;

beforeEach(() => {
  h.state.items = [];
  h.loadCartItems.mockReset();
  h.removeByKeys.mockReset();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

describe('useBuyerCart', () => {
  it('без publicId не ходит в сеть; позиции не рендерятся, но корзина не пуста', () => {
    h.state.items = [item()];
    const { result } = renderHook(() => useBuyerCart(null), { wrapper });

    expect(h.loadCartItems).not.toHaveBeenCalled();
    expect(result.current.items).toEqual([]);
    expect(result.current.isEmpty).toBe(false);
    expect(result.current.canCheckout).toBe(false);
  });

  it('пустая корзина не ходит в сеть', () => {
    const { result } = renderHook(() => useBuyerCart('pub1'), { wrapper });

    expect(h.loadCartItems).not.toHaveBeenCalled();
    expect(result.current.isEmpty).toBe(true);
    expect(result.current.loading).toBe(false);
  });

  it('грузит проекцию, отдаёт рендер-позиции и разрешает оформление', async () => {
    h.state.items = [item({ quantity: 2, selected: true })];
    h.loadCartItems.mockResolvedValue(read());

    const { result } = renderHook(() => useBuyerCart('pub1'), { wrapper });

    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(result.current.items[0].view.title).toBe('T-Shirt');
    expect(result.current.items[0].orderable).toBe(true);
    expect(result.current.selectionState).toBe('all');
    expect(result.current.canCheckout).toBe(true);
    expect(h.loadCartItems).toHaveBeenCalledWith('pub1', [
      { productId: 'p1', productVariantId: 'v1' },
    ]);
  });

  it('недостаток стока у выбранной позиции → блокирует оформление', async () => {
    h.state.items = [item({ quantity: 5, selected: true })];
    h.loadCartItems.mockResolvedValue(read(STORE, [projection({ availableQuantity: 2 })]));

    const { result } = renderHook(() => useBuyerCart('pub1'), { wrapper });

    await waitFor(() => expect(result.current.hasUnavailableSelected).toBe(true));
    expect(result.current.hasUnavailable).toBe(true);
    expect(result.current.items[0].orderable).toBe(false);
    expect(result.current.canCheckout).toBe(false);
  });

  it('пропавшая из витрины ссылка удаляется из Cart (removeByKeys)', async () => {
    h.state.items = [item()];
    h.loadCartItems.mockResolvedValue(read(STORE, [projection({ productAvailable: false })]));

    renderHook(() => useBuyerCart('pub1'), { wrapper });

    await waitFor(() => expect(h.removeByKeys).toHaveBeenCalledWith([cartItemKey('p1', 'v1')]));
  });

  it('проекция удалила все позиции → resolved=true, isEmpty=true (без error-flash)', async () => {
    // Локальный Cart ещё не очищен эффектом removeByKeys (мок не мутирует state).
    h.state.items = [item()];
    h.loadCartItems.mockResolvedValue(read(STORE, [projection({ productAvailable: false })]));

    const { result } = renderHook(() => useBuyerCart('pub1'), { wrapper });

    await waitFor(() => expect(result.current.resolved).toBe(true));
    expect(result.current.items).toEqual([]);
    expect(result.current.isEmpty).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('ошибка проекции → resolved=false (экран ошибки), не пустое состояние', async () => {
    h.state.items = [item()];
    h.loadCartItems.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useBuyerCart('pub1'), { wrapper });

    await waitFor(() => expect(result.current.error).toBe('boom'));
    expect(result.current.resolved).toBe(false);
  });

  it('распроданная выбранная позиция снимается с оформления', async () => {
    h.state.items = [item({ selected: true, quantity: 1 })];
    h.loadCartItems.mockResolvedValue(read(STORE, [projection({ availableQuantity: 0 })]));

    renderHook(() => useBuyerCart('pub1'), { wrapper });

    await waitFor(() =>
      expect(h.setSelectedByKeys).toHaveBeenCalledWith([cartItemKey('p1', 'v1')], false),
    );
  });

  it('PAUSED магазин: позиции читаются, оформление запрещено', async () => {
    h.state.items = [item()];
    h.loadCartItems.mockResolvedValue(read({ ...STORE, status: 'PAUSED' }));

    const { result } = renderHook(() => useBuyerCart('pub1'), { wrapper });

    await waitFor(() => expect(result.current.storePaused).toBe(true));
    expect(result.current.items).toHaveLength(1);
    expect(result.current.canCheckout).toBe(false);
  });

  it('selectionState = some при частичном выборе', async () => {
    h.state.items = [
      item({ productId: 'p1', productVariantId: 'v1', selected: true }),
      item({ productId: 'p2', productVariantId: 'v2', selected: false }),
    ];
    h.loadCartItems.mockResolvedValue(
      read(STORE, [projection(), projection({ productId: 'p2', variantId: 'v2' })]),
    );

    const { result } = renderHook(() => useBuyerCart('pub1'), { wrapper });

    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(result.current.selectionState).toBe('some');
    expect(result.current.hasSelection).toBe(true);
    expect(result.current.canCheckout).toBe(true);
  });

  it('ошибка загрузки → error, позиции не рендерятся', async () => {
    h.state.items = [item()];
    h.loadCartItems.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useBuyerCart('pub1'), { wrapper });

    await waitFor(() => expect(result.current.error).toBe('boom'));
    expect(result.current.items).toEqual([]);
  });

  it('refresh повторяет запрос', async () => {
    h.state.items = [item()];
    h.loadCartItems.mockResolvedValue(read());

    const { result } = renderHook(() => useBuyerCart('pub1'), { wrapper });
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(h.loadCartItems).toHaveBeenCalledTimes(1);

    act(() => result.current.refresh());
    await waitFor(() => expect(h.loadCartItems).toHaveBeenCalledTimes(2));
  });
});
