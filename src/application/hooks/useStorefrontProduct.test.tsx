// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const { loadProductDetail, loadProductReviews, loadProductQuestions } = vi.hoisted(() => ({
  loadProductDetail: vi.fn(),
  loadProductReviews: vi.fn(),
  loadProductQuestions: vi.fn(),
}));

vi.mock('../composition/container', () => ({
  deps: () => ({
    storefrontProductRepository: {
      loadProductDetail,
      loadProductReviews,
      loadProductQuestions,
    },
  }),
}));

import {
  useStorefrontProduct,
  useStorefrontProductQuestions,
  useStorefrontProductReviews,
} from './useStorefrontProduct';
import type { StorefrontProductDetail } from '../read-models/storefront-product';

const DETAIL: StorefrontProductDetail = {
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
};

let client: QueryClient;

beforeEach(() => {
  loadProductDetail.mockReset();
  loadProductReviews.mockReset();
  loadProductQuestions.mockReset();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

describe('useStorefrontProduct', () => {
  it('без publicId/productId не ходит в сеть и не loading/notFound', () => {
    const { result } = renderHook(() => useStorefrontProduct(null, 'p1'), { wrapper });
    expect(result.current.loading).toBe(false);
    expect(result.current.detail).toBeNull();
    expect(result.current.notFound).toBe(false);
    expect(result.current.error).toBeNull();
    expect(loadProductDetail).not.toHaveBeenCalled();

    const other = renderHook(() => useStorefrontProduct('pub1', null), { wrapper });
    expect(other.result.current.loading).toBe(false);
    expect(loadProductDetail).not.toHaveBeenCalled();
  });

  it('загружает товар и снимает loading', async () => {
    loadProductDetail.mockResolvedValue(DETAIL);

    const { result } = renderHook(() => useStorefrontProduct('pub1', 'p1'), { wrapper });
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.detail?.product.id).toBe('p1');
    expect(result.current.notFound).toBe(false);
    expect(loadProductDetail).toHaveBeenCalledWith('pub1', 'p1');
  });

  it('null-ответ → notFound', async () => {
    loadProductDetail.mockResolvedValue(null);

    const { result } = renderHook(() => useStorefrontProduct('pub1', 'missing'), { wrapper });

    await waitFor(() => expect(result.current.notFound).toBe(true));
    expect(result.current.detail).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('ошибка → error, без notFound', async () => {
    loadProductDetail.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useStorefrontProduct('pub1', 'p1'), { wrapper });

    await waitFor(() => expect(result.current.error).toBe('boom'));
    expect(result.current.notFound).toBe(false);
    expect(result.current.loading).toBe(false);
  });
});

describe('useStorefrontProductReviews', () => {
  it('enabled=false → без сети, дефолтная лента', () => {
    const { result } = renderHook(() => useStorefrontProductReviews('pub1', 'p1', false, null), {
      wrapper,
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.reviews).toEqual([]);
    expect(result.current.summary).toEqual({ average: 0, count: 0 });
    expect(result.current.distribution).toHaveLength(5);
    expect(result.current.canReview).toBe(true);
    expect(loadProductReviews).not.toHaveBeenCalled();
  });

  it('без publicId/productId → без сети даже при enabled=true', () => {
    renderHook(() => useStorefrontProductReviews(null, 'p1', true, null), { wrapper });
    expect(loadProductReviews).not.toHaveBeenCalled();
  });

  it('enabled=true загружает ленту и передаёт viewer id', async () => {
    loadProductReviews.mockResolvedValue({
      summary: { average: 4.7, count: 1 },
      distribution: [{ rating: 5, count: 1 }],
      viewerReview: { id: 'r1', rating: 5, text: 'Мой', createdAt: 't' },
      canReview: false,
      reviews: [
        { id: 'r1', authorName: 'Алексей', rating: 5, text: 'Ок', createdAt: 't', isOwn: true, replies: [] },
      ],
    });

    const { result } = renderHook(() => useStorefrontProductReviews('pub1', 'p1', true, 'u1'), {
      wrapper,
    });
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.reviews).toHaveLength(1);
    expect(result.current.summary).toEqual({ average: 4.7, count: 1 });
    expect(result.current.canReview).toBe(false);
    expect(result.current.viewerReview?.id).toBe('r1');
    expect(loadProductReviews).toHaveBeenCalledWith('pub1', 'p1', 'u1');
  });

  it('ошибка → error', async () => {
    loadProductReviews.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useStorefrontProductReviews('pub1', 'p1', true, null), {
      wrapper,
    });

    await waitFor(() => expect(result.current.error).toBe('boom'));
    expect(result.current.loading).toBe(false);
  });
});

describe('useStorefrontProductQuestions', () => {
  it('enabled=false → без сети, пустой список', () => {
    const { result } = renderHook(
      () => useStorefrontProductQuestions('pub1', 'p1', false, null),
      { wrapper },
    );
    expect(result.current.loading).toBe(false);
    expect(result.current.questions).toEqual([]);
    expect(result.current.canAsk).toBe(true);
    expect(loadProductQuestions).not.toHaveBeenCalled();
  });

  it('enabled=true загружает вопросы с viewer', async () => {
    loadProductQuestions.mockResolvedValue({
      canAsk: false,
      viewerQuestion: { id: 'q1', text: 'Когда?', createdAt: 't' },
      questions: [
        {
          id: 'q1',
          authorName: 'Мария',
          text: 'Когда?',
          createdAt: 't',
          isOwn: true,
          answer: null,
        },
      ],
    });

    const { result } = renderHook(
      () => useStorefrontProductQuestions('pub1', 'p1', true, 'u1'),
      { wrapper },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.questions).toHaveLength(1);
    expect(result.current.questions[0]?.answer).toBeNull();
    expect(result.current.canAsk).toBe(false);
    expect(result.current.viewerQuestion?.id).toBe('q1');
    expect(loadProductQuestions).toHaveBeenCalledWith('pub1', 'p1', 'u1');
  });

  it('ошибка → error', async () => {
    loadProductQuestions.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(
      () => useStorefrontProductQuestions('pub1', 'p1', true, null),
      { wrapper },
    );

    await waitFor(() => expect(result.current.error).toBe('boom'));
  });
});
