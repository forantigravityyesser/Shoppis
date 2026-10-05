// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router';

const { useStorefrontHome, useStorefrontCatalog, useStorefrontCatalogPriceBounds } = vi.hoisted(
  () => ({
    useStorefrontHome: vi.fn(),
    useStorefrontCatalog: vi.fn(),
    useStorefrontCatalogPriceBounds: vi.fn(),
  }),
);

vi.mock('../../../application/store', () => ({
  useStore: (
    selector: (s: {
      viewedStore: unknown;
      serverUser: unknown;
      storeId: string | null;
      favoritesByStore: Record<string, string[]>;
      toggleFavorite: () => void;
    }) => unknown,
  ) =>
    selector({
      viewedStore: { publicId: 'pub1', supportHandle: '', logoUrl: null },
      serverUser: null,
      storeId: null,
      favoritesByStore: {},
      toggleFavorite: () => {},
    }),
}));
vi.mock('../../../application/hooks/useStorefrontHome', () => ({ useStorefrontHome }));
vi.mock('../../../application/hooks/useStorefrontCatalog', () => ({ useStorefrontCatalog }));
vi.mock('../../../application/hooks/useStorefrontCatalogPriceBounds', () => ({
  useStorefrontCatalogPriceBounds,
}));
vi.mock('../../../application/hooks/useHaptic', () => ({
  useHaptic: () => ({ selectTick: vi.fn() }),
}));

import CatalogView from './CatalogView';
import type {
  StorefrontHome,
  StorefrontProductCard,
} from '../../../application/read-models/storefront';

const HOME: StorefrontHome = {
  store: {
    id: 's1',
    publicId: 'pub1',
    name: 'Nike',
    bannerUrl: null,
    status: 'ACTIVE',
    currencyCode: 'USD',
    currencySymbol: '$',
  },
  categories: [{ id: 'c1', name: 'Обувь', imageUrl: null, sortOrder: 0 }],
};

const PRODUCTS: StorefrontProductCard[] = [
  { id: 'p1', title: 'Nike Air', categoryId: 'c1', imageUrl: null, price: 100000, available: true },
];

function ProductStub() {
  const navigate = useNavigate();
  return (
    <div>
      <span>product screen</span>
      <button type="button" onClick={() => navigate(-1)}>
        назад
      </button>
    </div>
  );
}

beforeEach(() => {
  useStorefrontHome.mockReset();
  useStorefrontCatalog.mockReset();
  useStorefrontCatalogPriceBounds.mockReset();
  useStorefrontHome.mockReturnValue({
    home: HOME,
    loading: false,
    error: null,
    notFound: false,
    refresh: vi.fn(),
  });
  useStorefrontCatalog.mockReturnValue({
    products: PRODUCTS,
    nextCursor: null,
    hasNextPage: false,
    loading: false,
    fetchingNextPage: false,
    initialError: null,
    nextPageError: null,
    loadMore: vi.fn(),
    refresh: vi.fn(),
  });
  useStorefrontCatalogPriceBounds.mockReturnValue({
    bounds: { minPrice: 8000, maxPrice: 320000 },
    loading: false,
    error: null,
    refresh: vi.fn(),
  });
});

describe('Catalog navigation: Back сохраняет query', () => {
  it('Catalog(category) → Product → Back возвращает каталог с прежним category', async () => {
    render(
      <MemoryRouter initialEntries={['/catalog?category=c1']}>
        <Routes>
          <Route path="/catalog" element={<CatalogView />} />
          <Route path="/product/:id" element={<ProductStub />} />
        </Routes>
      </MemoryRouter>,
    );

    // Каталог с активным фильтром категории (из URL).
    expect(screen.getByRole('button', { name: 'Убрать фильтр «Обувь»' })).toBeInTheDocument();

    // Открываем товар.
    await userEvent.click(screen.getByRole('button', { name: 'Nike Air' }));
    expect(screen.getByText('product screen')).toBeInTheDocument();

    // Back → каталог, фильтр категории сохранён.
    await userEvent.click(screen.getByRole('button', { name: 'назад' }));
    expect(screen.getByRole('button', { name: 'Убрать фильтр «Обувь»' })).toBeInTheDocument();
    expect(useStorefrontCatalog).toHaveBeenLastCalledWith(
      'pub1',
      {
        categoryId: 'c1',
        search: '',
        minPrice: null,
        maxPrice: null,
      },
      undefined,
      true,
    );
  });
});
