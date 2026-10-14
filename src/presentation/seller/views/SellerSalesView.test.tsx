// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import type { OrderListItem } from '../../../application/read-models/order';
import type { SellerSalesState } from '../../../application/hooks/useSellerSales';

const h = vi.hoisted(() => ({
  useSellerSales: vi.fn(),
  state: { currentStore: { currencySymbol: '$', currencyCode: 'USD' } },
}));

vi.mock('../../../application/hooks/useSellerSales', () => ({ useSellerSales: h.useSellerSales }));
vi.mock('../../../application/hooks/useOrdersRealtime', () => ({ useOrdersRealtime: () => {} }));
vi.mock('../../../application/hooks/useHaptic', () => ({
  useHaptic: () => ({ selectTick: vi.fn() }),
}));
vi.mock('../../../application/store', () => ({
  useStore: (selector: (s: typeof h.state) => unknown) => selector(h.state),
}));

import SellerSalesView from './SellerSalesView';

function order(id: string): OrderListItem {
  return {
    id,
    publicOrderNumber: `SH-${id}`,
    status: 'NEW',
    createdAt: '2026-10-10T10:00:00Z',
    totalMinor: 220000,
    currencyCode: 'USD',
    currencySymbol: '$',
    itemCount: 1,
    previewItems: [{ imageUrl: null, title: 'Толстовка', variantLabel: null, quantity: 1 }],
  };
}

function salesState(overrides: Partial<SellerSalesState> = {}): SellerSalesState {
  return {
    orders: [],
    totalMinor: 0,
    loading: false,
    fetching: false,
    error: null,
    hasNextPage: false,
    disabledReason: null,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
    ...overrides,
  };
}

let earned: SellerSalesState;
let potential: SellerSalesState;

beforeEach(() => {
  earned = salesState();
  potential = salesState();
  h.useSellerSales.mockReset();
  h.useSellerSales.mockImplementation(({ group }: { group: string }) =>
    group === 'earned' ? earned : potential,
  );
});

function renderView(entry = '/seller/sales') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/seller/sales" element={<SellerSalesView />} />
        <Route path="/seller/orders/:orderId" element={<div data-testid="detail-route" />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SellerSalesView (docs/25 §4.3 / SDB-09)', () => {
  it('шапка «Продажи», переключатель разделов; по умолчанию — «Заработано»', () => {
    renderView();
    expect(screen.getByRole('heading', { name: 'Продажи' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Заработано' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: 'Потенциальные' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
    expect(h.useSellerSales).toHaveBeenCalledWith({ group: 'earned' });
  });

  it('переключение на «Потенциальные» открывает второй раздел (URL ?group=potential)', async () => {
    renderView();
    await userEvent.click(screen.getByRole('tab', { name: 'Потенциальные' }));
    expect(h.useSellerSales).toHaveBeenLastCalledWith({ group: 'potential' });
    expect(screen.getByRole('tab', { name: 'Потенциальные' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('deep link ?group=potential открывает потенциальные', () => {
    renderView('/seller/sales?group=potential');
    expect(h.useSellerSales).toHaveBeenCalledWith({ group: 'potential' });
    expect(screen.getByRole('tab', { name: 'Потенциальные' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('сумма активного раздела форматируется с символом валюты', () => {
    earned = salesState({ totalMinor: 100000 });
    renderView();
    expect(screen.getByTestId('sales-total')).toHaveTextContent('1000 $');
  });

  it('карточки раздела показывают тон цены earned/potential', async () => {
    earned = salesState({ orders: [order('1')] });
    potential = salesState({ orders: [order('2')] });
    renderView();
    const earnedRegion = screen.getByRole('region', { name: 'Заработано' });
    expect(within(earnedRegion).getByText('2200 $')).toHaveClass('order-card__total--earned');

    await userEvent.click(screen.getByRole('tab', { name: 'Потенциальные' }));
    const potentialRegion = screen.getByRole('region', { name: 'Потенциальные' });
    expect(within(potentialRegion).getByText('2200 $')).toHaveClass('order-card__total--potential');
  });

  it('пустые разделы показывают свои тексты', async () => {
    renderView();
    expect(screen.getByText('Полученных продаж пока нет')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Потенциальные' }));
    expect(screen.getByText('Потенциальных продаж нет')).toBeInTheDocument();
  });

  it('клик «Подробнее» ведёт в детали заказа', async () => {
    earned = salesState({ orders: [order('1')] });
    renderView();
    await userEvent.click(screen.getByRole('button', { name: 'Подробнее о заказе SH-1' }));
    expect(screen.getByTestId('detail-route')).toBeInTheDocument();
  });

  it('ошибка раздела → «Повторить» вызывает refetch', async () => {
    const refetch = vi.fn();
    earned = salesState({ error: 'boom', refetch });
    renderView();
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
