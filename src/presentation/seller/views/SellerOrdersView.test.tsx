// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import type { OrderListItem } from '../../../application/read-models/order';
import type { OrdersListState } from '../../../application/hooks/useOrders';

const h = vi.hoisted(() => ({ useOrders: vi.fn() }));

vi.mock('../../../application/hooks/useOrders', () => ({ useOrders: h.useOrders }));
vi.mock('../../../application/hooks/useOrdersRealtime', () => ({ useOrdersRealtime: () => {} }));
vi.mock('../../../application/hooks/useHaptic', () => ({
  useHaptic: () => ({ selectTick: vi.fn() }),
}));

import SellerOrdersView from './SellerOrdersView';

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

function renderView(entry = '/seller/orders') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/seller/orders" element={<SellerOrdersView />} />
        <Route path="/seller/orders/:orderId" element={<div data-testid="detail-route" />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  h.useOrders.mockReset();
});

describe('SellerOrdersView (ORD-07)', () => {
  it('шапка «Заказы» и пять табов; scope=seller', () => {
    h.useOrders.mockReturnValue(listState());
    renderView();
    expect(screen.getByRole('heading', { name: 'Заказы' })).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(5);
    expect(h.useOrders).toHaveBeenCalledWith({ scope: 'seller', statusFilter: 'all' });
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

  it('карточки заказов магазина', () => {
    h.useOrders.mockReturnValue(listState({ orders: [order('1'), order('2')] }));
    renderView();
    expect(screen.getAllByTestId('order-card')).toHaveLength(2);
  });

  it('ошибка → экран ошибки, «Повторить» вызывает refetch', async () => {
    const refetch = vi.fn();
    h.useOrders.mockReturnValue(listState({ error: 'boom', refetch }));
    renderView();
    expect(screen.getByTestId('orders-error')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('таб «История» пишет ?status=history в URL и фильтр', async () => {
    h.useOrders.mockReturnValue(listState());
    renderView();
    await userEvent.click(screen.getByRole('tab', { name: 'История' }));
    expect(h.useOrders).toHaveBeenLastCalledWith({ scope: 'seller', statusFilter: 'history' });
    expect(screen.getByTestId('order-empty')).toHaveTextContent('История заказов пуста');
  });

  it('URL ?status=history активирует историю (deep link/совместимость)', () => {
    h.useOrders.mockReturnValue(listState());
    renderView('/seller/orders?status=history');
    expect(h.useOrders).toHaveBeenCalledWith({ scope: 'seller', statusFilter: 'history' });
    expect(screen.getByRole('tab', { name: 'История' })).toHaveAttribute('aria-selected', 'true');
  });

  it('«Подробнее» ведёт в деталь заказа продавца', async () => {
    h.useOrders.mockReturnValue(listState({ orders: [order('1')] }));
    renderView();
    await userEvent.click(screen.getByRole('button', { name: 'Подробнее о заказе SH-1' }));
    expect(screen.getByTestId('detail-route')).toBeInTheDocument();
  });
});
