// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import type { OrderDetails } from '../../../application/read-models/order';
import type { OrderDetailsState } from '../../../application/hooks/useOrderDetails';
import type { OrderActionsState } from '../../../application/hooks/useOrderActions';

const h = vi.hoisted(() => ({
  useOrderDetails: vi.fn(),
  useOrderActions: vi.fn(),
  cancelOrder: vi.fn(),
  transitionOrder: vi.fn(),
  recordDeliveryOutcome: vi.fn(),
  openLink: vi.fn(() => true),
}));

vi.mock('../../../application/hooks/useOrderDetails', () => ({ useOrderDetails: h.useOrderDetails }));
vi.mock('../../../application/hooks/useOrdersRealtime', () => ({ useOrdersRealtime: () => {} }));
vi.mock('../../../application/hooks/useOrderActions', () => ({ useOrderActions: h.useOrderActions }));
vi.mock('../../../application/hooks/useHaptic', () => ({
  useHaptic: () => ({ selectTick: vi.fn() }),
}));
vi.mock('../../../application/hooks/useOpenTelegramLink', () => ({
  useOpenTelegramLink: () => h.openLink,
}));

import SellerOrderDetailsView from './SellerOrderDetailsView';

const BASE: OrderDetails = {
  id: 'o1',
  publicOrderNumber: 'SH-1',
  status: 'NEW',
  deliveryOutcome: null,
  refusalReasonCode: null,
  currencyCode: 'BYN',
  currencySymbol: 'Br',
  subtotalMinor: 220000,
  totalMinor: 220000,
  createdAt: '2026-10-10T10:00:00Z',
  updatedAt: '2026-10-10T10:00:00Z',
  cancelledAt: null,
  completedAt: null,
  refusedAt: null,
  delivery: { fullName: 'Данила', phone: '+375257914112', address: 'Минск' },
  contact: { supportHandle: null, telegramUsername: 'buyer_x' },
  items: [
    {
      productTitleSnapshot: 'Толстовка',
      productImageSnapshot: null,
      variantNameSnapshot: null,
      variantValueSnapshot: null,
      linkingAttributesSnapshot: [],
      quantity: 1,
      unitPriceMinor: 220000,
      lineTotalMinor: 220000,
    },
  ],
};

function order(overrides: Partial<OrderDetails> = {}): OrderDetails {
  return { ...BASE, ...overrides };
}

function detailsState(overrides: Partial<OrderDetailsState> = {}): OrderDetailsState {
  return { order: null, loading: false, error: null, notFound: false, refetch: vi.fn(), ...overrides };
}

function actionsState(overrides: Partial<OrderActionsState> = {}): OrderActionsState {
  return {
    cancelOrder: h.cancelOrder,
    transitionOrder: h.transitionOrder,
    recordDeliveryOutcome: h.recordDeliveryOutcome,
    isPending: false,
    error: null,
    ...overrides,
  };
}

