// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';

const { useStorefrontHome, useStorefrontHomeProducts, state } = vi.hoisted(() => ({
  useStorefrontHome: vi.fn(),
  useStorefrontHomeProducts: vi.fn(),
  state: {
    viewedStore: null as null | {
      publicId: string;
      supportHandle?: string;
      logoUrl?: string | null;
    },
    authLoading: false,
    storeId: undefined as string | undefined,
    serverUser: null as null | { photoUrl: string; firstName: string },
    favoritesByStore: {} as Record<string, string[]>,
    toggleFavorite: () => {},
  },
}));

vi.mock('../../../application/hooks/useStorefrontHome', () => ({ useStorefrontHome }));
vi.mock('../../../application/hooks/useStorefrontHomeProducts', () => ({
  useStorefrontHomeProducts,
}));
vi.mock('../../../application/store', () => ({
  useStore: (selector: (s: typeof state) => unknown) => selector(state),
}));

import HomeView from './HomeView';
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
    bannerUrl: 'https://cdn/banner.jpg',
    status: 'ACTIVE',
    currencyCode: 'USD',
    currencySymbol: '$',
  },
  categories: [],
};

const PRODUCT: StorefrontProductCard = {
  id: 'p1',
  title: 'Nike T-Shirt',
  categoryId: null,
  imageUrl: null,
  price: 249000,
  available: true,
};

function contextState(overrides: Partial<StorefrontHomeState> = {}): StorefrontHomeState {
  return {
    home: null,
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
    products: [],
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

function renderHome() {
  return render(
    <MemoryRouter>
      <HomeView />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useStorefrontHome.mockReset();
  useStorefrontHomeProducts.mockReset();
  state.viewedStore = { publicId: 'pub1', supportHandle: '' };
  state.authLoading = false;
  state.serverUser = null;
  useStorefrontHomeProducts.mockReturnValue(productsState());
});

describe('HomeView', () => {
  it('loading контекста → skeleton', () => {
    useStorefrontHome.mockReturnValue(contextState({ loading: true }));
    const { container } = renderHome();
    expect(container.querySelector('.home-skel')).toBeTruthy();
  });

  it('loading товарного потока → skeleton', () => {
    useStorefrontHome.mockReturnValue(contextState({ home: HOME }));
    useStorefrontHomeProducts.mockReturnValue(productsState({ loading: true }));
    const { container } = renderHome();
    expect(container.querySelector('.home-skel')).toBeTruthy();
  });

  it('authLoading → skeleton даже без loading хуков', () => {
    state.authLoading = true;
    useStorefrontHome.mockReturnValue(contextState());
    const { container } = renderHome();
    expect(container.querySelector('.home-skel')).toBeTruthy();
  });

  it('notFound → «Магазин не найден»', () => {
    state.viewedStore = null;
    useStorefrontHome.mockReturnValue(contextState({ notFound: true }));
    renderHome();
    expect(screen.getByText('Магазин не найден')).toBeInTheDocument();
  });

  it('PAUSED → экран паузы с контактом', () => {
    state.viewedStore = { publicId: 'pub1', supportHandle: 'john' };
    useStorefrontHome.mockReturnValue(
      contextState({ home: { ...HOME, store: { ...HOME.store, status: 'PAUSED' } } }),
    );
    renderHome();
    expect(screen.getByText('Магазин временно закрыт')).toBeInTheDocument();
    expect(screen.getByText('Nike Shop')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Связаться с продавцом' })).toHaveAttribute(
      'href',
      'https://t.me/john',
    );
  });

  it('ACTIVE → шапка с названием магазина', () => {
    useStorefrontHome.mockReturnValue(contextState({ home: HOME }));
    renderHome();
    expect(screen.getByRole('heading', { name: 'Nike Shop' })).toBeInTheDocument();
  });

  it('ACTIVE → рендерит единственный баннер магазина', () => {
    useStorefrontHome.mockReturnValue(contextState({ home: HOME }));
    renderHome();
    expect(screen.getByRole('img', { name: 'Nike Shop' })).toHaveAttribute(
      'src',
      'https://cdn/banner.jpg',
    );
  });

  it('ACTIVE → рендерит категории-чипы', () => {
    useStorefrontHome.mockReturnValue(
      contextState({
        home: { ...HOME, categories: [{ id: 'c1', name: 'Обувь', imageUrl: null, sortOrder: 0 }] },
      }),
    );
    renderHome();
    expect(screen.getByRole('button', { name: 'Обувь' })).toBeInTheDocument();
  });

  it('ACTIVE → рендерит карточки из товарного потока', () => {
    useStorefrontHome.mockReturnValue(contextState({ home: HOME }));
    useStorefrontHomeProducts.mockReturnValue(productsState({ products: [PRODUCT] }));
    renderHome();
    expect(screen.getByRole('heading', { name: 'Товары' })).toBeInTheDocument();
    expect(screen.getByText('Nike T-Shirt')).toBeInTheDocument();
    expect(screen.getByText('2490 $')).toBeInTheDocument();
  });

  it('товарный поток: sentinel догрузки рендерится при товарах', () => {
    useStorefrontHome.mockReturnValue(contextState({ home: HOME }));
    useStorefrontHomeProducts.mockReturnValue(
      productsState({ products: [PRODUCT], hasNextPage: true }),
    );
    renderHome();
    expect(screen.getByTestId('home-stream-sentinel')).toBeInTheDocument();
  });

  it('товарный поток: во время догрузки — индикатор, без sentinel-эффекта', () => {
    useStorefrontHome.mockReturnValue(contextState({ home: HOME }));
    useStorefrontHomeProducts.mockReturnValue(
      productsState({ products: [PRODUCT], hasNextPage: true, fetchingNextPage: true }),
    );
    renderHome();
    expect(screen.getByTestId('home-stream-loading')).toBeInTheDocument();
  });

  it('без товаров sentinel не рендерится', () => {
    useStorefrontHome.mockReturnValue(contextState({ home: HOME }));
    useStorefrontHomeProducts.mockReturnValue(productsState({ products: [] }));
    renderHome();
    expect(screen.queryByTestId('home-stream-sentinel')).toBeNull();
  });

  it('ошибка → «Повторить» вызывает refresh контекста и потока', async () => {
    const refresh = vi.fn();
    const refreshProducts = vi.fn();
    useStorefrontHome.mockReturnValue(contextState({ error: 'boom', refresh }));
    useStorefrontHomeProducts.mockReturnValue(productsState({ refresh: refreshProducts }));
    renderHome();

    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(refreshProducts).toHaveBeenCalledTimes(1);
  });
});
