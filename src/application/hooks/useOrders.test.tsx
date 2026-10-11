// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { OrderListItem, OrderStatusFilter } from '../read-models/order';

const h = vi.hoisted(() => ({
  listOrders: vi.fn(),
  state: {
    sessionToken: 'tok' as string | null,
    storeId: 'store-a' as string | null,
    serverUser: { id: 'user-1' } as { id: string } | null,
  },
}));

vi.mock('../composition/container', () => ({
  deps: () => ({ orderRepository: { listOrders: h.listOrders } }),
}));

vi.mock('../store', () => ({
  useStore: Object.assign((selector: (s: typeof h.state) => unknown) => selector(h.state), {
    getState: () => h.state,
  }),
}));

import { invalidateOrderLists } from '../orders/order-cache';
import { useOrders } from './useOrders';

function item(id: string): OrderListItem {
  return {
    id,
    publicOrderNumber: `SH-${id}`,
    status: 'NEW',
    createdAt: '2026-10-10T10:00:00Z',
    totalMinor: 1000,
    currencyCode: 'USD',
    currencySymbol: '$',
    itemCount: 1,
    previewItems: [],
  };
}

const page = (ids: string[], nextCursor: string | null = null) => ({
  orders: ids.map(item),
  nextCursor,
});

let client: QueryClient;

beforeEach(() => {
  h.listOrders.mockReset();
  h.state.sessionToken = 'tok';
  h.state.storeId = 'store-a';
  h.state.serverUser = { id: 'user-1' };
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

describe('invalidateOrderLists (docs/22 ORD-14)', () => {
  it('перечитывает ВСЕ таб-фильтры (refetchType: all), чтобы убрать «клон» заказа', async () => {
    const spy = vi.spyOn(client, 'invalidateQueries');

    await invalidateOrderLists(client);

    expect(spy).toHaveBeenCalledWith({ queryKey: ['orders'], refetchType: 'all' });
  });
});

describe('useOrders.refreshAll (docs/22 ORD-14)', () => {
  it('перечитывает ВСЕ списки (все табы) и ВСЕ детали одним вызовом', async () => {
    h.listOrders.mockResolvedValue(page(['1']));
    const { result } = renderHook(() => useOrders({ scope: 'buyer' }), { wrapper });
    await waitFor(() => expect(result.current.orders).toHaveLength(1));

    const spy = vi.spyOn(client, 'invalidateQueries');
    act(() => result.current.refreshAll());

    expect(spy).toHaveBeenCalledWith({ queryKey: ['orders'], refetchType: 'all' });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['order'], refetchType: 'all' });
  });
});