function tree() {
  return (
    <MemoryRouter initialEntries={['/seller/orders/o1']}>
      <Routes>
        <Route path="/seller/orders" element={<div data-testid="seller-orders-route" />} />
        <Route path="/seller/orders/:orderId" element={<SellerOrderDetailsView />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  h.useOrderDetails.mockReset();
  h.useOrderActions.mockReset();
  h.cancelOrder.mockReset();
  h.transitionOrder.mockReset();
  h.recordDeliveryOutcome.mockReset();
  h.cancelOrder.mockResolvedValue(undefined);
  h.transitionOrder.mockResolvedValue(undefined);
  h.recordDeliveryOutcome.mockResolvedValue(undefined);
  h.openLink.mockReset();
  h.openLink.mockReturnValue(true);
  h.useOrderActions.mockReturnValue(actionsState());
});

describe('SellerOrderDetailsView (ORD-08/ORD-10)', () => {
  it('loading → скелетон; scope=seller', () => {
    h.useOrderDetails.mockReturnValue(detailsState({ loading: true }));
    render(tree());
    expect(screen.getByTestId('order-skeleton')).toBeInTheDocument();
    expect(h.useOrderDetails).toHaveBeenCalledWith({ scope: 'seller', orderId: 'o1' });
  });

  it('notFound → «Заказ не найден» + возврат к списку', async () => {
    h.useOrderDetails.mockReturnValue(detailsState({ notFound: true }));
    render(tree());
    expect(screen.getByText('Заказ не найден')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'К заказам' }));
    expect(screen.getByTestId('seller-orders-route')).toBeInTheDocument();
  });

  it('контакт покупателя: TG-снимок → кнопка t.me', async () => {
    h.useOrderDetails.mockReturnValue(detailsState({ order: order() }));
    render(tree());
    await userEvent.click(screen.getByRole('button', { name: /Написать покупателю/ }));
    expect(h.openLink).toHaveBeenCalledWith('https://t.me/buyer_x');
  });

  it('нет TG-снимка → телефон из доставки', () => {
    h.useOrderDetails.mockReturnValue(
      detailsState({ order: order({ contact: { supportHandle: null, telegramUsername: null } }) }),
    );
    render(tree());
    expect(screen.getByText('Телефон: +375257914112')).toBeInTheDocument();
  });

  it('NEW → «Передать в доставку»', async () => {
    h.useOrderDetails.mockReturnValue(detailsState({ order: order({ status: 'NEW' }) }));
    render(tree());
    await userEvent.click(screen.getByRole('button', { name: 'Передать в доставку' }));
    expect(h.transitionOrder).toHaveBeenCalledWith({ orderId: 'o1', toStatus: 'IN_TRANSIT' });
  });

  it('NEW cancel → confirmation → cancelOrder(actor seller)', async () => {
    h.useOrderDetails.mockReturnValue(detailsState({ order: order({ status: 'NEW' }) }));
    render(tree());
    await userEvent.click(screen.getByRole('button', { name: 'Отменить' }));
    expect(screen.getByText('Отменить этот заказ?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Отменить заказ' }));
    expect(h.cancelOrder).toHaveBeenCalledWith({ orderId: 'o1', actor: 'seller' });
  });

  it('IN_TRANSIT → «Отметить доставленным»', async () => {
    h.useOrderDetails.mockReturnValue(detailsState({ order: order({ status: 'IN_TRANSIT' }) }));
    render(tree());
    await userEvent.click(screen.getByRole('button', { name: 'Отметить доставленным' }));
    expect(h.transitionOrder).toHaveBeenCalledWith({ orderId: 'o1', toStatus: 'DELIVERED' });
  });

  it('IN_TRANSIT cancel → confirmation с предупреждением про held', async () => {
    h.useOrderDetails.mockReturnValue(detailsState({ order: order({ status: 'IN_TRANSIT' }) }));
    render(tree());
    await userEvent.click(screen.getByRole('button', { name: 'Отменить' }));
    expect(screen.getByText(/Остаток не вернётся автоматически/)).toBeInTheDocument();
  });

  it('DELIVERED → «Покупатель забрал» (outcome RECEIVED)', async () => {
    h.useOrderDetails.mockReturnValue(
      detailsState({ order: order({ status: 'DELIVERED', deliveryOutcome: null }) }),
    );
    render(tree());
    await userEvent.click(screen.getByRole('button', { name: 'Покупатель забрал' }));
    expect(h.recordDeliveryOutcome).toHaveBeenCalledWith({ orderId: 'o1', outcome: 'RECEIVED' });
  });

  it('DELIVERED + outcome зафиксирован → outcome-действий нет (терминально)', () => {
    h.useOrderDetails.mockReturnValue(
      detailsState({ order: order({ status: 'DELIVERED', deliveryOutcome: 'RECEIVED' }) }),
    );
    render(tree());
    expect(screen.queryByTestId('order-actions')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Покупатель забрал' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Отказ' })).toBeNull();
  });

  it('DELIVERED → отказ: причина обязательна, затем REFUSED с кодом', async () => {
    h.useOrderDetails.mockReturnValue(detailsState({ order: order({ status: 'DELIVERED' }) }));
    render(tree());
    await userEvent.click(screen.getByRole('button', { name: 'Отказ' }));

    expect(screen.getByText('Укажите причину отказа')).toBeInTheDocument();
    const confirm = screen.getByRole('button', { name: 'Подтвердить отказ' });
    expect(confirm).toBeDisabled();

    await userEvent.click(screen.getByRole('radio', { name: 'Товар не соответствует ожиданиям' }));
    await userEvent.click(screen.getByRole('button', { name: 'Подтвердить отказ' }));
    expect(h.recordDeliveryOutcome).toHaveBeenCalledWith({
      orderId: 'o1',
      outcome: 'REFUSED',
      reason: 'PRODUCT_NOT_MATCHED_EXPECTATIONS',
    });
  });

  it('терминальный заказ → действий нет', () => {
    h.useOrderDetails.mockReturnValue(detailsState({ order: order({ status: 'CANCELLED' }) }));
    render(tree());
    expect(screen.queryByTestId('order-actions')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Отменить' })).toBeNull();
  });
});
