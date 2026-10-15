// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { OrderRealtimeHandlers } from '../ports/order-realtime';
import type { SellerDashboardSummary } from '../read-models/seller-dashboard';

const h = vi.hoisted(() => ({
  getSummary: vi.fn(),
  subscribeStoreOrders: vi.fn(),
  state: {
    sessionToken: 'tok' as string | null,
    storeId: 'store-a' as string | null,
    serverUser: { id: 'user-1' } as { id: string } | null,
  },
}));

vi.mock('../composition/container', () => ({
  deps: () => ({
    sellerDashboardRepository: { getSummary: h.getSummary },
    orderRealtime: { subscribeStoreOrders: h.subscribeStoreOrders },
  }),
}));

vi.mock('../store', () => ({
  useStore: Object.assign((selector: (s: typeof h.state) => unknown) => selector(h.state), {
    getState: () => h.state,
  }),
}));

import { useSellerDashboard } from './useSellerDashboard';

function summary(): SellerDashboardSummary {
  return {
    orders: { new: 1, inTransit: 2, delivered: 3, history: 4 },
    sales: { receivedMinor: 1000, frozenMinor: 500 },
    inventory: {
      activeProducts: 6,
      archivedProducts: 1,
      activeCategories: 2,
      buyerAvailableProducts: 4,
    },
    growth: { firstOrderAt: null, firstShippedAt: null, firstCompletedAt: null },
  };
}

let client: QueryClient;

beforeEach(() => {
  h.getSummary.mockReset();
  h.getSummary.mockResolvedValue(summary());
  h.subscribeStoreOrders.mockReset();
  h.subscribeStoreOrders.mockReturnValue(() => {});
  h.state.sessionToken = 'tok';
  h.state.storeId = 'store-a';
  h.state.serverUser = { id: 'user-1' };
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

describe('useSellerDashboard (docs/25 §3.4)', () => {
  it('без сессии/сторId не ходит в сеть и отдаёт причину', () => {
    h.state.storeId = null;
    const noStore = renderHook(() => useSellerDashboard(), { wrapper });
    expect(noStore.result.current.disabledReason).toBe('no-store');
    expect(h.getSummary).not.toHaveBeenCalled();
    noStore.unmount();

    h.state.storeId = 'store-a';
    h.state.sessionToken = null;
    const noSession = renderHook(() => useSellerDashboard(), { wrapper });
    expect(noSession.result.current.disabledReason).toBe('no-session');
    noSession.unmount();

    h.state.sessionToken = 'tok';
    const forced = renderHook(() => useSellerDashboard({ enabled: false }), { wrapper });
    expect(forced.result.current.disabledReason).toBe('disabled');
    forced.unmount();

    const ok = renderHook(() => useSellerDashboard(), { wrapper });
    expect(ok.result.current.disabledReason).toBeNull();
  });

  it('грузит сводку с текущим storeRef', async () => {
    h.getSummary.mockResolvedValue(summary());
    const { result } = renderHook(() => useSellerDashboard(), { wrapper });

    await waitFor(() => expect(result.current.summary).not.toBeNull());
    expect(result.current.summary?.orders.new).toBe(1);
    expect(result.current.error).toBeNull();
    expect(h.getSummary).toHaveBeenCalledWith({ sessionToken: 'tok', storeRef: 'store-a' });
  });

  it('null-сводка (чужой магазин) сохраняется как null, не ошибка', async () => {
    h.getSummary.mockResolvedValue(null);
    const { result } = renderHook(() => useSellerDashboard(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.summary).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('ошибка загрузки → error', async () => {
    h.getSummary.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useSellerDashboard(), { wrapper });

    await waitFor(() => expect(result.current.error).toBe('boom'));
    expect(result.current.summary).toBeNull();
  });

  it('явный storeRef переопределяет storeId из стора', async () => {
    h.getSummary.mockResolvedValue(summary());
    renderHook(() => useSellerDashboard({ storeRef: 'public-xyz' }), { wrapper });

    await waitFor(() =>
      expect(h.getSummary).toHaveBeenCalledWith(
        expect.objectContaining({ storeRef: 'public-xyz' }),
      ),
    );
  });

  it('realtime: изменение заказа магазина инвалидирует сводку', async () => {
    h.getSummary.mockResolvedValue(summary());
    const { result } = renderHook(() => useSellerDashboard(), { wrapper });
    await waitFor(() => expect(result.current.summary).not.toBeNull());

    expect(h.subscribeStoreOrders).toHaveBeenCalledWith('store-a', expect.any(Object));
    const handlers = h.subscribeStoreOrders.mock.calls[0][1] as OrderRealtimeHandlers;
    const spy = vi.spyOn(client, 'invalidateQueries');

    act(() => handlers.onChange({ orderId: 'o1', status: 'DELIVERED' }));

    expect(spy).toHaveBeenCalledWith({ queryKey: ['seller-dashboard'], refetchType: 'all' });
  });

  it('ключ включает identity: смена пользователя → новое чтение (docs/24 §3.4)', async () => {
    h.getSummary.mockResolvedValue(summary());
    const { result, rerender } = renderHook(() => useSellerDashboard(), { wrapper });
    await waitFor(() => expect(result.current.summary).not.toBeNull());
    expect(h.getSummary).toHaveBeenCalledTimes(1);

    h.state.serverUser = { id: 'user-2' };
    rerender();

    await waitFor(() => expect(h.getSummary).toHaveBeenCalledTimes(2));
  });
});
