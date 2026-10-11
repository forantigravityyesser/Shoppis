// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const h = vi.hoisted(() => ({
  cancelOrder: vi.fn(),
  transitionOrder: vi.fn(),
  recordDeliveryOutcome: vi.fn(),
  fetchCatalog: vi.fn(),
  state: {
    sessionToken: 'tok' as string | null,
    context: 'seller' as 'seller' | 'buyer',
    storeId: 'store-a' as string | null,
    fetchCatalog: (() => Promise.resolve()) as (storeId: string) => Promise<void>,
  },
}));

vi.mock('../composition/container', () => ({
  deps: () => ({
    orderApi: {
      cancelOrder: h.cancelOrder,
      transitionOrder: h.transitionOrder,
      recordDeliveryOutcome: h.recordDeliveryOutcome,
    },
  }),
}));

vi.mock('../store', () => ({
  useStore: Object.assign((selector: (s: typeof h.state) => unknown) => selector(h.state), {
    getState: () => h.state,
  }),
}));

import { useOrderActions } from './useOrderActions';

let client: QueryClient;
let invalidateSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  h.cancelOrder.mockReset();
  h.transitionOrder.mockReset();
  h.recordDeliveryOutcome.mockReset();
  h.fetchCatalog.mockReset();
  h.state.sessionToken = 'tok';
  h.state.context = 'seller';
  h.state.storeId = 'store-a';
  h.state.fetchCatalog = h.fetchCatalog;
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  invalidateSpy = vi.spyOn(client, 'invalidateQueries');
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

describe('useOrderActions (docs/22 ORD-04)', () => {
  it('cancelOrder: идёт через order-actions, инвалидирует orders + order и обновляет инвентарь (seller)', async () => {
    h.cancelOrder.mockResolvedValue({ success: true });
    const { result } = renderHook(() => useOrderActions(), { wrapper });

    await act(async () => {
      await result.current.cancelOrder({ orderId: 'o1', actor: 'seller' });
    });

    expect(h.cancelOrder).toHaveBeenCalledWith('tok', 'o1', 'seller', undefined);
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['orders'] }));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['order'] });
    expect(h.fetchCatalog).toHaveBeenCalledWith('store-a');
  });

  it('buyer-контекст: инвентарь продавца не перечитывается', async () => {
    h.state.context = 'buyer';
    h.cancelOrder.mockResolvedValue({ success: true });
    const { result } = renderHook(() => useOrderActions(), { wrapper });

    await act(async () => {
      await result.current.cancelOrder({ orderId: 'o1', actor: 'buyer' });
    });

    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['orders'] }));
    expect(h.fetchCatalog).not.toHaveBeenCalled();
  });

  it('transitionOrder переиспользует command-path и после успеха инвалидирует список', async () => {
    h.transitionOrder.mockResolvedValue({ success: true });
    const { result } = renderHook(() => useOrderActions(), { wrapper });

    await act(async () => {
      await result.current.transitionOrder({ orderId: 'o1', toStatus: 'IN_TRANSIT' });
    });

    expect(h.transitionOrder).toHaveBeenCalledWith('tok', 'o1', 'IN_TRANSIT', undefined);
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['orders'] }));
  });

  it('recordDeliveryOutcome: outcome + reason (код) уходят на сервер', async () => {
    h.recordDeliveryOutcome.mockResolvedValue({ success: true });
    const { result } = renderHook(() => useOrderActions(), { wrapper });

    await act(async () => {
      await result.current.recordDeliveryOutcome({
        orderId: 'o1',
        outcome: 'REFUSED',
        reason: 'OTHER',
      });
    });

    expect(h.recordDeliveryOutcome).toHaveBeenCalledWith('tok', 'o1', 'REFUSED', 'OTHER');
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['order'] }));
  });

  it('ошибка мутации пробрасывается и попадает в error', async () => {
    h.transitionOrder.mockRejectedValue(new Error('TRANSITION_NOT_ALLOWED'));
    const { result } = renderHook(() => useOrderActions(), { wrapper });

    await act(async () => {
      await expect(
        result.current.transitionOrder({ orderId: 'o1', toStatus: 'IN_TRANSIT' }),
      ).rejects.toThrow('TRANSITION_NOT_ALLOWED');
    });

    await waitFor(() => expect(result.current.error?.message).toBe('TRANSITION_NOT_ALLOWED'));
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
