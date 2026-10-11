// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OrderRefreshButton from './OrderRefreshButton';

describe('OrderRefreshButton (docs/22 ORD-14)', () => {
  it('по тапу вызывает onRefresh', async () => {
    const onRefresh = vi.fn();
    render(<OrderRefreshButton onRefresh={onRefresh} />);

    await userEvent.click(screen.getByTestId('orders-refresh'));

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('во время перечитывания блокируется и имеет доступное имя', () => {
    render(<OrderRefreshButton onRefresh={() => {}} refreshing />);

    const button = screen.getByTestId('orders-refresh');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-label', 'Обновить заказы');
  });

  it('disabled не вызывает onRefresh', async () => {
    const onRefresh = vi.fn();
    render(<OrderRefreshButton onRefresh={onRefresh} disabled />);

    await userEvent.click(screen.getByTestId('orders-refresh'));

    expect(onRefresh).not.toHaveBeenCalled();
  });
});
