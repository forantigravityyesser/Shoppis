// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { StorefrontRelatedProduct } from '../../../../application/read-models/storefront-product';

const { navigate, selectTick } = vi.hoisted(() => ({
  navigate: vi.fn(),
  selectTick: vi.fn(),
}));

vi.mock('react-router', () => ({ useNavigate: () => navigate }));
vi.mock('../../../../application/hooks/useHaptic', () => ({ useHaptic: () => ({ selectTick }) }));

import RelatedProducts from './RelatedProducts';

const products: StorefrontRelatedProduct[] = [
  {
    id: 'p1',
    title: 'Кроссовки',
    imageUrl: 'a.jpg',
    price: 249000,
    originalPrice: 349000,
    available: true,
  },
  { id: 'p2', title: 'Кепка', imageUrl: null, price: 99000, originalPrice: null, available: false },
];

beforeEach(() => {
  navigate.mockReset();
  selectTick.mockReset();
});

describe('RelatedProducts', () => {
  it('рендерит карточки: название, цена, зачёркнутая и «нет в наличии»', () => {
    render(<RelatedProducts products={products} currencySymbol="$" />);

    expect(screen.getByTestId('related-products')).toBeInTheDocument();
    expect(screen.getByText('Кроссовки')).toBeInTheDocument();
    expect(screen.getByText('2490 $')).toBeInTheDocument();
    expect(screen.getByText('3490 $')).toBeInTheDocument();
    expect(screen.getByText('Кепка')).toBeInTheDocument();
    expect(screen.getByText('Нет в наличии')).toBeInTheDocument();
  });

  it('тап по карточке → переход в товар', async () => {
    render(<RelatedProducts products={products} currencySymbol="$" />);

    await userEvent.click(screen.getByRole('button', { name: /Кроссовки/ }));
    expect(navigate).toHaveBeenCalledWith('/product/p1');
  });
});
