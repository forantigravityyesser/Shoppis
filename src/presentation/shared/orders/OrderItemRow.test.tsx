// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import OrderItemRow from './OrderItemRow';
import type { OrderItemView } from '../../../application/read-models/order';

const item = (overrides: Partial<OrderItemView> = {}): OrderItemView => ({
  productTitleSnapshot: 'Толстовка',
  productImageSnapshot: 'https://cdn/a.jpg',
  variantNameSnapshot: 'Размер:',
  variantValueSnapshot: '42-48',
  linkingAttributesSnapshot: [],
  quantity: 2,
  unitPriceMinor: 220000,
  lineTotalMinor: 440000,
  ...overrides,
});

describe('OrderItemRow', () => {
  it('рендерит snapshot позиции: title, variant, qty × unit, сумму строки', () => {
    render(<OrderItemRow item={item()} currencySymbol="Br" />);
    expect(screen.getByText('Толстовка')).toBeInTheDocument();
    expect(screen.getByText('Размер: 42-48')).toBeInTheDocument();
    expect(screen.getByText('2 × 2200 Br')).toBeInTheDocument();
    expect(screen.getByText('4400 Br')).toBeInTheDocument();
  });

  it('без изображения показывает placeholder, без broken <img>', () => {
    render(<OrderItemRow item={item({ productImageSnapshot: null })} currencySymbol="Br" />);
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('без варианта не рендерит строку варианта', () => {
    render(
      <OrderItemRow
        item={item({ variantNameSnapshot: null, variantValueSnapshot: null })}
        currencySymbol="$"
      />,
    );
    expect(screen.getByText('Толстовка')).toBeInTheDocument();
    expect(screen.queryByText(/Размер/)).toBeNull();
  });
});