describe('useOrders (infinite list, docs/22 ORD-04)', () => {
  it('без сессии или storeRef не ходит в сеть', () => {
    h.state.sessionToken = null;
    const { result } = renderHook(() => useOrders({ scope: 'buyer' }), { wrapper });
    expect(result.current.orders).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(h.listOrders).not.toHaveBeenCalled();
  });

  it('disabledReason различает no-store / no-session / disabled / активный (docs/24 D5)', () => {
    h.state.storeId = null;
    const noStore = renderHook(() => useOrders({ scope: 'buyer' }), { wrapper });
    expect(noStore.result.current.disabledReason).toBe('no-store');
    noStore.unmount();

    h.state.storeId = 'store-a';
    h.state.sessionToken = null;
    const noSession = renderHook(() => useOrders({ scope: 'buyer' }), { wrapper });
    expect(noSession.result.current.disabledReason).toBe('no-session');
    noSession.unmount();

    h.state.sessionToken = 'tok';
    const forced = renderHook(() => useOrders({ scope: 'buyer', enabled: false }), { wrapper });
    expect(forced.result.current.disabledReason).toBe('disabled');
    forced.unmount();

    const ok = renderHook(() => useOrders({ scope: 'buyer' }), { wrapper });
    expect(ok.result.current.disabledReason).toBeNull();
  });

  it('грузит первую страницу заказов', async () => {
    h.listOrders.mockResolvedValue(page(['1', '2']));
    const { result } = renderHook(() => useOrders({ scope: 'buyer' }), { wrapper });

    await waitFor(() => expect(result.current.orders).toHaveLength(2));
    expect(result.current.orders[0].publicOrderNumber).toBe('SH-1');
    expect(result.current.error).toBeNull();
    expect(h.listOrders).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionToken: 'tok',
        scope: 'buyer',
        storeRef: 'store-a',
        statusFilter: 'all',
        cursor: null,
        limit: 20,
      }),
    );
  });

  it('keyset-пагинация: fetchNextPage уходит с nextCursor и дописывает страницу', async () => {
    h.listOrders
      .mockResolvedValueOnce(page(['1', '2'], 'cursor-1'))
      .mockResolvedValueOnce(page(['3']));

    const { result } = renderHook(() => useOrders({ scope: 'seller', pageSize: 2 }), { wrapper });

    await waitFor(() => expect(result.current.orders).toHaveLength(2));
    expect(result.current.hasNextPage).toBe(true);

    act(() => result.current.fetchNextPage());

    await waitFor(() => expect(result.current.orders).toHaveLength(3));
    expect(h.listOrders).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: 'cursor-1', limit: 2, scope: 'seller' }),
    );
    expect(result.current.orders[2].id).toBe('3');
  });

  it('дедуп: пересечение страниц не дублирует один заказ', async () => {
    h.listOrders
      .mockResolvedValueOnce(page(['1', '2'], 'cursor-1'))
      .mockResolvedValueOnce(page(['2', '3']));

    const { result } = renderHook(() => useOrders({ scope: 'seller', pageSize: 2 }), { wrapper });

    await waitFor(() => expect(result.current.orders).toHaveLength(2));
    act(() => result.current.fetchNextPage());

    await waitFor(() => expect(result.current.orders.map((o) => o.id)).toEqual(['1', '2', '3']));
  });

  it('смена фильтра таба уходит в запрос (ключ включает filter)', async () => {
    h.listOrders.mockResolvedValue(page(['1']));
    const { rerender } = renderHook(
      ({ filter }: { filter: OrderStatusFilter }) =>
        useOrders({ scope: 'buyer', statusFilter: filter }),
      { wrapper, initialProps: { filter: 'all' as OrderStatusFilter } },
    );

    await waitFor(() => expect(h.listOrders).toHaveBeenCalled());
    expect(h.listOrders).toHaveBeenLastCalledWith(expect.objectContaining({ statusFilter: 'all' }));

    rerender({ filter: 'history' });
    await waitFor(() =>
      expect(h.listOrders).toHaveBeenLastCalledWith(
        expect.objectContaining({ statusFilter: 'history' }),
      ),
    );
  });

  it('снятие keepPreviousData: при смене таба прошлая выборка не выдаётся за новую (skeleton)', async () => {
    h.listOrders.mockResolvedValue(page(['1']));
    const { result, rerender } = renderHook(
      ({ filter }: { filter: OrderStatusFilter }) =>
        useOrders({ scope: 'buyer', statusFilter: filter }),
      { wrapper, initialProps: { filter: 'all' as OrderStatusFilter } },
    );

    await waitFor(() => expect(result.current.orders.map((o) => o.id)).toEqual(['1']));

    let resolveNext: (value: ReturnType<typeof page>) => void = () => {};
    h.listOrders.mockReturnValueOnce(
      new Promise<ReturnType<typeof page>>((resolve) => {
        resolveNext = resolve;
      }),
    );
    rerender({ filter: 'history' });

    // Новый таб ещё грузится: показываем пустой список, а не прошлую выборку.
    await waitFor(() => expect(result.current.loading).toBe(true));
    expect(result.current.orders).toEqual([]);

    resolveNext(page(['9']));
    await waitFor(() => expect(result.current.orders.map((o) => o.id)).toEqual(['9']));
  });

  it('ошибка загрузки → error', async () => {
    h.listOrders.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useOrders({ scope: 'buyer' }), { wrapper });

    await waitFor(() => expect(result.current.error).toBe('boom'));
    expect(result.current.orders).toEqual([]);
  });

  it('явный storeRef переопределяет storeId из стора', async () => {
    h.listOrders.mockResolvedValue(page([]));
    renderHook(() => useOrders({ scope: 'buyer', storeRef: 'public-xyz' }), { wrapper });

    await waitFor(() =>
      expect(h.listOrders).toHaveBeenCalledWith(expect.objectContaining({ storeRef: 'public-xyz' })),
    );
  });

  it('ключ включает identity: смена пользователя не отдаёт чужой кэш (docs/24 §3.4)', async () => {
    h.listOrders.mockResolvedValue(page(['1']));
    const { result, rerender } = renderHook(() => useOrders({ scope: 'buyer' }), { wrapper });

    await waitFor(() => expect(result.current.orders).toHaveLength(1));
    expect(h.listOrders).toHaveBeenCalledTimes(1);

    // Другой пользователь → другой ключ → свежее чтение, без прошлого кэша.
    h.state.serverUser = { id: 'user-2' };
    rerender();

    await waitFor(() => expect(h.listOrders).toHaveBeenCalledTimes(2));
  });
});
