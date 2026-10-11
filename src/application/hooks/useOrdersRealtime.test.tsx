// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { OrderRealtimeHandlers } from '../ports/order-realtime';

const h = vi.hoisted(() => {
  const state = {
    storeId: 'store-1' as string | null,
    serverUser: { id: 'user-1' } as { id: string } | null,
  };
  return {
    state,
    storeSub: vi.fn<(storeId: string, handlers: OrderRealtimeHandlers) => () => void>(
      () => () => {},
    ),
    buyerSub: vi.fn<(userId: string, handlers: OrderRealtimeHandlers) => () => void>(
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

function handlersFrom(
  mock: typeof h.buyerSub | typeof h.storeSub,
): OrderRealtimeHandlers {
  const calls = mock.mock.calls;
  return calls[calls.length - 1][1];
}

function lastListener(): OrderRealtimeHandlers['onChange'] {
  return handlersFrom(h.buyerSub).onChange;
}

describe('useOrdersRealtime (docs/22 ORD-14)', () => {
  it('buyer: подписка на собственные заказы + инвалидация списка и детали заказа', () => {
    renderHook(() => useOrdersRealtime({ scope: 'buyer' }), { wrapper });

    expect(h.buyerSub).toHaveBeenCalledTimes(1);
    expect(h.buyerSub.mock.calls[0][0]).toBe('user-1');

    lastListener()({ orderId: 'o1', status: 'DELIVERED' });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['orders'], refetchType: 'all' });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['order', 'user-1', 'buyer', 'o1'] });
  });

  it('detail изменившегося заказа инвалидируется, даже когда деталь не открыта (не только «свой» orderId)', () => {
    renderHook(() => useOrdersRealtime({ scope: 'buyer' }), { wrapper });

    lastListener()({ orderId: 'o2', status: 'IN_TRANSIT' });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['order', 'user-1', 'buyer', 'o2'] });
    expect(invalidate).not.toHaveBeenCalledWith({ queryKey: ['order', 'user-1', 'buyer', 'o1'] });
  });

  it('onChange патчит кэш детали новым статусом — открытая карточка обновляется мгновенно', () => {
    client.setQueryData(['order', 'user-1', 'buyer', 'o1'], { id: 'o1', status: 'NEW' });
    renderHook(() => useOrdersRealtime({ scope: 'buyer' }), { wrapper });

    lastListener()({ orderId: 'o1', status: 'IN_TRANSIT' });

    expect(client.getQueryData(['order', 'user-1', 'buyer', 'o1'])).toMatchObject({
      id: 'o1',
      status: 'IN_TRANSIT',
    });
  });

  it('onChange без загруженного кэша детали не создаёт фиктивной записи', () => {
    renderHook(() => useOrdersRealtime({ scope: 'buyer' }), { wrapper });

    lastListener()({ orderId: 'o-missing', status: 'IN_TRANSIT' });

    expect(client.getQueryData(['order', 'user-1', 'buyer', 'o-missing'])).toBeUndefined();
  });

  it('onResync инвалидирует список и ВСЕ детали (сверка после реконнекта)', () => {
    renderHook(() => useOrdersRealtime({ scope: 'buyer' }), { wrapper });

    handlersFrom(h.buyerSub).onResync?.();

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['orders'], refetchType: 'all' });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['order'], refetchType: 'all' });
  });

  it('seller: onResync так же пробрасывается в подписку магазина', () => {
    renderHook(() => useOrdersRealtime({ scope: 'seller' }), { wrapper });

    handlersFrom(h.storeSub).onResync?.();

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['orders'], refetchType: 'all' });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['order'], refetchType: 'all' });
  });

  it('seller: подписка на магазин + инвалидация списка и детали в seller-скоупе', () => {
    renderHook(() => useOrdersRealtime({ scope: 'seller' }), { wrapper });

    expect(h.storeSub).toHaveBeenCalledTimes(1);
    expect(h.storeSub.mock.calls[0][0]).toBe('store-1');
    expect(h.buyerSub).not.toHaveBeenCalled();

    handlersFrom(h.storeSub).onChange({ orderId: 'o9', status: 'NEW' });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['orders'], refetchType: 'all' });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['order', 'user-1', 'seller', 'o9'] });
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
