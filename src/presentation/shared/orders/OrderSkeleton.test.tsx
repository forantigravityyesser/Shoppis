// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import OrderSkeleton from './OrderSkeleton';

describe('OrderSkeleton', () => {
  it('вариант list рендерит count карточек-заглушек', () => {
    const { container } = render(<OrderSkeleton variant="list" count={2} />);
    expect(screen.getByTestId('order-skeleton')).toBeInTheDocument();
    expect(container.querySelectorAll('.order-skeleton__block')).toHaveLength(2);
  });

  it('вариант detail рендерит шапку и блоки', () => {
    const { container } = render(<OrderSkeleton variant="detail" />);
    expect(container.querySelector('.order-skeleton__block--head')).not.toBeNull();
  });

  it('скрыт от скринридеров (aria-hidden)', () => {
    render(<OrderSkeleton />);
    expect(screen.getByTestId('order-skeleton')).toHaveAttribute('aria-hidden', 'true');
  });
});
