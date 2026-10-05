// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CartQuantityControl from './CartQuantityControl';
import { MAX_CART_QTY } from '../../../../domain/constants/limits';

describe('CartQuantityControl', () => {
  it('показывает количество и вызывает onChange при +/−', async () => {
    const onChange = vi.fn();
    render(<CartQuantityControl quantity={2} onChange={onChange} />);

    expect(screen.getByText('2')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Увеличить количество' }));
    expect(onChange).toHaveBeenCalledWith(3);
    await userEvent.click(screen.getByRole('button', { name: 'Уменьшить количество' }));
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it('на границах кнопки disabled', () => {
    const { rerender } = render(<CartQuantityControl quantity={1} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Уменьшить количество' })).toBeDisabled();

    rerender(<CartQuantityControl quantity={MAX_CART_QTY} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Увеличить количество' })).toBeDisabled();
  });

  it('disabled выключает обе кнопки', () => {
    render(<CartQuantityControl quantity={5} disabled onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Увеличить количество' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Уменьшить количество' })).toBeDisabled();
  });
});
