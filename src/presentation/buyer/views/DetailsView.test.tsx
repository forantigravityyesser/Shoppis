// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import type { StorefrontProductDetail } from '../../../application/read-models/storefront-product';

const {
  productState,
  refresh,
  openLink,
  showToast,
  toggleFavorite,
  addToCart,
  selectTick,
  notifySuccess,
  favoriteRef,
} = vi.hoisted(() => ({
  productState: { current: {} as Record<string, unknown> },
  refresh: vi.fn(),
  openLink: vi.fn(),
  showToast: vi.fn(),
  toggleFavorite: vi.fn(),
  addToCart: vi.fn(),
  selectTick: vi.fn(),
  notifySuccess: vi.fn(),
  favoriteRef: { current: false },
}));

vi.mock('../../../application/store', () => ({
  useStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      viewedStore: { publicId: 'pub1', supportHandle: 'support' },
      authLoading: false,
      showToast,
    }),
}));

vi.mock('../../../application/hooks/useStorefrontProduct', () => ({
  useStorefrontProduct: () => productState.current,
}));

vi.mock('../../../application/hooks/useStorefrontLink', () => ({
  useStorefrontLink: () => 'https://t.me/bot?startapp=shop_pub1',
}));

vi.mock('../../../application/hooks/useOpenTelegramLink', () => ({
  useOpenTelegramLink: () => openLink,
}));

vi.mock('../../../application/hooks/useHaptic', () => ({
  useHaptic: () => ({ impactLight: vi.fn(), impactMedium: vi.fn(), notifySuccess, selectTick }),
}));

vi.mock('../../../application/hooks/useFavorites', () => ({
  useFavorites: () => ({ isFavorite: () => favoriteRef.current, toggleFavorite }),
}));

vi.mock('../../../application/hooks/useCart', () => ({
  useCart: () => ({ addToCart }),
}));

import DetailsView from './DetailsView';

const store = {
  id: 's1',
  publicId: 'pub1',
  name: 'Nike',
  bannerUrl: null,
  status: 'ACTIVE' as const,
  currencyCode: 'USD' as const,
  currencySymbol: '$',
};

const DETAIL: StorefrontProductDetail = {
  store,
  product: { id: 'p1', title: 'Nike T-Shirt', description: 'Soft', categoryId: null },
  images: [
    { url: 'https://cdn/full1.jpg', thumbUrl: 'https://cdn/t1.jpg', sortOrder: 0 },
    { url: 'https://cdn/full2.jpg', thumbUrl: null, sortOrder: 1 },
  ],
  linkAttributes: [{ name: 'Color', value: 'White' }],
  attributes: [{ name: 'Материал', value: 'Хлопок' }],
  variants: [
    {
      id: 'v1',
      name: 'Размер',
      value: 'S',
      price: 249000,
      originalPrice: 349000,
      availableQuantity: 5,
      available: true,
    },
    {
      id: 'v2',
      name: 'Размер',
      value: 'M',
      price: 279000,
      originalPrice: null,
      availableQuantity: 0,
      available: false,
    },
  ],
  rating: { average: 4, count: 12 },
  questionsCount: 3,
  relatedProducts: [],
};

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={['/product/p1']}>
      <Routes>
        <Route path="/product/:id" element={<DetailsView />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  refresh.mockReset();
  openLink.mockReset();
  showToast.mockReset();
  toggleFavorite.mockReset();
  addToCart.mockReset();
  selectTick.mockReset();
  notifySuccess.mockReset();
  favoriteRef.current = false;
  productState.current = {
    detail: null,
    loading: false,
    error: null,
    notFound: false,
    refresh,
  };
});

