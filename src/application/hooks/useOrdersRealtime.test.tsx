// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { OrderRealtimeListener } from '../ports/order-realtime';

const h = vi.hoisted(() => {
  const state = {
    storeId: 'store-1' as string | null,
    serverUser: { id: 'user-1' } as { id: string } | null,
  };
  return {
    state,
    storeSub: vi.fn<(storeId: string, listener: OrderRealtimeListener) => () => void>(
      () => () => {},
    ),
    buyerSub: vi.fn<(userId: string, listener: OrderRealtimeListener) => () => void>(
      () => () => {},
    ),
  };
});

vi.mock('../composition/container', () => ({
  deps: () => ({
    orderRealtime: {
      subscribeStoreOrders: h.storeSub,
      subscribeBuyerOrders: h.buyerSub,
    },
  }),
}));

vi.mock('../store', () => ({
  useStore: (selector: (s: typeof h.state) => unknown) => selector(h.state),
}));

import { useOrdersRealtime } from './useOrdersRealtime';

let client: QueryClient;
let invalidate: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  h.storeSub.mockClear();
  h.buyerSub.mockClear();
  h.state.storeId = 'store-1';
  h.state.serverUser = { id: 'user-1' };
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  invalidate = vi.spyOn(client, 'invalidateQueries');
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

function listenerFrom(
  mock: typeof h.buyerSub | typeof h.storeSub,
): OrderRealtimeListener {
  const calls = mock.mock.calls;
  return calls[calls.length - 1][1];
}

function lastListener(): OrderRealtimeListener {
  return listenerFrom(h.buyerSub);
}

describe('useOrdersRealtime (docs/22 ORD-14)', () => {
  it('buyer: подписка на собственные заказы + инвалидация списка и детали заказа', () => {
    renderHook(() => useOrdersRealtime({ scope: 'buyer' }), { wrapper });

    expect(h.buyerSub).toHaveBeenCalledTimes(1);
    expect(h.buyerSub.mock.calls[0][0]).toBe('user-1');

    lastListener()({ orderId: 'o1', status: 'DELIVERED' });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['orders'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['order', 'buyer', 'o1'] });
  });

  it('detail изменившегося заказа инвалидируется, даже когда деталь не открыта (не только «свой» orderId)', () => {
    renderHook(() => useOrdersRealtime({ scope: 'buyer' }), { wrapper });

    lastListener()({ orderId: 'o2', status: 'IN_TRANSIT' });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['order', 'buyer', 'o2'] });
    expect(invalidate).not.toHaveBeenCalledWith({ queryKey: ['order', 'buyer', 'o1'] });
  });

  it('seller: подписка на магазин + инвалидация списка и детали в seller-скоупе', () => {
    renderHook(() => useOrdersRealtime({ scope: 'seller' }), { wrapper });

    expect(h.storeSub).toHaveBeenCalledTimes(1);
    expect(h.storeSub.mock.calls[0][0]).toBe('store-1');
    expect(h.buyerSub).not.toHaveBeenCalled();

    listenerFrom(h.storeSub)({ orderId: 'o9', status: 'NEW' });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['orders'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['order', 'seller', 'o9'] });
  });

  it('без userId у покупателя подписки нет', () => {
    h.state.serverUser = null;
    renderHook(() => useOrdersRealtime({ scope: 'buyer' }), { wrapper });

    expect(h.buyerSub).not.toHaveBeenCalled();
  });

  it('без storeRef у продавца подписки нет', () => {
    h.state.storeId = null;
    renderHook(() => useOrdersRealtime({ scope: 'seller' }), { wrapper });

    expect(h.storeSub).not.toHaveBeenCalled();
  });

  it('размонтирование отписывается', () => {
    const off = vi.fn();
    h.buyerSub.mockReturnValueOnce(off);

    const { unmount } = renderHook(() => useOrdersRealtime({ scope: 'buyer' }), { wrapper });
    unmount();

    expect(off).toHaveBeenCalledTimes(1);
  });
});
