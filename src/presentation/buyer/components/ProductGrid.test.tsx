// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const { useFavorites } = vi.hoisted(() => ({ useFavorites: vi.fn() }));
vi.mock('../../../application/hooks/useFavorites', () => ({ useFavorites }));

import ProductGrid from './ProductGrid';
import type { StorefrontProductCard } from '../../../application/read-models/storefront';

const PRODUCTS: StorefrontProductCard[] = [
  {
    id: 'p1',
    title: 'Nike T-Shirt',
    categoryId: null,
    imageUrl: 'https://cdn/1.jpg',
    price: 249000,
    originalPrice: null,
    available: true,
  },
  {
    id: 'p2',
    title: 'Striped Polo',
    categoryId: null,
    imageUrl: 'https://cdn/2.jpg',
    price: 250000,
    originalPrice: null,
    available: false,
  },
];

beforeEach(() => {
  useFavorites.mockReset();
  useFavorites.mockReturnValue({ isFavorite: () => false, toggleFavorite: vi.fn() });
});

describe('ProductGrid', () => {
  it('без товаров не рендерится', () => {
    const { container } = render(
      <ProductGrid products={[]} currencySymbol="$" onOpen={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('рендерит карточки товаров', () => {
    render(<ProductGrid products={PRODUCTS} currencySymbol="$" onOpen={vi.fn()} />);
    expect(screen.getByText('Nike T-Shirt')).toBeInTheDocument();
    expect(screen.getByText('Striped Polo')).toBeInTheDocument();
  });
});
