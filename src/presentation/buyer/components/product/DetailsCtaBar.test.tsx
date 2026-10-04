// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import DetailsCtaBar from './DetailsCtaBar';

type Props = Parameters<typeof DetailsCtaBar>[0];

function makeProps(over: Partial<Props> = {}): Props {
  return {
    priceLabel: '2490 $',
    originalPriceLabel: null,
    soldOut: false,
    canAdd: true,
    isFavorite: false,
    onToggleFavorite: vi.fn(),
    onAddToCart: vi.fn(),
    ...over,
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('DetailsCtaBar', () => {
  it('показывает цену; добавление вызывает onAddToCart и морфит кнопку', () => {
    const onAddToCart = vi.fn();
    render(<DetailsCtaBar {...makeProps({ onAddToCart })} />);

    expect(screen.getByText('2490 $')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Добавить в корзину' }));
    expect(onAddToCart).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Добавлено' })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(screen.getByRole('button', { name: 'Добавить в корзину' })).toBeInTheDocument();
  });

  it('все распродано → кнопка «Нет в наличии» disabled', () => {
    render(<DetailsCtaBar {...makeProps({ soldOut: true, canAdd: false })} />);
    expect(screen.getByRole('button', { name: 'Нет в наличии' })).toBeDisabled();
  });

  it('клик по сердцу → onToggleFavorite', () => {
    const onToggleFavorite = vi.fn();
    render(<DetailsCtaBar {...makeProps({ onToggleFavorite })} />);

    fireEvent.click(screen.getByRole('button', { name: 'В избранное' }));
    expect(onToggleFavorite).toHaveBeenCalledTimes(1);
  });
});
