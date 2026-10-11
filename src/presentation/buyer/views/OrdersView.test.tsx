// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import type { OrderListItem } from '../../../application/read-models/order';
import type { OrdersListState } from '../../../application/hooks/useOrders';

const h = vi.hoisted(() => ({
  useOrders: vi.fn(),
  state: { serverUser: null as null | { photoUrl: string; firstName: string } },
}));

vi.mock('../../../application/hooks/useOrders', () => ({ useOrders: h.useOrders }));
vi.mock('../../../application/hooks/useOrdersRealtime', () => ({ useOrdersRealtime: () => {} }));
vi.mock('../../../application/hooks/useHaptic', () => ({
  useHaptic: () => ({ selectTick: vi.fn() }),
}));
vi.mock('../../../application/store', () => ({
  useStore: (selector: (s: typeof h.state) => unknown) => selector(h.state),
}));

import OrdersView from './OrdersView';

function order(id: string): OrderListItem {
  return {
    id,
    publicOrderNumber: `SH-${id}`,
    status: 'NEW',
    createdAt: '2026-10-10T10:00:00Z',
    totalMinor: 220000,
    currencyCode: 'BYN',
    currencySymbol: 'Br',
    itemCount: 1,
    previewItems: [{ imageUrl: null, title: 'Толстовка', variantLabel: null, quantity: 1 }],
  };
}

function listState(overrides: Partial<OrdersListState> = {}): OrdersListState {
  return {
    orders: [],
    loading: false,
    fetching: false,
    error: null,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
    ...overrides,
  };
}

function renderView(entry = '/orders') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/orders" element={<OrdersView />} />
        <Route path="/orders/:orderId" element={<div data-testid="detail-route" />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  h.useOrders.mockReset();
  h.state.serverUser = null;
});

describe('OrdersView (ORD-06)', () => {
  it('шапка «Заказы» с профилем и пять табов', () => {
    h.useOrders.mockReturnValue(listState());
    renderView();
    expect(screen.getByRole('heading', { name: 'Заказы' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Профиль' })).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(5);
  });

  it('loading → скелетон списка', () => {
    h.useOrders.mockReturnValue(listState({ loading: true }));
    renderView();
    expect(screen.getByTestId('order-skeleton')).toBeInTheDocument();
  });

  it('пусто → текст пустого состояния', () => {
    h.useOrders.mockReturnValue(listState());
    renderView();
    expect(screen.getByTestId('order-empty')).toHaveTextContent('Заказов пока нет');
  });

  it('карточки заказов с суммой', () => {
    h.useOrders.mockReturnValue(listState({ orders: [order('1'), order('2')] }));
    renderView();
    expect(screen.getAllByTestId('order-card')).toHaveLength(2);
    expect(screen.getAllByText('2200 Br')).toHaveLength(2);
  });

  it('ошибка → экран ошибки, «Повторить» вызывает refetch', async () => {
    const refetch = vi.fn();
    h.useOrders.mockReturnValue(listState({ error: 'boom', refetch }));
    renderView();
    expect(screen.getByTestId('orders-error')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('смена таба передаёт доменный фильтр в useOrders', async () => {
    h.useOrders.mockReturnValue(listState());
    renderView();
    await userEvent.click(screen.getByRole('tab', { name: 'В пути' }));
    expect(h.useOrders).toHaveBeenLastCalledWith({ scope: 'buyer', statusFilter: 'IN_TRANSIT' });
  });

  it('пустой текст зависит от активного таба', async () => {
    h.useOrders.mockReturnValue(listState());
    renderView();
    await userEvent.click(screen.getByRole('tab', { name: 'История' }));
    expect(screen.getByTestId('order-empty')).toHaveTextContent('История заказов пуста');
  });

  it('deep-link ?status=history активирует историю (URL — источник истины)', () => {
    h.useOrders.mockReturnValue(listState());
    renderView('/orders?status=history');
    expect(h.useOrders).toHaveBeenCalledWith({ scope: 'buyer', statusFilter: 'history' });
    expect(screen.getByRole('tab', { name: 'История' })).toHaveAttribute('aria-selected', 'true');
  });

  it('«Подробнее» ведёт в деталь заказа', async () => {
    h.useOrders.mockReturnValue(listState({ orders: [order('1')] }));
    renderView();
    await userEvent.click(screen.getByRole('button', { name: 'Подробнее о заказе SH-1' }));
    expect(screen.getByTestId('detail-route')).toBeInTheDocument();
  });
});
