// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from '@testing-library/react';
import type { ReactNode } from 'react';

const { createReview, hideReview, replyToReview, sessionRef } = vi.hoisted(() => ({
  createReview: vi.fn(),
  hideReview: vi.fn(),
  replyToReview: vi.fn(),
  sessionRef: { current: 'tok' as string | null },
}));

vi.mock('../composition/container', () => ({
  deps: () => ({ reviewApi: { createReview, hideReview, replyToReview } }),
}));

vi.mock('../store', () => ({
  useStore: (selector: (state: { sessionToken: string | null }) => unknown) =>
    selector({ sessionToken: sessionRef.current }),
}));

import { useReviewActions } from './useReviewActions';

let client: QueryClient;

beforeEach(() => {
  createReview.mockReset().mockResolvedValue(undefined);
  hideReview.mockReset().mockResolvedValue(undefined);
  replyToReview.mockReset().mockResolvedValue(undefined);
  sessionRef.current = 'tok';
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

describe('useReviewActions', () => {
  it('createReview вызывает api с токеном, товаром, оценкой и текстом + инвалидирует', async () => {
    const spy = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useReviewActions('pub1', 'p1'), { wrapper });

    await act(async () => {
      await result.current.createReview(5, 'Отлично');
    });

    expect(createReview).toHaveBeenCalledWith('tok', 'p1', 5, 'Отлично');
    expect(spy).toHaveBeenCalledWith({ queryKey: ['storefront-product-reviews', 'pub1', 'p1'] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['storefront-product', 'pub1', 'p1'] });
  });

  it('hideReview / replyToReview → api', async () => {
    const { result } = renderHook(() => useReviewActions('pub1', 'p1'), { wrapper });

    await act(async () => {
      await result.current.hideReview('r1');
      await result.current.replyToReview('r1', 'Согласен');
    });

    expect(hideReview).toHaveBeenCalledWith('tok', 'r1');
    expect(replyToReview).toHaveBeenCalledWith('tok', 'r1', 'Согласен');
  });

  it('без сессии → UNAUTHORIZED, api не вызывается', async () => {
    sessionRef.current = null;
    const { result } = renderHook(() => useReviewActions('pub1', 'p1'), { wrapper });

    await expect(result.current.createReview(5, 'x')).rejects.toThrow('UNAUTHORIZED');
    expect(createReview).not.toHaveBeenCalled();
  });

  it('ошибка api попадает в error', async () => {
    createReview.mockRejectedValue(new Error('ALREADY_REVIEWED'));
    const { result } = renderHook(() => useReviewActions('pub1', 'p1'), { wrapper });

    await expect(result.current.createReview(5, 'x')).rejects.toThrow('ALREADY_REVIEWED');
    await waitFor(() => expect(result.current.error).toBe('ALREADY_REVIEWED'));
  });
});
