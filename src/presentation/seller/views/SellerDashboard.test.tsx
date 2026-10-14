// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SellerDashboardSummary } from '../../../application/read-models/seller-dashboard';

const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  refetch: vi.fn(),
  state: {
    currentStore: { name: 'Мой магазин', currencySymbol: '$', currencyCode: 'USD' } as {
      name: string;
      currencySymbol: string;
      currencyCode: 'USD';
    } | null,
  },
  dash: {
    summary: null as unknown,
    loading: false,
    error: null as string | null,
    disabledReason: null as string | null,
    refetch: vi.fn(),
  },
}));

vi.mock('react-router', () => ({ useNavigate: () => h.navigate }));
vi.mock('../../../application/store', () => ({
  useStore: (selector: (s: typeof h.state) => unknown) => selector(h.state),
}));
vi.mock('../../../application/hooks/useSellerDashboard', () => ({
  useSellerDashboard: () => h.dash,
}));

import SellerDashboard from './SellerDashboard';

const summary: SellerDashboardSummary = {
  orders: { new: 1, inTransit: 2, delivered: 3, history: 4 },
  sales: { receivedMinor: 0, frozenMinor: 0 },
  inventory: { activeProducts: 0, archivedProducts: 0, activeCategories: 0 },
};

beforeEach(() => {
  h.navigate.mockReset();
  h.refetch.mockReset();
  h.state.currentStore = { name: 'Мой магазин', currencySymbol: '$', currencyCode: 'USD' };
  h.dash = {
    summary: null,
    loading: false,
    error: null,
    disabledReason: null,
    refetch: h.refetch,
  };
});

describe('SellerDashboard (docs/25 SDB-06)', () => {
  it('loading → skeleton', () => {
    h.dash.loading = true;
    render(<SellerDashboard />);
    expect(screen.getByRole('status', { name: 'Загрузка сводки' })).toBeInTheDocument();
  });

  it('error → состояние ошибки с повтором', async () => {
    h.dash.error = 'boom';
    render(<SellerDashboard />);
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(h.refetch).toHaveBeenCalledTimes(1);
  });

  it('disabled → пустое состояние (нет магазина)', () => {
    h.dash.disabledReason = 'no-store';
    render(<SellerDashboard />);
    expect(screen.getByTestId('dashboard-empty')).toHaveTextContent('Нет данных магазина');
  });

  it('success без сводки → «Сводка недоступна»', () => {
    h.dash.summary = null;
    render(<SellerDashboard />);
    expect(screen.getByTestId('dashboard-empty')).toHaveTextContent('Сводка недоступна');
  });

  it('success → блок «Заказы» с 4 индикаторами', () => {
    h.dash.summary = summary;
    render(<SellerDashboard />);
    const orders = screen.getByTestId('dashboard-orders-stats');
    expect(orders).toBeInTheDocument();
    expect(within(orders).getAllByTestId('dashboard-stat')).toHaveLength(4);
  });

  it('клик по индикатору ведёт в заказы с фильтром статуса', async () => {
    h.dash.summary = summary;
    render(<SellerDashboard />);
    await userEvent.click(screen.getByRole('button', { name: 'История: 4' }));
    expect(h.navigate).toHaveBeenCalledWith('/seller/orders?status=history');
  });

  it('клик по заголовку блока ведёт во все заказы', async () => {
    h.dash.summary = summary;
    render(<SellerDashboard />);
    await userEvent.click(screen.getByRole('button', { name: 'Заказы' }));
    expect(h.navigate).toHaveBeenCalledWith('/seller/orders');
  });

  it('клик по «Категории» ведёт в раздел категорий инвентаря', async () => {
    h.dash.summary = summary;
    render(<SellerDashboard />);
    await userEvent.click(screen.getByRole('button', { name: /Категории/ }));
    expect(h.navigate).toHaveBeenCalledWith('/seller/inventory?mode=categories');
  });

  it('success → блок «Продажи»; клик ведёт на экран продаж', async () => {
    h.dash.summary = summary;
    render(<SellerDashboard />);
    expect(screen.getByTestId('dashboard-sales')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Заработано/ }));
    expect(h.navigate).toHaveBeenCalledWith('/seller/sales');
  });
});
