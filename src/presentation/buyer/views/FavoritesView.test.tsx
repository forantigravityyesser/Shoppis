// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';

const { useStorefrontHome, useStorefrontFavoriteProducts, useFavorites, state } = vi.hoisted(
  () => ({
    useStorefrontHome: vi.fn(),
    useStorefrontFavoriteProducts: vi.fn(),
    useFavorites: vi.fn(),
    state: {
      viewedStore: null as null | {
        publicId: string;
        supportHandle?: string;
        logoUrl?: string | null;
      },
      serverUser: null as null | { photoUrl: string; firstName: string },
    },
  }),
);

vi.mock('../../../application/hooks/useStorefrontHome', () => ({ useStorefrontHome }));
vi.mock('../../../application/hooks/useStorefrontFavoriteProducts', () => ({
  useStorefrontFavoriteProducts,
}));
vi.mock('../../../application/hooks/useFavorites', () => ({ useFavorites }));
vi.mock('../../../application/hooks/useHaptic', () => ({
  useHaptic: () => ({ selectTick: vi.fn() }),
}));
vi.mock('../../../application/store', () => ({
  useStore: (selector: (s: typeof state) => unknown) => selector(state),
}));

import FavoritesView from './FavoritesView';
import type { StorefrontHome, StorefrontProductCard } from '../../../application/read-models/storefront';
import type { StorefrontHomeState } from '../../../application/hooks/useStorefrontHome';
import type { StorefrontFavoriteProductsState } from '../../../application/hooks/useStorefrontFavoriteProducts';

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

function favoritesState(
  overrides: Partial<StorefrontFavoriteProductsState> = {},
): StorefrontFavoriteProductsState {
  return {
    products: [],
    loading: false,
    error: null,
    refresh: vi.fn(),
    ...overrides,
  };
}

function renderFavorites() {
  return render(
    <MemoryRouter>
      <FavoritesView />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useStorefrontHome.mockReset();
  useStorefrontFavoriteProducts.mockReset();
  useFavorites.mockReset();
  state.viewedStore = { publicId: 'pub1', supportHandle: '' };
  state.serverUser = null;
  useFavorites.mockReturnValue({
    ids: ['p1'],
    count: 1,
    isFavorite: (id: string) => id === 'p1',
    toggleFavorite: vi.fn(),
  });
  useStorefrontFavoriteProducts.mockReturnValue(favoritesState());
});

describe('FavoritesView', () => {
  it('loading контекста → skeleton', () => {
    useStorefrontHome.mockReturnValue(contextState({ loading: true }));
    const { container } = renderFavorites();
    expect(container.querySelector('.skel--card')).toBeTruthy();
  });

  it('loading карточек избранного → skeleton', () => {
    useStorefrontHome.mockReturnValue(contextState({ home: HOME }));
    useStorefrontFavoriteProducts.mockReturnValue(favoritesState({ loading: true }));
    const { container } = renderFavorites();
    expect(container.querySelector('.skel--card')).toBeTruthy();
  });

  it('ошибка контекста → экран ошибки с повтором', async () => {
    const refresh = vi.fn();
    useStorefrontHome.mockReturnValue(contextState({ error: 'boom', refresh }));
    renderFavorites();

    expect(screen.getByText('Не удалось загрузить избранное')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('notFound → «Магазин не найден»', () => {
    state.viewedStore = null;
    useStorefrontHome.mockReturnValue(contextState({ notFound: true }));
    renderFavorites();
    expect(screen.getByText('Магазин не найден')).toBeInTheDocument();
  });

  it('PAUSED → экран паузы, hydration избранного выключен', () => {
    useStorefrontHome.mockReturnValue(
      contextState({ home: { ...HOME, store: { ...HOME.store, status: 'PAUSED' } } }),
    );
    renderFavorites();
    expect(screen.getByText('Магазин временно закрыт')).toBeInTheDocument();
    expect(useStorefrontFavoriteProducts).toHaveBeenCalledWith('pub1', ['p1'], false);
  });

  it('ACTIVE → шапка «Избранное» и карточки с активным сердцем', () => {
    useStorefrontHome.mockReturnValue(contextState({ home: HOME }));
    useStorefrontFavoriteProducts.mockReturnValue(favoritesState({ products: [PRODUCT] }));
    renderFavorites();

    expect(screen.getByRole('heading', { name: 'Избранное' })).toBeInTheDocument();
    expect(screen.getByText('Nike T-Shirt')).toBeInTheDocument();
    expect(screen.getByText('2490 $')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Убрать из избранного' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(useStorefrontFavoriteProducts).toHaveBeenCalledWith('pub1', ['p1'], true);
  });

  it('пустое избранное → подсказка', () => {
    useStorefrontHome.mockReturnValue(contextState({ home: HOME }));
    renderFavorites();
    expect(screen.getByText('В избранном пока пусто')).toBeInTheDocument();
  });

  it('ошибка загрузки карточек → локальный экран ошибки с повтором', async () => {
    const refresh = vi.fn();
    useStorefrontHome.mockReturnValue(contextState({ home: HOME }));
    useStorefrontFavoriteProducts.mockReturnValue(favoritesState({ error: 'boom', refresh }));
    renderFavorites();

    expect(screen.getByTestId('favorites-error')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
