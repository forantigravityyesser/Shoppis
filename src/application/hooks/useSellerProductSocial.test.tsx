// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const { loadProductReviews, loadProductQuestions, sessionRef } = vi.hoisted(() => ({
  loadProductReviews: vi.fn(),
  loadProductQuestions: vi.fn(),
  sessionRef: { current: 'tok' as string | null },
}));

vi.mock('../composition/container', () => ({
  deps: () => ({ sellerProductSocialRepository: { loadProductReviews, loadProductQuestions } }),
}));

vi.mock('../store', () => ({
  useStore: (selector: (state: { sessionToken: string | null }) => unknown) =>
    selector({ sessionToken: sessionRef.current }),
}));

import { useSellerProductQuestions, useSellerProductReviews } from './useSellerProductSocial';

let client: QueryClient;

beforeEach(() => {
  loadProductReviews.mockReset();
  loadProductQuestions.mockReset();
  sessionRef.current = 'tok';
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

describe('useSellerProductReviews', () => {
  it('грузит через seller-репозиторий с токеном и productId', async () => {
    loadProductReviews.mockResolvedValue({
      reviews: [],
      summary: { average: 0, count: 0 },
      distribution: [5, 4, 3, 2, 1].map((rating) => ({ rating, count: 0 })),
    });

    const { result } = renderHook(() => useSellerProductReviews('p1'), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(loadProductReviews).toHaveBeenCalledWith('p1', 'tok');
  });

  it('без сессии → запрос отключён, api не вызывается', () => {
    sessionRef.current = null;
    const { result } = renderHook(() => useSellerProductReviews('p1'), { wrapper });
    expect(result.current.loading).toBe(false);
    expect(loadProductReviews).not.toHaveBeenCalled();
  });

  it('ошибка → error', async () => {
    loadProductReviews.mockRejectedValue(new Error('FORBIDDEN'));
    const { result } = renderHook(() => useSellerProductReviews('p1'), { wrapper });
    await waitFor(() => expect(result.current.error).toBe('FORBIDDEN'));
  });
});

describe('useSellerProductQuestions', () => {
  it('грузит через seller-репозиторий', async () => {
    loadProductQuestions.mockResolvedValue({ questions: [] });
    const { result } = renderHook(() => useSellerProductQuestions('p1'), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(loadProductQuestions).toHaveBeenCalledWith('p1', 'tok');
  });
});
