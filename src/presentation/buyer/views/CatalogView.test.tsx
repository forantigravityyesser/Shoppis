// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { useStorefrontHome, useStorefrontHomeProducts, navigate, searchParamsRef, state } =
  vi.hoisted(() => ({
    useStorefrontHome: vi.fn(),
    useStorefrontHomeProducts: vi.fn(),
    navigate: vi.fn(),
    searchParamsRef: { value: new URLSearchParams('') },
    state: {
      viewedStore: { publicId: 'pub1', supportHandle: '' } as { publicId: string } | null,
      authLoading: false,
      storeId: undefined as string | undefined,
      favoritesByStore: {} as Record<string, string[]>,
      toggleFavorite: () => {},
    },
  }));

vi.mock('react-router', () => ({
  useNavigate: () => navigate,
  useSearchParams: () => [searchParamsRef.value, vi.fn()],
}));
vi.mock('../../../application/store', () => ({
  useStore: (selector: (s: typeof state) => unknown) => selector(state),
}));
vi.mock('../../../application/hooks/useStorefrontHome', () => ({ useStorefrontHome }));
vi.mock('../../../application/hooks/useStorefrontHomeProducts', () => ({
  useStorefrontHomeProducts,
}));

import CatalogView from './CatalogView';
import type {
  StorefrontHome,
  StorefrontProductCard,
} from '../../../application/read-models/storefront';
import type { StorefrontHomeState } from '../../../application/hooks/useStorefrontHome';
import type { StorefrontHomeProductsState } from '../../../application/hooks/useStorefrontHomeProducts';

const HOME: StorefrontHome = {
  store: {
    id: 's1',
    publicId: 'pub1',
    name: 'Nike Shop',
    bannerUrl: null,
    status: 'ACTIVE',
    currencyCode: 'USD',
    currencySymbol: '$',
  },
  categories: [
    { id: 'c1', name: 'Обувь', imageUrl: null, sortOrder: 0 },
    { id: 'c2', name: 'Одежда', imageUrl: null, sortOrder: 1 },
  ],
};

const PRODUCTS: StorefrontProductCard[] = [
  {
    id: 'p1',
    title: 'Nike Air',
    categoryId: 'c1',
    imageUrl: null,
    price: 100000,
    available: true,
  },
  {
    id: 'p2',
    title: 'Polo Shirt',
    categoryId: 'c2',
    imageUrl: null,
    price: 250000,
    available: true,
  },
];

function contextState(overrides: Partial<StorefrontHomeState> = {}): StorefrontHomeState {
  return {
    home: HOME,
    loading: false,
    error: null,
    notFound: false,
    refresh: vi.fn(),
    ...overrides,
  };
}

function productsState(
  overrides: Partial<StorefrontHomeProductsState> = {},
): StorefrontHomeProductsState {
  return {
    products: PRODUCTS,
    nextCursor: null,
    hasNextPage: false,
    loading: false,
    fetchingNextPage: false,
    error: null,
    loadMore: vi.fn(),
    refresh: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  useStorefrontHome.mockReset();
  useStorefrontHomeProducts.mockReset();
  navigate.mockReset();
  searchParamsRef.value = new URLSearchParams('');
  state.viewedStore = { publicId: 'pub1' };
  useStorefrontHomeProducts.mockReturnValue(productsState());
});

describe('CatalogView', () => {
  it('loading контекста → skeleton', () => {
    useStorefrontHome.mockReturnValue(contextState({ home: null, loading: true }));
    const { container } = render(<CatalogView />);
    expect(container.querySelector('.skel--card')).toBeTruthy();
    expect(screen.queryByLabelText('Поиск по названию')).toBeNull();
  });

  it('loading товарного потока → skeleton', () => {
    useStorefrontHome.mockReturnValue(contextState());
    useStorefrontHomeProducts.mockReturnValue(productsState({ loading: true }));
    const { container } = render(<CatalogView />);
    expect(container.querySelector('.skel--card')).toBeTruthy();
  });

  it('рендерит товары и чипы категорий', () => {
    useStorefrontHome.mockReturnValue(contextState());
    render(<CatalogView />);
    expect(screen.getByText('Nike Air')).toBeInTheDocument();
    expect(screen.getByText('Polo Shirt')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Все' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Обувь' })).toBeInTheDocument();
  });

  it('поиск фильтрует по названию', async () => {
    useStorefrontHome.mockReturnValue(contextState());
    render(<CatalogView />);

    await userEvent.type(screen.getByLabelText('Поиск по названию'), 'polo');
    expect(screen.getByText('Polo Shirt')).toBeInTheDocument();
    expect(screen.queryByText('Nike Air')).toBeNull();
  });

  it('чип категории фильтрует товары', async () => {
    useStorefrontHome.mockReturnValue(contextState());
    render(<CatalogView />);

    await userEvent.click(screen.getByRole('button', { name: 'Обувь' }));
    expect(screen.getByText('Nike Air')).toBeInTheDocument();
    expect(screen.queryByText('Polo Shirt')).toBeNull();
  });

  it('PAUSED → экран паузы без каталога и поиска', () => {
    useStorefrontHome.mockReturnValue(
      contextState({ home: { ...HOME, store: { ...HOME.store, status: 'PAUSED' } } }),
    );
    render(<CatalogView />);
    expect(screen.getByText('Магазин временно закрыт')).toBeInTheDocument();
    expect(screen.getByText('Nike Shop')).toBeInTheDocument();
    expect(screen.queryByLabelText('Поиск по названию')).toBeNull();
    expect(screen.queryByText('Nike Air')).toBeNull();
  });

  it('пустой результат → «Ничего не найдено»', async () => {
    useStorefrontHome.mockReturnValue(contextState());
    render(<CatalogView />);

    await userEvent.type(screen.getByLabelText('Поиск по названию'), 'zzz');
    expect(screen.getByText('Ничего не найдено')).toBeInTheDocument();
  });
});
