// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import OrderSkeleton from './OrderSkeleton';

describe('OrderSkeleton', () => {
  it('вариант list рендерит count заглушек-карточек', () => {
    const { container } = render(<OrderSkeleton variant="list" count={2} />);
    expect(screen.getByTestId('order-skeleton')).toBeInTheDocument();
    expect(container.querySelectorAll('.order-skeleton__block')).toHaveLength(2);
  });

  it('вариант detail рендерит шапку и блоки', () => {
    const { container } = render(<OrderSkeleton variant="detail" />);
    expect(container.querySelector('.order-skeleton__block--head')).not.toBeNull();
  });

  it('объявляет live-статус, визуальные блоки скрыты (docs/24 D9)', () => {
    const { container } = render(<OrderSkeleton />);
    expect(screen.getByTestId('order-skeleton')).toHaveAttribute('role', 'status');
    expect(container.querySelector('.order-skeleton__block')).toHaveAttribute('aria-hidden', 'true');
  });
});
