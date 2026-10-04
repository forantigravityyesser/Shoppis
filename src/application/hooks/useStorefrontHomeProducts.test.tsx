// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const { loadStorefrontHomeProducts } = vi.hoisted(() => ({ loadStorefrontHomeProducts: vi.fn() }));

vi.mock('../composition/container', () => ({
  deps: () => ({ storefrontRepository: { loadStorefrontHomeProducts } }),
}));

import { HOME_PRODUCTS_PAGE_SIZE, useStorefrontHomeProducts } from './useStorefrontHomeProducts';
import type { StorefrontProductCard } from '../read-models/storefront';

function card(id: string): StorefrontProductCard {
  return {
    id,
    title: `Товар ${id}`,
    categoryId: null,
    imageUrl: null,
    price: 100000,
    available: true,
  };
}

let client: QueryClient;

beforeEach(() => {
  loadStorefrontHomeProducts.mockReset();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

describe('useStorefrontHomeProducts', () => {
  it('без publicId не ходит в сеть', () => {
    const { result } = renderHook(() => useStorefrontHomeProducts(null), { wrapper });

    expect(result.current.loading).toBe(false);
    expect(result.current.products).toEqual([]);
    expect(result.current.nextCursor).toBeNull();
    expect(result.current.hasNextPage).toBe(false);
    expect(result.current.initialError).toBeNull();
    expect(result.current.nextPageError).toBeNull();
    expect(loadStorefrontHomeProducts).not.toHaveBeenCalled();
  });

  it('enabled=false → не ходит в сеть (PAUSED магазин)', () => {
    const { result } = renderHook(() => useStorefrontHomeProducts('pub1', 6, false), { wrapper });

    expect(result.current.loading).toBe(false);
    expect(result.current.products).toEqual([]);
    expect(result.current.hasNextPage).toBe(false);
    expect(result.current.initialError).toBeNull();
    expect(result.current.nextPageError).toBeNull();
    expect(loadStorefrontHomeProducts).not.toHaveBeenCalled();
  });

  it('грузит первую страницу (cursor=null, limit по умолчанию)', async () => {
    loadStorefrontHomeProducts.mockResolvedValue({ products: [card('p1')], nextCursor: 'c1' });

    const { result } = renderHook(() => useStorefrontHomeProducts('pub1'), { wrapper });
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.products.map((p) => p.id)).toEqual(['p1']);
    expect(result.current.nextCursor).toBe('c1');
    expect(result.current.hasNextPage).toBe(true);
    expect(loadStorefrontHomeProducts).toHaveBeenCalledWith('pub1', null, HOME_PRODUCTS_PAGE_SIZE);
  });

  it('loadMore добавляет следующую страницу; последняя → hasNextPage=false', async () => {
    loadStorefrontHomeProducts.mockImplementation((_id: string, cursor: string | null) => {
      if (cursor === null) return Promise.resolve({ products: [card('p1')], nextCursor: 'c1' });
      if (cursor === 'c1') return Promise.resolve({ products: [card('p2')], nextCursor: null });
      return Promise.resolve({ products: [], nextCursor: null });
    });

    const { result } = renderHook(() => useStorefrontHomeProducts('pub1'), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.products).toHaveLength(2));
    expect(result.current.products.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(result.current.nextCursor).toBeNull();
    expect(result.current.hasNextPage).toBe(false);
    expect(loadStorefrontHomeProducts).toHaveBeenCalledWith('pub1', 'c1', HOME_PRODUCTS_PAGE_SIZE);
  });

  it('loadMore без следующей страницы — no-op', async () => {
    loadStorefrontHomeProducts.mockResolvedValue({ products: [card('p1')], nextCursor: null });

    const { result } = renderHook(() => useStorefrontHomeProducts('pub1'), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.hasNextPage).toBe(false);
    expect(loadStorefrontHomeProducts).toHaveBeenCalledTimes(1);

    act(() => result.current.loadMore());
    await Promise.resolve();
    expect(loadStorefrontHomeProducts).toHaveBeenCalledTimes(1);
  });

  it('повторный loadMore во время догрузки — один запрос (нет дублей fetch)', async () => {
    let resolvePage2: (v: unknown) => void = () => {};
    loadStorefrontHomeProducts.mockImplementation((_id: string, cursor: string | null) => {
      if (cursor === null) return Promise.resolve({ products: [card('p1')], nextCursor: 'c1' });
      return new Promise((resolve) => {
        resolvePage2 = resolve;
      });
    });

    const { result } = renderHook(() => useStorefrontHomeProducts('pub1'), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.loadMore();
      result.current.loadMore();
    });

    const cursorCalls = () =>
      loadStorefrontHomeProducts.mock.calls.filter(([, c]) => c === 'c1').length;
    expect(cursorCalls()).toBe(1);

    await act(async () => {
      resolvePage2({ products: [card('p2')], nextCursor: null });
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.products).toHaveLength(2));
    expect(cursorCalls()).toBe(1);
  });

  it('дедуплицирует товары с повторяющимся id между страницами', async () => {
    loadStorefrontHomeProducts.mockImplementation((_id: string, cursor: string | null) => {
      if (cursor === null) return Promise.resolve({ products: [card('p1')], nextCursor: 'c1' });
      return Promise.resolve({ products: [card('p1'), card('p2')], nextCursor: null });
    });

    const { result } = renderHook(() => useStorefrontHomeProducts('pub1'), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.products).toHaveLength(2));
    expect(result.current.products.map((p) => p.id)).toEqual(['p1', 'p2']);
  });

  it('свой limit пробрасывается в запрос', async () => {
    loadStorefrontHomeProducts.mockResolvedValue({ products: [card('p1')], nextCursor: null });

    const { result } = renderHook(() => useStorefrontHomeProducts('pub1', 200), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(loadStorefrontHomeProducts).toHaveBeenCalledWith('pub1', null, 200);
  });

  it('ошибка первой загрузки → initialError (nextPageError пуст)', async () => {
    loadStorefrontHomeProducts.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useStorefrontHomeProducts('pub1'), { wrapper });

    await waitFor(() => expect(result.current.initialError).toBe('boom'));
    expect(result.current.nextPageError).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.products).toEqual([]);
  });

  it('ошибка догрузки → nextPageError, товары первой страницы сохранены', async () => {
    loadStorefrontHomeProducts.mockImplementation((_id: string, cursor: string | null) => {
      if (cursor === null) return Promise.resolve({ products: [card('p1')], nextCursor: 'c1' });
      return Promise.reject(new Error('page2 failed'));
    });

    const { result } = renderHook(() => useStorefrontHomeProducts('pub1'), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.nextPageError).toBe('page2 failed'));

    expect(result.current.initialError).toBeNull();
    expect(result.current.products.map((p) => p.id)).toEqual(['p1']);
    expect(result.current.hasNextPage).toBe(true);
    expect(result.current.fetchingNextPage).toBe(false);
  });

  it('повторная догрузка после сбоя использует тот же курсор', async () => {
    let page2Attempts = 0;
    loadStorefrontHomeProducts.mockImplementation((_id: string, cursor: string | null) => {
      if (cursor === null) return Promise.resolve({ products: [card('p1')], nextCursor: 'c1' });
      page2Attempts += 1;
      if (page2Attempts === 1) return Promise.reject(new Error('page2 failed'));
      return Promise.resolve({ products: [card('p2')], nextCursor: null });
    });

    const { result } = renderHook(() => useStorefrontHomeProducts('pub1'), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.nextPageError).toBe('page2 failed'));

    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.products).toHaveLength(2));

    expect(result.current.nextPageError).toBeNull();
    expect(result.current.products.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(loadStorefrontHomeProducts).toHaveBeenCalledWith('pub1', 'c1', HOME_PRODUCTS_PAGE_SIZE);
  });
});
