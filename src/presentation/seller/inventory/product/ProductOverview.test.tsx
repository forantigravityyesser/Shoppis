// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';

const { productRef } = vi.hoisted(() => ({
  productRef: { current: {} as Record<string, unknown> },
}));

vi.mock('../../../../application/hooks/useProduct', () => ({
  useProductDetail: () => ({ product: productRef.current, loading: false }),
}));

vi.mock('../../../../application/hooks/useInventoryActions', () => ({
  useInventoryActions: () => ({ setProductStatus: vi.fn(), deleteProduct: vi.fn() }),
}));

vi.mock('../../../../application/store', () => ({
  useStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ updateVariantStock: vi.fn() }),
}));

import ProductOverview from './ProductOverview';

const PRODUCT = {
  id: 'p1',
  title: 'Морковь',
  description: '',
  status: 'ACTIVE',
  categoryName: 'Овощи',
  images: [],
  emoji: '🥕',
  originalAmountMinor: 10000,
  discountPercent: 0,
  priceMinor: 10000,
  currency: 'RUB',
  attributes: [],
  variants: [],
  stockAvailable: 0,
  stockHeld: 0,
  stockState: 'out_of_stock',
  rating: 0,
  reviewsCount: 0,
  questionsCount: 0,
};

describe('seller ProductOverview', () => {
  it('не содержит кнопок/ссылок отзывов и вопросов — только навигация', () => {
    productRef.current = { ...PRODUCT };
    const { container } = render(
      <MemoryRouter initialEntries={['/seller/inventory/product/p1']}>
        <Routes>
          <Route path="/seller/inventory/product/:productId" element={<ProductOverview />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(container.querySelector('.prod-signals')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('Контроль остатков')).toBeInTheDocument();
  });
});
