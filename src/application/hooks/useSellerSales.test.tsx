// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { OrderListItem, SalesGroup } from '../read-models/order';

const h = vi.hoisted(() => ({
  listSales: vi.fn(),
  state: {
    sessionToken: 'tok' as string | null,
    storeId: 'store-a' as string | null,
    serverUser: { id: 'user-1' } as { id: string } | null,
  },
}));

vi.mock('../composition/container', () => ({
  deps: () => ({ orderRepository: { listSales: h.listSales } }),
}));

vi.mock('../store', () => ({
  useStore: Object.assign((selector: (s: typeof h.state) => unknown) => selector(h.state), {
    getState: () => h.state,
  }),
}));

import { useSellerSales } from './useSellerSales';

function item(id: string): OrderListItem {
  return {
    id,
    publicOrderNumber: `SH-${id}`,
    status: 'DELIVERED',
    createdAt: '2026-10-10T10:00:00Z',
    totalMinor: 1000,
    currencyCode: 'USD',
    currencySymbol: '$',
    itemCount: 1,
    previewItems: [],
  };
}

const page = (ids: string[], nextCursor: string | null = null, totalMinor = 0) => ({
  orders: ids.map(item),
  nextCursor,
  totalMinor,
});

let client: QueryClient;

beforeEach(() => {
  h.listSales.mockReset();
  h.state.sessionToken = 'tok';
  h.state.storeId = 'store-a';
  h.state.serverUser = { id: 'user-1' };
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

describe('useSellerSales (docs/25 §3.4)', () => {
  it('без сессии/storeRef не ходит в сеть и отдаёт причину', () => {
    h.state.sessionToken = null;
    const { result } = renderHook(() => useSellerSales({ group: 'earned' }), { wrapper });
    expect(result.current.disabledReason).toBe('no-session');
    expect(result.current.orders).toEqual([]);
    expect(h.listSales).not.toHaveBeenCalled();

    h.state.sessionToken = 'tok';
    h.state.storeId = null;
    const noStore = renderHook(() => useSellerSales({ group: 'earned' }), { wrapper });
    expect(noStore.result.current.disabledReason).toBe('no-store');
  });

  it('грузит первую страницу и сумму группы', async () => {
    h.listSales.mockResolvedValue(page(['1', '2'], null, 5500));
    const { result } = renderHook(() => useSellerSales({ group: 'earned' }), { wrapper });

    await waitFor(() => expect(result.current.orders).toHaveLength(2));
    expect(result.current.totalMinor).toBe(5500);
    expect(result.current.error).toBeNull();
    expect(h.listSales).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionToken: 'tok',
        storeRef: 'store-a',
        group: 'earned',
        cursor: null,
        limit: 20,
      }),
    );
  });

  it('keyset-пагинация: fetchNextPage уходит с nextCursor', async () => {
    h.listSales
      .mockResolvedValueOnce(page(['1'], 'cursor-1', 3000))
      .mockResolvedValueOnce(page(['2'], null, 3000));

    const { result } = renderHook(() => useSellerSales({ group: 'potential', pageSize: 1 }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.orders).toHaveLength(1));
    expect(result.current.hasNextPage).toBe(true);

    act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.orders.map((o) => o.id)).toEqual(['1', '2']));
    expect(h.listSales).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: 'cursor-1', limit: 1, group: 'potential' }),
    );
  });

  it('дедуп: пересечение страниц не дублирует заказ', async () => {
    h.listSales
      .mockResolvedValueOnce(page(['1', '2'], 'cursor-1', 0))
      .mockResolvedValueOnce(page(['2', '3'], null, 0));

    const { result } = renderHook(() => useSellerSales({ group: 'earned', pageSize: 2 }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.orders).toHaveLength(2));
    act(() => result.current.fetchNextPage());

    await waitFor(() => expect(result.current.orders.map((o) => o.id)).toEqual(['1', '2', '3']));
  });

  it('смена группы уходит в запрос (ключ включает group)', async () => {
    h.listSales.mockResolvedValue(page(['1'], null, 0));
    const { rerender } = renderHook(
      ({ group }: { group: SalesGroup }) => useSellerSales({ group }),
      { wrapper, initialProps: { group: 'earned' as SalesGroup } },
    );

    await waitFor(() => expect(h.listSales).toHaveBeenCalled());
    expect(h.listSales).toHaveBeenLastCalledWith(expect.objectContaining({ group: 'earned' }));

    rerender({ group: 'potential' });
    await waitFor(() =>
      expect(h.listSales).toHaveBeenLastCalledWith(expect.objectContaining({ group: 'potential' })),
    );
  });

  it('ошибка загрузки → error', async () => {
    h.listSales.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useSellerSales({ group: 'earned' }), { wrapper });

    await waitFor(() => expect(result.current.error).toBe('boom'));
    expect(result.current.orders).toEqual([]);
  });

  it('явный storeRef переопределяет storeId из стора', async () => {
    h.listSales.mockResolvedValue(page([], null, 0));
    renderHook(() => useSellerSales({ group: 'earned', storeRef: 'public-xyz' }), { wrapper });

    await waitFor(() =>
      expect(h.listSales).toHaveBeenCalledWith(
        expect.objectContaining({ storeRef: 'public-xyz' }),
      ),
    );
  });

  it('ключ включает identity: смена пользователя → новое чтение (docs/24 §3.4)', async () => {
    h.listSales.mockResolvedValue(page(['1'], null, 0));
    const { result, rerender } = renderHook(() => useSellerSales({ group: 'earned' }), { wrapper });

    await waitFor(() => expect(result.current.orders).toHaveLength(1));
    expect(h.listSales).toHaveBeenCalledTimes(1);

    h.state.serverUser = { id: 'user-2' };
    rerender();

    await waitFor(() => expect(h.listSales).toHaveBeenCalledTimes(2));
  });
});
