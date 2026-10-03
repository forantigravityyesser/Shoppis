// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { useFavorites } = vi.hoisted(() => ({ useFavorites: vi.fn() }));
vi.mock('../../../application/hooks/useFavorites', () => ({ useFavorites }));

import ProductCard from './ProductCard';
import type { StorefrontProductCard } from '../../../application/read-models/storefront';

const PRODUCT: StorefrontProductCard = {
  id: 'p1',
  title: 'Nike T-Shirt',
  categoryId: null,
  imageUrl: 'https://cdn/thumb.jpg',
  price: 249000,
  originalPrice: 349000,
  available: true,
};

beforeEach(() => {
  useFavorites.mockReset();
  useFavorites.mockReturnValue({ isFavorite: () => false, toggleFavorite: vi.fn() });
});

describe('ProductCard', () => {
  it('рендерит фото, название и актуальную цену', () => {
    const { container } = render(
      <ProductCard product={PRODUCT} currencySymbol="$" onOpen={vi.fn()} />,
    );

    expect(screen.getByRole('img', { name: 'Nike T-Shirt' })).toHaveAttribute(
      'src',
      'https://cdn/thumb.jpg',
    );
    expect(screen.getByText('Nike T-Shirt')).toBeInTheDocument();
    expect(screen.getByText('2490 $')).toBeInTheDocument();
    expect(screen.queryByText('3490 $')).toBeNull(); // originalPrice на карточке не показываем
    expect(screen.queryByText('Нет в наличии')).toBeNull();
    // Единая карточка: название и цена в одной строке.
    expect(container.querySelector('.product-card__info')).not.toBeNull();
  });


  it('sold out: бейдж «Нет в наличии»', () => {
    render(
      <ProductCard product={{ ...PRODUCT, available: false }} currencySymbol="$" onOpen={vi.fn()} />,
    );
    expect(screen.getByText('Нет в наличии')).toBeInTheDocument();
  });

  it('клик по карточке открывает товар по id', async () => {
    const onOpen = vi.fn();
    render(<ProductCard product={PRODUCT} currencySymbol="$" onOpen={onOpen} />);

    await userEvent.click(screen.getByRole('button', { name: 'Nike T-Shirt' }));
    expect(onOpen).toHaveBeenCalledWith('p1');
  });

  it('без фото — заглушка с первой буквой', () => {
    render(
      <ProductCard product={{ ...PRODUCT, imageUrl: null }} currencySymbol="$" onOpen={vi.fn()} />,
    );
    expect(screen.queryByRole('img', { name: 'Nike T-Shirt' })).toBeNull();
    expect(screen.getByText('N')).toBeInTheDocument();
  });

  it('битое фото → заглушка с первой буквой', () => {
    const { container } = render(
      <ProductCard product={PRODUCT} currencySymbol="$" onOpen={vi.fn()} />,
    );
    fireEvent.error(container.querySelector('.product-card__img') as HTMLImageElement);
    expect(screen.getByText('N')).toBeInTheDocument();
  });
});
