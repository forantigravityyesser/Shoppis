// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('./application/store', () => ({
  useStore: (selector: (state: { context: string; storeId: string | null }) => unknown) =>
    selector({ context: 'buyer', storeId: null }),
}));

vi.mock('./application/hooks/useHaptic', () => ({
  useHaptic: () => ({
    impactLight: vi.fn(),
    impactMedium: vi.fn(),
    notifySuccess: vi.fn(),
    selectTick: vi.fn(),
  }),
}));

vi.mock('./application/hooks/useStorefrontLink', () => ({
  useStorefrontLink: () => 'https://t.me/bot?startapp=shop_pub1',
}));

vi.mock('./application/hooks/useOpenTelegramLink', () => ({
  useOpenTelegramLink: () => vi.fn(),
}));

vi.mock('./application/hooks/useStorefrontProduct', () => ({
  useStorefrontProductReviews: () => ({
    summary: { average: 0, count: 0 },
    distribution: [5, 4, 3, 2, 1].map((rating) => ({ rating, count: 0 })),
    reviews: [],
    viewerReview: null,
    canReview: true,
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
  useStorefrontProductQuestions: () => ({
    questions: [],
    viewerQuestion: null,
    canAsk: true,
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
  useStorefrontProduct: () => ({
    detail: {
      store: {
        id: 's1',
        publicId: 'pub1',
        name: 'Nike',
        bannerUrl: null,
        status: 'ACTIVE',
        currencyCode: 'USD',
        currencySymbol: '$',
      },
      product: { id: 'p1', title: 'T-Shirt', description: '', categoryId: null },
      images: [],
      linkAttributes: [],
      attributes: [],
      variants: [],
      rating: { average: 0, count: 0 },
      questionsCount: 0,
      relatedProducts: [],
    },
    loading: false,
    error: null,
    notFound: false,
    refresh: vi.fn(),
  }),
}));

import AppRouter from './router';

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <AppRouter />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('buyer routing: Product Detail nested routes', () => {
  it('/product/:id → shell + вкладка «О товаре»', async () => {
    renderAt('/product/p1');
    expect(await screen.findByTestId('product-detail-shell')).toBeInTheDocument();
    expect(await screen.findByTestId('product-about')).toBeInTheDocument();
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
  });

  it('/product/:id/reviews → shell остаётся, рендерится слой отзывов', async () => {
    renderAt('/product/p1/reviews');
    expect(await screen.findByTestId('product-detail-shell')).toBeInTheDocument();
    expect(await screen.findByTestId('product-reviews')).toBeInTheDocument();
  });

  it('/product/:id/questions → shell остаётся, рендерится слой вопросов', async () => {
    renderAt('/product/p1/questions');
    expect(await screen.findByTestId('product-detail-shell')).toBeInTheDocument();
    expect(await screen.findByTestId('product-questions')).toBeInTheDocument();
  });

  it('/product/:id/related → вкладка «Похожее»', async () => {
    renderAt('/product/p1/related');
    expect(await screen.findByTestId('product-detail-shell')).toBeInTheDocument();
    expect(await screen.findByTestId('product-related')).toBeInTheDocument();
  });
});
