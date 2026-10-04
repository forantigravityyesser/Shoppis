// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router';
import type { StorefrontProductDetail } from '../../../../application/read-models/storefront-product';

vi.mock('../../../../application/hooks/useHaptic', () => ({
  useHaptic: () => ({ selectTick: vi.fn() }),
}));

import ProductRelated from './ProductRelated';

function makeDetail(overrides: Partial<StorefrontProductDetail> = {}): StorefrontProductDetail {
  return {
    store: {
      id: 's1',
      publicId: 'pub1',
      name: 'Nike',
      bannerUrl: null,
      status: 'ACTIVE',
      currencyCode: 'USD',
      currencySymbol: '$',
    },
    product: { id: 'p0', title: 'T', description: '', categoryId: null },
    images: [],
    linkAttributes: [],
    attributes: [],
    variants: [],
    rating: { average: 0, count: 0 },
    questionsCount: 0,
    relatedProducts: [],
    ...overrides,
  };
}

function renderRelated(detail: StorefrontProductDetail) {
  return render(
    <MemoryRouter>
      <Routes>
        <Route element={<Outlet context={detail} />}>
          <Route path="/" element={<ProductRelated />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProductRelated', () => {
  it('нет связей → пустое состояние', () => {
    renderRelated(makeDetail());
    expect(screen.getByTestId('product-related')).toBeInTheDocument();
    expect(screen.getByText('Пока нет похожих товаров')).toBeInTheDocument();
    expect(screen.queryByTestId('related-products')).toBeNull();
  });

  it('со связями → сетка мини-карточек', () => {
    renderRelated(
      makeDetail({
        relatedProducts: [
          {
            id: 'p1',
            title: 'Кроссовки',
            imageUrl: 'a.jpg',
            price: 249000,
            originalPrice: null,
            available: true,
          },
        ],
      }),
    );
    expect(screen.getByTestId('related-products')).toBeInTheDocument();
    expect(screen.getByText('Кроссовки')).toBeInTheDocument();
  });
});
