// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import OrderDetailsContent from './OrderDetailsContent';
import type { OrderDetails } from '../../../application/read-models/order';

function order(overrides: Partial<OrderDetails> = {}): OrderDetails {
  return {
    id: 'o1',
    publicOrderNumber: 'SH-1',
    status: 'IN_TRANSIT',
    deliveryOutcome: null,
    refusalReasonCode: null,
    currencyCode: 'BYN',
    currencySymbol: 'Br',
    subtotalMinor: 220000,
    totalMinor: 220000,
    createdAt: '2026-10-10T10:00:00Z',
    updatedAt: '2026-10-10T11:00:00Z',
    cancelledAt: null,
    completedAt: null,
    refusedAt: null,
    delivery: { fullName: 'Данила', phone: '+375257914112', address: 'Минск, Ленина 1' },
    contact: { supportHandle: 'Dnk_65', telegramUsername: null },
    items: [
      {
        productTitleSnapshot: 'Толстовка',
        productImageSnapshot: null,
        variantNameSnapshot: 'Размер:',
        variantValueSnapshot: '42',
        linkingAttributesSnapshot: [],
        quantity: 1,
        unitPriceMinor: 220000,
        lineTotalMinor: 220000,
      },
    ],
    ...overrides,
  };
}

describe('OrderDetailsContent (ORD-08)', () => {
  it('рендерит статус, даты, товары, доставку и итог одной строкой', () => {
    render(<OrderDetailsContent order={order()} />);
    expect(screen.getByText('Статус заказа')).toBeInTheDocument();
    expect(screen.getByTestId('order-status-badge')).toHaveTextContent('В пути');
    expect(screen.getByText('Товары')).toBeInTheDocument();
    expect(screen.getByText('Толстовка')).toBeInTheDocument();
    expect(screen.getByText('Доставка')).toBeInTheDocument();
    expect(screen.getByText('Данила')).toBeInTheDocument();
    expect(screen.getByText('Итого')).toBeInTheDocument();
    expect(screen.getByTestId('order-total-value')).toHaveTextContent('2200 Br');
    // Без subtotal/shipping/tax/payment.
    expect(screen.queryByText(/Доставка оплачена|Subtotal|Tax|Налог/i)).toBeNull();
  });

  it('контакт рендерится, если передан; секции нет без него', () => {
    const { rerender } = render(
      <OrderDetailsContent order={order()} contact={<span>КОНТАКТ</span>} />,
    );
    expect(screen.getByText('Контакт')).toBeInTheDocument();
    expect(screen.getByText('КОНТАКТ')).toBeInTheDocument();

    rerender(<OrderDetailsContent order={order()} />);
    expect(screen.queryByText('Контакт')).toBeNull();
  });

  it('REFUSED с причиной → понятная подпись', () => {
    render(
      <OrderDetailsContent
        order={order({ status: 'REFUSED', deliveryOutcome: 'REFUSED', refusalReasonCode: 'OTHER' })}
      />,
    );
    expect(screen.getByText('Причина отказа: Другое')).toBeInTheDocument();
  });

  it('RECEIVED → отметка о получении (статус остаётся DELIVERED)', () => {
    render(
      <OrderDetailsContent order={order({ status: 'DELIVERED', deliveryOutcome: 'RECEIVED' })} />,
    );
    expect(screen.getByText('Покупатель забрал заказ')).toBeInTheDocument();
  });
});
