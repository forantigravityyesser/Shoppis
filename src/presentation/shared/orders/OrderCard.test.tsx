// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import OrderCard from './OrderCard';
import type { OrderListItem } from '../../../application/read-models/order';

function order(overrides: Partial<OrderListItem> = {}): OrderListItem {
  return {
    id: 'o1',
    publicOrderNumber: 'SH-261010-ABC',
    status: 'NEW',
    createdAt: '2026-10-10T10:00:00Z',
    totalMinor: 220000,
    currencyCode: 'BYN',
    currencySymbol: 'Br',
    itemCount: 2,
    previewItems: [
      { imageUrl: null, title: 'Толстовка', variantLabel: 'Размер: 42', quantity: 1 },
      { imageUrl: null, title: 'Худи', variantLabel: null, quantity: 1 },
    ],
    ...overrides,
  };
}

describe('OrderCard', () => {
  it('рендерит номер, статус, состав, сумму и «Сумма заказа»', () => {
    render(<OrderCard order={order()} />);
    expect(screen.getByText('№ SH-261010-ABC')).toBeInTheDocument();
    expect(screen.getByTestId('order-status-badge')).toHaveTextContent('Новый');
    expect(screen.getByText('Толстовка и ещё 1')).toBeInTheDocument();
    expect(screen.getByText('Сумма заказа')).toBeInTheDocument();
    expect(screen.getByText('2200 Br')).toBeInTheDocument();
  });

  it('onOpen показывает кнопку «Подробнее» и отдаёт orderId', () => {
    const onOpen = vi.fn();
    render(<OrderCard order={order()} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole('button', { name: 'Подробнее о заказе SH-261010-ABC' }));
    expect(onOpen).toHaveBeenCalledWith('o1');
  });

  it('без onOpen кнопки «Подробнее» нет', () => {
    render(<OrderCard order={order()} />);
    expect(screen.queryByText('Подробнее')).toBeNull();
  });

  it('+N отображается при itemCount > превью и summary считает остаток', () => {
    render(<OrderCard order={order({ itemCount: 5 })} />);
    expect(screen.getByTestId('order-preview-more')).toHaveTextContent('+3');
    expect(screen.getByText('Толстовка и ещё 4')).toBeInTheDocument();
  });

  it('subtitle и footer рендерятся (actor-специфичные данные без логики)', () => {
    render(
      <OrderCard order={order()} subtitle="Покупатель: Данила" footer={<span>Действие</span>} />,
    );
    expect(screen.getByText('Покупатель: Данила')).toBeInTheDocument();
    expect(screen.getByText('Действие')).toBeInTheDocument();
  });

  it('priceTone окрашивает сумму: earned/potential (docs/25 §4.3)', () => {
    const { rerender } = render(<OrderCard order={order()} priceTone="earned" />);
    expect(screen.getByText('2200 Br')).toHaveClass('order-card__total--earned');

    rerender(<OrderCard order={order()} priceTone="potential" />);
    expect(screen.getByText('2200 Br')).toHaveClass('order-card__total--potential');
  });

  it('без priceTone сумма без тонального класса', () => {
    render(<OrderCard order={order()} />);
    const total = screen.getByText('2200 Br');
    expect(total.className).toContain('order-card__total');
    expect(total.className).not.toMatch(/order-card__total--/);
  });
});
