// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';

const { useStorefrontHome, state } = vi.hoisted(() => ({
  useStorefrontHome: vi.fn(),
  state: {
    viewedStore: null as null | { publicId: string; supportHandle?: string },
    authLoading: false,
    storeId: undefined as string | undefined,
    favoritesByStore: {} as Record<string, string[]>,
    toggleFavorite: () => {},
  },
}));

vi.mock('../../../application/hooks/useStorefrontHome', () => ({ useStorefrontHome }));
vi.mock('../../../application/store', () => ({
  useStore: (selector: (s: typeof state) => unknown) => selector(state),
}));

import HomeView from './HomeView';
import type { StorefrontHome } from '../../../application/read-models/storefront';
import type { StorefrontHomeState } from '../../../application/hooks/useStorefrontHome';

const HOME: StorefrontHome = {
  store: {
    id: 's1',
    publicId: 'pub1',
    name: 'Nike Shop',
    bannerUrl: 'https://cdn/banner.jpg',
    sellerAvatarUrl: null,
    status: 'ACTIVE',
    currencyCode: 'USD',
    currencySymbol: '$',
  },
  categories: [],
  products: [],
};

function hookState(overrides: Partial<StorefrontHomeState> = {}): StorefrontHomeState {
  return {
    home: null,
    loading: false,
    error: null,
    notFound: false,
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
  state.viewedStore = { publicId: 'pub1', supportHandle: '' };
  state.authLoading = false;
});

describe('HomeView', () => {
  it('loading → skeleton', () => {
    useStorefrontHome.mockReturnValue(hookState({ loading: true }));
    const { container } = renderHome();
    expect(container.querySelector('.home-skel')).toBeTruthy();
  });

  it('authLoading → skeleton даже без loading хука', () => {
    state.authLoading = true;
    useStorefrontHome.mockReturnValue(hookState());
    const { container } = renderHome();
    expect(container.querySelector('.home-skel')).toBeTruthy();
  });

  it('notFound → «Магазин не найден»', () => {
    state.viewedStore = null;
    useStorefrontHome.mockReturnValue(hookState({ notFound: true }));
    renderHome();
    expect(screen.getByText('Магазин не найден')).toBeInTheDocument();
  });

  it('PAUSED → экран паузы с контактом', () => {
    state.viewedStore = { publicId: 'pub1', supportHandle: 'john' };
    useStorefrontHome.mockReturnValue(
      hookState({ home: { ...HOME, store: { ...HOME.store, status: 'PAUSED' } } }),
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
    useStorefrontHome.mockReturnValue(hookState({ home: HOME }));
    renderHome();
    expect(screen.getByRole('heading', { name: 'Nike Shop' })).toBeInTheDocument();
  });

  it('ACTIVE → рендерит единственный баннер магазина', () => {
    useStorefrontHome.mockReturnValue(hookState({ home: HOME }));
    renderHome();
    expect(screen.getByRole('img', { name: 'Nike Shop' })).toHaveAttribute(
      'src',
      'https://cdn/banner.jpg',
    );
  });

  it('ACTIVE → рендерит категории-чипы', () => {
    useStorefrontHome.mockReturnValue(
      hookState({
        home: {
          ...HOME,
          categories: [{ id: 'c1', name: 'Обувь', imageUrl: null, sortOrder: 0 }],
        },
      }),
    );
    renderHome();
    expect(screen.getByRole('button', { name: 'Обувь' })).toBeInTheDocument();
  });

  it('ACTIVE → рендерит карточки товаров', () => {
    useStorefrontHome.mockReturnValue(
      hookState({
        home: {
          ...HOME,
          products: [
            {
              id: 'p1',
              title: 'Nike T-Shirt',
              categoryId: null,
              imageUrl: null,
              price: 249000,
              originalPrice: null,
              available: true,
            },
          ],
        },
      }),
    );
    renderHome();
    expect(screen.getByRole('heading', { name: 'Товары' })).toBeInTheDocument();
    expect(screen.getByText('Nike T-Shirt')).toBeInTheDocument();
    expect(screen.getByText('2490 $')).toBeInTheDocument();
  });

  it('ошибка → «Повторить» вызывает refresh', async () => {
    const refresh = vi.fn();
    useStorefrontHome.mockReturnValue(hookState({ error: 'boom', refresh }));
    renderHome();

    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
