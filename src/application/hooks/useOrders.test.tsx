// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { OrderListItem, OrderStatusFilter } from '../read-models/order';

const h = vi.hoisted(() => ({
  listOrders: vi.fn(),
  state: { sessionToken: 'tok' as string | null, storeId: 'store-a' as string | null },
}));

vi.mock('../composition/container', () => ({
  deps: () => ({ orderRepository: { listOrders: h.listOrders } }),
}));

vi.mock('../store', () => ({
  useStore: Object.assign((selector: (s: typeof h.state) => unknown) => selector(h.state), {
    getState: () => h.state,
  }),
}));

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
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

describe('useOrders (infinite list, docs/22 ORD-04)', () => {
  it('без сессии или storeRef не ходит в сеть', () => {
    h.state.sessionToken = null;
    const { result } = renderHook(() => useOrders({ scope: 'buyer' }), { wrapper });
    expect(result.current.orders).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(h.listOrders).not.toHaveBeenCalled();
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
});
