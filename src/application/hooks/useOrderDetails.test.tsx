// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { OrderDetails } from '../read-models/order';

const h = vi.hoisted(() => ({
  getOrderDetails: vi.fn(),
  state: { sessionToken: 'tok' as string | null },
}));

vi.mock('../composition/container', () => ({
  deps: () => ({ orderRepository: { getOrderDetails: h.getOrderDetails } }),
}));

vi.mock('../store', () => ({
  useStore: Object.assign((selector: (s: typeof h.state) => unknown) => selector(h.state), {
    getState: () => h.state,
  }),
}));

import { useOrderDetails } from './useOrderDetails';

const DETAIL: OrderDetails = {
  id: 'o1',
  publicOrderNumber: 'SH-1',
  status: 'NEW',
  deliveryOutcome: null,
  refusalReasonCode: null,
  currencyCode: 'USD',
  currencySymbol: '$',
  subtotalMinor: 1000,
  totalMinor: 1000,
  createdAt: '2026-10-10T10:00:00Z',
  updatedAt: '2026-10-10T10:00:00Z',
  cancelledAt: null,
  completedAt: null,
  refusedAt: null,
  delivery: { fullName: 'Иван', phone: '+7900', address: 'Москва' },
  contact: { supportHandle: null, telegramUsername: null },
  items: [],
};

let client: QueryClient;

beforeEach(() => {
  h.getOrderDetails.mockReset();
  h.state.sessionToken = 'tok';
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

describe('useOrderDetails (docs/22 ORD-04)', () => {
  it('без orderId или сессии не ходит в сеть', () => {
    const { result } = renderHook(() => useOrderDetails({ scope: 'buyer', orderId: null }), {
      wrapper,
    });
    expect(result.current.order).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(h.getOrderDetails).not.toHaveBeenCalled();
  });

  it('загружает деталь заказа', async () => {
    h.getOrderDetails.mockResolvedValue(DETAIL);
    const { result } = renderHook(() => useOrderDetails({ scope: 'buyer', orderId: 'o1' }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.order).not.toBeNull());
    expect(result.current.order?.publicOrderNumber).toBe('SH-1');
    expect(h.getOrderDetails).toHaveBeenCalledWith({
      sessionToken: 'tok',
      scope: 'buyer',
      orderId: 'o1',
    });
  });

  it('null → notFound (единый safe not-found), не ошибка', async () => {
    h.getOrderDetails.mockResolvedValue(null);
    const { result } = renderHook(() => useOrderDetails({ scope: 'seller', orderId: 'oX' }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.notFound).toBe(true));
    expect(result.current.order).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('ошибка сети → error, notFound=false', async () => {
    h.getOrderDetails.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useOrderDetails({ scope: 'buyer', orderId: 'o1' }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.error).toBe('boom'));
    expect(result.current.notFound).toBe(false);
  });
});
