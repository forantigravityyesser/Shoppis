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

import OrderDetailsView from './OrderDetailsView';

const ORDER: OrderDetails = {
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
  contact: { supportHandle: 'Dnk_65', telegramUsername: null },
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

function detailsState(overrides: Partial<OrderDetailsState> = {}): OrderDetailsState {
  return { order: null, loading: false, error: null, notFound: false, refetch: vi.fn(), ...overrides };
}

function actionsState(overrides: Partial<OrderActionsState> = {}): OrderActionsState {
  return {
    cancelOrder: h.cancelOrder,
    transitionOrder: vi.fn(),
    recordDeliveryOutcome: vi.fn(),
    isPending: false,
    error: null,
    ...overrides,
  };
}

function tree() {
  return (
    <MemoryRouter initialEntries={['/orders/o1']}>
      <Routes>
        <Route path="/orders" element={<div data-testid="orders-route" />} />
        <Route path="/orders/:orderId" element={<OrderDetailsView />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  h.useOrderDetails.mockReset();
  h.useOrderActions.mockReset();
  h.cancelOrder.mockReset();
  h.cancelOrder.mockResolvedValue(undefined);
  h.openLink.mockReset();
  h.openLink.mockReturnValue(true);
  h.useOrderActions.mockReturnValue(actionsState());
});

describe('OrderDetailsView (buyer, ORD-08)', () => {
  it('loading → скелетон детали', () => {
    h.useOrderDetails.mockReturnValue(detailsState({ loading: true }));
    render(tree());
    expect(screen.getByTestId('order-skeleton')).toBeInTheDocument();
    expect(h.useOrderDetails).toHaveBeenCalledWith({ scope: 'buyer', orderId: 'o1' });
  });

  it('notFound → «Заказ не найден» + возврат к списку', async () => {
    h.useOrderDetails.mockReturnValue(detailsState({ notFound: true }));
    render(tree());
    expect(screen.getByText('Заказ не найден')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'К заказам' }));
    expect(screen.getByTestId('orders-route')).toBeInTheDocument();
  });

  it('ошибка → экран ошибки с повтором', async () => {
    const refetch = vi.fn();
    h.useOrderDetails.mockReturnValue(detailsState({ error: 'boom', refetch }));
    render(tree());
    expect(screen.getByTestId('order-detail-error')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('успех → шапка с номером, товары, итог и контакт продавца', () => {
    h.useOrderDetails.mockReturnValue(detailsState({ order: ORDER }));
    render(tree());
    expect(screen.getByRole('heading', { name: 'Заказ № SH-1' })).toBeInTheDocument();
    expect(screen.getByText('Товары')).toBeInTheDocument();
    expect(screen.getByTestId('order-total-value')).toHaveTextContent('2200 Br');
  });

  it('контакт продавца → t.me по support_handle', async () => {
    h.useOrderDetails.mockReturnValue(detailsState({ order: ORDER }));
    render(tree());
    await userEvent.click(screen.getByRole('button', { name: /Написать продавцу/ }));
    expect(h.openLink).toHaveBeenCalledWith('https://t.me/Dnk_65');
  });

  it('контакт не задан → понятный текст', () => {
    h.useOrderDetails.mockReturnValue(
      detailsState({ order: { ...ORDER, contact: { supportHandle: null, telegramUsername: null } } }),
    );
    render(tree());
    expect(screen.getByText('Продавец не указал контакт для связи.')).toBeInTheDocument();
  });
});

describe('OrderDetailsView (buyer, ORD-09 — отмена)', () => {
  it('NEW: отмена → confirmation → cancelOrder(actor buyer)', async () => {
    h.useOrderDetails.mockReturnValue(detailsState({ order: ORDER }));
    render(tree());

    await userEvent.click(screen.getByRole('button', { name: 'Отменить заказ' }));
    expect(screen.getByText('Отменить этот заказ?')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Отменить заказ' }));
    expect(h.cancelOrder).toHaveBeenCalledWith({ orderId: 'o1', actor: 'buyer' });
  });

  it('«Отмена» в confirmation закрывает его без мутации', async () => {
    h.useOrderDetails.mockReturnValue(detailsState({ order: ORDER }));
    render(tree());

    await userEvent.click(screen.getByRole('button', { name: 'Отменить заказ' }));
    await userEvent.click(screen.getByRole('button', { name: 'Отмена' }));
    expect(h.cancelOrder).not.toHaveBeenCalled();
    expect(screen.queryByText('Отменить этот заказ?')).toBeNull();
  });

  it('pending → кнопка подтверждения disabled', async () => {
    h.useOrderDetails.mockReturnValue(detailsState({ order: ORDER }));
    const { rerender } = render(tree());
    await userEvent.click(screen.getByRole('button', { name: 'Отменить заказ' }));

    h.useOrderActions.mockReturnValue(actionsState({ isPending: true }));
    rerender(tree());
    expect(screen.getByRole('button', { name: 'Отменить заказ' })).toBeDisabled();
  });

  it('не-NEW заказ → кнопки отмены нет', () => {
    h.useOrderDetails.mockReturnValue(detailsState({ order: { ...ORDER, status: 'DELIVERED' } }));
    render(tree());
    expect(screen.queryByRole('button', { name: 'Отменить заказ' })).toBeNull();
  });

  it('ошибка отмены маппится и обновляет деталь', async () => {
    const refetch = vi.fn();
    h.useOrderDetails.mockReturnValue(detailsState({ order: ORDER, refetch }));
    h.cancelOrder.mockRejectedValue(new Error('CANCEL_NOT_ALLOWED'));
    render(tree());

    await userEvent.click(screen.getByRole('button', { name: 'Отменить заказ' }));
    await userEvent.click(screen.getByRole('button', { name: 'Отменить заказ' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Этот заказ уже нельзя отменить.');
    expect(refetch).toHaveBeenCalled();
  });
});
