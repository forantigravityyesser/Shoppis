// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import OrderStatusBadge from './OrderStatusBadge';

describe('OrderStatusBadge', () => {
  it('показывает RU-подпись статуса', () => {
    render(<OrderStatusBadge status="IN_TRANSIT" />);
    expect(screen.getByTestId('order-status-badge')).toHaveTextContent('В пути');
  });

  it('проставляет data-status и цветовой модификатор', () => {
    render(<OrderStatusBadge status="CANCELLED" />);
    const badge = screen.getByTestId('order-status-badge');
    expect(badge).toHaveAttribute('data-status', 'CANCELLED');
    expect(badge).toHaveClass('order-badge--cancelled');
  });

  it('все пять статусов имеют подпись', () => {
    for (const status of ['NEW', 'IN_TRANSIT', 'DELIVERED', 'REFUSED', 'CANCELLED'] as const) {
      const { unmount } = render(<OrderStatusBadge status={status} />);
      expect(screen.getByTestId('order-status-badge').textContent).not.toBe('');
      unmount();
    }
  });
});
