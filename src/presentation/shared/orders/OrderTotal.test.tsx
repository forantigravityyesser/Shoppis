// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import OrderTotal from './OrderTotal';

describe('OrderTotal', () => {
  it('показывает «Итого» и отформатированную сумму', () => {
    render(<OrderTotal totalMinor={220000} currencySymbol="Br" />);
    expect(screen.getByText('Итого')).toBeInTheDocument();
    expect(screen.getByTestId('order-total-value')).toHaveTextContent('2200 Br');
  });

  it('пользовательская подпись', () => {
    render(<OrderTotal totalMinor={1000} currencySymbol="$" label="Сумма" />);
    expect(screen.getByText('Сумма')).toBeInTheDocument();
  });
});
