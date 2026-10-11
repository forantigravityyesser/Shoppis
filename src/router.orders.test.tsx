// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { OrderDetails } from './application/read-models/order';

const h = vi.hoisted(() => ({
  useOrders: vi.fn(),
  useOrderDetails: vi.fn(),
  useOrderActions: vi.fn(),
}));

vi.mock('./application/store', () => ({
  useStore: (selector: (s: { context: string; storeId: string | null }) => unknown) =>
    selector({ context: 'seller', storeId: 's1' }),
}));
vi.mock('./application/hooks/useHaptic', () => ({
  useHaptic: () => ({ selectTick: vi.fn(), impactLight: vi.fn() }),
}));
vi.mock('./application/hooks/useOpenTelegramLink', () => ({
  useOpenTelegramLink: () => vi.fn(),
}));
vi.mock('./application/hooks/useOrders', () => ({ useOrders: h.useOrders }));
vi.mock('./application/hooks/useOrderDetails', () => ({ useOrderDetails: h.useOrderDetails }));
vi.mock('./application/hooks/useOrderActions', () => ({ useOrderActions: h.useOrderActions }));
vi.mock('./application/hooks/useOrdersRealtime', () => ({ useOrdersRealtime: () => {} }));

import AppRouter from './router';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRouter />
    </MemoryRouter>,
  );
}

const ORDER: OrderDetails = {
  id: 'o1',
  publicOrderNumber: 'SH-1',
  status: 'NEW',
  deliveryOutcome: null,
  refusalReasonCode: null,
  currencyCode: 'BYN',
  currencySymbol: 'Br',
  subtotalMinor: 1000,
  totalMinor: 1000,
  createdAt: '2026-10-10T10:00:00Z',
  updatedAt: '2026-10-10T10:00:00Z',
  cancelledAt: null,
  completedAt: null,
  refusedAt: null,
  delivery: { fullName: 'Данила', phone: '+375257914112', address: 'Минск' },
  contact: { supportHandle: null, telegramUsername: null },
  items: [],
};

beforeEach(() => {
  h.useOrders.mockReset();
  h.useOrderDetails.mockReset();
  h.useOrderActions.mockReset();
  h.useOrders.mockReturnValue({
    orders: [],
    loading: false,
    fetching: false,
    error: null,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
  });
  h.useOrderDetails.mockReturnValue({
    order: null,
    loading: false,
    error: null,
    notFound: false,
    refetch: vi.fn(),
  });
  h.useOrderActions.mockReturnValue({
    cancelOrder: vi.fn(),
    transitionOrder: vi.fn(),
    recordDeliveryOutcome: vi.fn(),
    isPending: false,
    error: null,
  });
});

describe('seller orders routing (ORD-11)', () => {
  it('/seller/orders/history → редирект на /seller/orders?status=history', async () => {
    renderAt('/seller/orders/history');
    expect(await screen.findByRole('heading', { name: 'Заказы' })).toBeInTheDocument();
    expect(h.useOrders).toHaveBeenCalledWith({ scope: 'seller', statusFilter: 'history' });
    expect(screen.getByRole('tab', { name: 'История' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('История заказов пуста')).toBeInTheDocument();
  });

  it('/seller/orders/:orderId → деталь (не редирект на дашборд)', async () => {
    h.useOrderDetails.mockReturnValue({
      order: ORDER,
      loading: false,
      error: null,
      notFound: false,
      refetch: vi.fn(),
    });
    renderAt('/seller/orders/o1');
    expect(await screen.findByRole('heading', { name: 'Заказ № SH-1' })).toBeInTheDocument();
    expect(h.useOrderDetails).toHaveBeenCalledWith({ scope: 'seller', orderId: 'o1' });
  });
});
