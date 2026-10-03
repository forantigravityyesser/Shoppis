// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { useFavorites } = vi.hoisted(() => ({ useFavorites: vi.fn() }));
vi.mock('../../../application/hooks/useFavorites', () => ({ useFavorites }));

import ProductSection from './ProductSection';
import type { StorefrontProductCard } from '../../../application/read-models/storefront';

function makeProducts(count: number): StorefrontProductCard[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    title: `Товар ${i + 1}`,
    categoryId: null,
    imageUrl: null,
    price: 100000,
    originalPrice: null,
    available: true,
  }));
}

beforeEach(() => {
  useFavorites.mockReset();
  useFavorites.mockReturnValue({ isFavorite: () => false, toggleFavorite: vi.fn() });
});

describe('ProductSection', () => {
  it('без товаров не рендерится', () => {
    const { container } = render(
      <ProductSection
        products={[]}
        currencySymbol="$"
        onOpen={vi.fn()}
        onViewAll={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('показывает заголовок и «Смотреть все →», вызывает onViewAll', async () => {
    const onViewAll = vi.fn();
    render(
      <ProductSection
        products={makeProducts(3)}
        currencySymbol="$"
        onOpen={vi.fn()}
        onViewAll={onViewAll}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Товары' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Смотреть все →' }));
    expect(onViewAll).toHaveBeenCalledTimes(1);
  });

  it('ограничивает количество карточек лимитом', () => {
    render(
      <ProductSection
        products={makeProducts(8)}
        currencySymbol="$"
        onOpen={vi.fn()}
        onViewAll={vi.fn()}
        limit={6}
      />,
    );

    expect(screen.getByText('Товар 6')).toBeInTheDocument();
    expect(screen.queryByText('Товар 7')).toBeNull();
    expect(screen.queryByText('Товар 8')).toBeNull();
  });

  it('тап карточки открывает товар', async () => {
    const onOpen = vi.fn();
    render(
      <ProductSection
        products={makeProducts(1)}
        currencySymbol="$"
        onOpen={onOpen}
        onViewAll={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Товар 1' }));
    expect(onOpen).toHaveBeenCalledWith('p1');
  });
});