describe('DetailsView shell', () => {
  it('loading → skeleton', () => {
    productState.current = { detail: null, loading: true, error: null, notFound: false, refresh };
    renderDetail();
    expect(screen.getByTestId('product-detail-skeleton')).toBeInTheDocument();
  });

  it('не найден → «Товар не найден»', () => {
    productState.current = { detail: null, loading: false, error: null, notFound: true, refresh };
    renderDetail();
    expect(screen.getByText('Товар не найден')).toBeInTheDocument();
  });

  it('ошибка → сообщение и повтор', async () => {
    productState.current = {
      detail: null,
      loading: false,
      error: 'boom',
      notFound: false,
      refresh,
    };
    renderDetail();
    expect(screen.getByText('Не удалось загрузить товар')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('PAUSED магазин → экран паузы', () => {
    productState.current = {
      detail: { ...DETAIL, store: { ...store, status: 'PAUSED' } },
      loading: false,
      error: null,
      notFound: false,
      refresh,
    };
    renderDetail();
    expect(screen.getByText('Магазин временно закрыт')).toBeInTheDocument();
  });

  it('загруженный товар → каркас: заголовок, рейтинг, цена, варианты, CTA', () => {
    productState.current = {
      detail: DETAIL,
      loading: false,
      error: null,
      notFound: false,
      refresh,
    };
    renderDetail();

    expect(screen.getByTestId('product-detail-shell')).toBeInTheDocument();
    expect(screen.getByTestId('product-gallery')).toBeInTheDocument();
    expect(screen.getByText('Nike T-Shirt')).toBeInTheDocument();
    expect(screen.getByTestId('product-rating')).toHaveTextContent('4.0 (12)');
    // Effective price первого доступного варианта (S) + зачёркнутая original (в CTA).
    expect(screen.getByText('2490 $')).toBeInTheDocument();
    expect(screen.getByText('3490 $')).toBeInTheDocument();

    const variants = screen.getByTestId('product-variants');
    expect(variants).toHaveTextContent('S');
    expect(variants).toHaveTextContent('M');

    // 4 вкладки под эскиз.
    for (const label of ['О товаре', 'Отзывы', 'Вопросы', 'Похожее']) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument();
    }

    // Linking-атрибуты у названия.
    expect(screen.getByTestId('product-link-attrs')).toHaveTextContent('Color: White');

    const addButton = screen.getByRole('button', { name: 'Добавить в корзину' });
    expect(addButton).toBeEnabled();
  });

  it('вложенный раздел (Отзывы) → CTA скрыт', () => {
    productState.current = {
      detail: DETAIL,
      loading: false,
      error: null,
      notFound: false,
      refresh,
    };
    render(
      <MemoryRouter initialEntries={['/product/p1/reviews']}>
        <Routes>
          <Route path="/product/:id" element={<DetailsView />}>
            <Route path="reviews" element={<div>reviews-child</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('reviews-child')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Добавить в корзину' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'В избранное' })).toBeNull();
  });

  it('trailing slash: /product/p1/ → CTA показан (как /product/p1)', () => {
    productState.current = { detail: DETAIL, loading: false, error: null, notFound: false, refresh };
    render(
      <MemoryRouter initialEntries={['/product/p1/']}>
        <Routes>
          <Route path="/product/:id" element={<DetailsView />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: 'Добавить в корзину' })).toBeInTheDocument();
  });

  it('trailing slash: /product/p1/reviews/ → слой показан, CTA скрыт', () => {
    productState.current = { detail: DETAIL, loading: false, error: null, notFound: false, refresh };
    render(
      <MemoryRouter initialEntries={['/product/p1/reviews/']}>
        <Routes>
          <Route path="/product/:id" element={<DetailsView />}>
            <Route path="reviews" element={<div>reviews-child</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('reviews-child')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Добавить в корзину' })).toBeNull();
  });

  it('без отзывов рейтинг всё равно показан (0)', () => {
    productState.current = {
      detail: { ...DETAIL, rating: { average: 0, count: 0 } },
      loading: false,
      error: null,
      notFound: false,
      refresh,
    };
    renderDetail();
    expect(screen.getByTestId('product-rating')).toHaveTextContent('0');
  });

  it('выбор доступного варианта меняет цену в CTA; sold-out недоступен', async () => {
    const withTwoAvailable: StorefrontProductDetail = {
      ...DETAIL,
      variants: [
        {
          id: 'vS',
          name: 'Размер',
          value: 'S',
          price: 249000,
          originalPrice: null,
          availableQuantity: 5,
          available: true,
        },
        {
          id: 'vL',
          name: 'Размер',
          value: 'L',
          price: 279000,
          originalPrice: null,
          availableQuantity: 3,
          available: true,
        },
        {
          id: 'vM',
          name: 'Размер',
          value: 'M',
          price: 299000,
          originalPrice: null,
          availableQuantity: 0,
          available: false,
        },
      ],
    };
    productState.current = {
      detail: withTwoAvailable,
      loading: false,
      error: null,
      notFound: false,
      refresh,
    };
    renderDetail();

    // По умолчанию — первый доступный (S).
    expect(screen.getByText('2490 $')).toBeInTheDocument();

    // Sold-out M недоступен (disabled).
    expect(screen.getByRole('button', { name: 'M' })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'L' }));
    expect(screen.getByText('2790 $')).toBeInTheDocument();
    expect(screen.queryByText('2490 $')).toBeNull();
  });

  it('все варианты распроданы → CTA «Нет в наличии»', () => {
    const soldOutDetail: StorefrontProductDetail = {
      ...DETAIL,
      variants: DETAIL.variants.map((v) => ({ ...v, available: false, availableQuantity: 0 })),
    };
    productState.current = {
      detail: soldOutDetail,
      loading: false,
      error: null,
      notFound: false,
      refresh,
    };
    renderDetail();
    expect(screen.getByRole('button', { name: 'Нет в наличии' })).toBeDisabled();
  });

  it('избранное: клик переключает + haptic', async () => {
    productState.current = {
      detail: DETAIL,
      loading: false,
      error: null,
      notFound: false,
      refresh,
    };
    renderDetail();

    await userEvent.click(screen.getByRole('button', { name: 'В избранное' }));
    expect(toggleFavorite).toHaveBeenCalledWith('p1');
    expect(selectTick).toHaveBeenCalledTimes(1);
  });

  it('избранное: активное состояние отражено', () => {
    favoriteRef.current = true;
    productState.current = {
      detail: DETAIL,
      loading: false,
      error: null,
      notFound: false,
      refresh,
    };
    renderDetail();

    const fav = screen.getByRole('button', { name: 'Убрать из избранного' });
    expect(fav).toHaveAttribute('aria-pressed', 'true');
  });

  it('добавление в корзину: передаёт productId/variant/price, toast + haptic-success', async () => {
    productState.current = {
      detail: DETAIL,
      loading: false,
      error: null,
      notFound: false,
      refresh,
    };
    renderDetail();

    await userEvent.click(screen.getByRole('button', { name: 'Добавить в корзину' }));

    expect(addToCart).toHaveBeenCalledWith({
      productId: 'p1',
      productVariantId: 'v1',
      quantity: 1,
      price: 249000,
    });
    expect(notifySuccess).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith({
      text: 'Добавлено в корзину',
      imageUrl: 'https://cdn/t1.jpg',
    });
  });
});
