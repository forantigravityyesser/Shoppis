// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const { loadCatalogProducts } = vi.hoisted(() => ({ loadCatalogProducts: vi.fn() }));

vi.mock('../composition/container', () => ({
  deps: () => ({ storefrontCatalogRepository: { loadCatalogProducts } }),
}));

import {
  CATALOG_PRODUCTS_PAGE_SIZE,
  useStorefrontCatalog,
  type StorefrontCatalogFilters,
} from './useStorefrontCatalog';
import type { StorefrontProductCard } from '../read-models/storefront';
import type { StorefrontCatalogQuery } from '../read-models/storefront-catalog';

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
  loadCatalogProducts.mockReset();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

describe('useStorefrontCatalog', () => {
  it('без publicId не ходит в сеть', () => {
    const { result } = renderHook(() => useStorefrontCatalog(null), { wrapper });

    expect(result.current.loading).toBe(false);
    expect(result.current.products).toEqual([]);
    expect(result.current.nextCursor).toBeNull();
    expect(result.current.hasNextPage).toBe(false);
    expect(result.current.initialError).toBeNull();
    expect(result.current.nextPageError).toBeNull();
    expect(loadCatalogProducts).not.toHaveBeenCalled();
  });

  it('enabled=false → не ходит в сеть (PAUSED магазин)', () => {
    const { result } = renderHook(() => useStorefrontCatalog('pub1', {}, 12, false), { wrapper });

    expect(result.current.loading).toBe(false);
    expect(result.current.products).toEqual([]);
    expect(result.current.hasNextPage).toBe(false);
    expect(loadCatalogProducts).not.toHaveBeenCalled();
  });

  it('грузит первую страницу (cursor=null) и пробрасывает все фильтры', async () => {
    loadCatalogProducts.mockResolvedValue({ products: [card('p1')], nextCursor: 'c1' });

    const filters: StorefrontCatalogFilters = {
      categoryId: 'cat-a',
      search: 'nike',
      minPrice: 5000,
      maxPrice: 20000,
    };
    const { result } = renderHook(() => useStorefrontCatalog('pub1', filters), { wrapper });
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.products.map((p) => p.id)).toEqual(['p1']);
    expect(result.current.nextCursor).toBe('c1');
    expect(result.current.hasNextPage).toBe(true);
    expect(loadCatalogProducts).toHaveBeenCalledWith({
      publicId: 'pub1',
      limit: CATALOG_PRODUCTS_PAGE_SIZE,
      categoryId: 'cat-a',
      search: 'nike',
      minPrice: 5000,
      maxPrice: 20000,
      cursor: null,
    });
  });

  it('loadMore добавляет следующую страницу; последняя → hasNextPage=false', async () => {
    loadCatalogProducts.mockImplementation((q: StorefrontCatalogQuery) => {
      if (q.cursor === null) return Promise.resolve({ products: [card('p1')], nextCursor: 'c1' });
      if (q.cursor === 'c1') return Promise.resolve({ products: [card('p2')], nextCursor: null });
      return Promise.resolve({ products: [], nextCursor: null });
    });

    const { result } = renderHook(() => useStorefrontCatalog('pub1'), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.products).toHaveLength(2));
    expect(result.current.products.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(result.current.nextCursor).toBeNull();
    expect(result.current.hasNextPage).toBe(false);
    expect(loadCatalogProducts).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: 'c1' }));
  });

  it('loadMore без следующей страницы — no-op', async () => {
    loadCatalogProducts.mockResolvedValue({ products: [card('p1')], nextCursor: null });

    const { result } = renderHook(() => useStorefrontCatalog('pub1'), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.hasNextPage).toBe(false);
    expect(loadCatalogProducts).toHaveBeenCalledTimes(1);

    act(() => result.current.loadMore());
    await Promise.resolve();
    expect(loadCatalogProducts).toHaveBeenCalledTimes(1);
  });

  it('повторный loadMore во время догрузки — один запрос (нет дублей fetch)', async () => {
    let resolvePage2: (v: unknown) => void = () => {};
    loadCatalogProducts.mockImplementation((q: StorefrontCatalogQuery) => {
      if (q.cursor === null) return Promise.resolve({ products: [card('p1')], nextCursor: 'c1' });
      return new Promise((resolve) => {
        resolvePage2 = resolve;
      });
    });

    const { result } = renderHook(() => useStorefrontCatalog('pub1'), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.loadMore();
      result.current.loadMore();
    });

    const cursorCalls = () =>
      loadCatalogProducts.mock.calls.filter(([q]) => q.cursor === 'c1').length;
    expect(cursorCalls()).toBe(1);

    await act(async () => {
      resolvePage2({ products: [card('p2')], nextCursor: null });
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.products).toHaveLength(2));
    expect(cursorCalls()).toBe(1);
  });

  it('дедуплицирует товары с повторяющимся id между страницами', async () => {
    loadCatalogProducts.mockImplementation((q: StorefrontCatalogQuery) => {
      if (q.cursor === null) return Promise.resolve({ products: [card('p1')], nextCursor: 'c1' });
      return Promise.resolve({ products: [card('p1'), card('p2')], nextCursor: null });
    });

    const { result } = renderHook(() => useStorefrontCatalog('pub1'), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.products).toHaveLength(2));
    expect(result.current.products.map((p) => p.id)).toEqual(['p1', 'p2']);
  });

  it('смена фильтра сбрасывает курсор (новый запрос с cursor=null) и меняет товары', async () => {
    loadCatalogProducts.mockImplementation((q: StorefrontCatalogQuery) => {
      if (q.categoryId === 'cat-a')
        return Promise.resolve({ products: [card('a1')], nextCursor: 'a-next' });
      return Promise.resolve({ products: [card('all1')], nextCursor: 'all-next' });
    });

    const { result, rerender } = renderHook(
      (props: { filters: StorefrontCatalogFilters }) => useStorefrontCatalog('pub1', props.filters),
      { wrapper, initialProps: { filters: {} } },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.products.map((p) => p.id)).toEqual(['all1']);

    rerender({ filters: { categoryId: 'cat-a' } });
    await waitFor(() => expect(result.current.products.map((p) => p.id)).toEqual(['a1']));

    const catACalls = loadCatalogProducts.mock.calls
      .map(([q]) => q as StorefrontCatalogQuery)
      .filter((q) => q.categoryId === 'cat-a');
    const catACall = catACalls[catACalls.length - 1];
    expect(catACall?.cursor).toBeNull();
  });

  it('keepPreviousData: смена фильтра не уходит в loading и не сбрасывает товары', async () => {
    let resolveA: (v: unknown) => void = () => {};
    loadCatalogProducts.mockImplementation((q: StorefrontCatalogQuery) => {
      if (q.categoryId === 'cat-a') {
        return new Promise((resolve) => {
          resolveA = resolve;
        });
      }
      return Promise.resolve({ products: [card('all1')], nextCursor: null });
    });

    const { result, rerender } = renderHook(
      (props: { filters: StorefrontCatalogFilters }) => useStorefrontCatalog('pub1', props.filters),
      { wrapper, initialProps: { filters: {} } },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.products.map((p) => p.id)).toEqual(['all1']);

    rerender({ filters: { categoryId: 'cat-a' } });
    await waitFor(() => expect(loadCatalogProducts).toHaveBeenCalledTimes(2));

    // Пока новый набор грузится — предыдущие товары остаются, skeleton не включается,
    // но updating=true (stale-контент).
    expect(result.current.loading).toBe(false);
    expect(result.current.updating).toBe(true);
    expect(result.current.products.map((p) => p.id)).toEqual(['all1']);

    await act(async () => {
      resolveA({ products: [card('a1')], nextCursor: null });
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.products.map((p) => p.id)).toEqual(['a1']));
    expect(result.current.updating).toBe(false);
  });

  it('last-wins: ответ устаревшего фильтра не перетирает актуальный', async () => {
    let resolveA: (v: unknown) => void = () => {};
    loadCatalogProducts.mockImplementation((q: StorefrontCatalogQuery) => {
      if (q.categoryId === 'cat-a') {
        return new Promise((resolve) => {
          resolveA = resolve;
        });
      }
      if (q.categoryId === 'cat-b') {
        return Promise.resolve({ products: [card('b1')], nextCursor: null });
      }
      return Promise.resolve({ products: [card('all1')], nextCursor: null });
    });

    const { result, rerender } = renderHook(
      (props: { filters: StorefrontCatalogFilters }) => useStorefrontCatalog('pub1', props.filters),
      { wrapper, initialProps: { filters: {} } },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.products.map((p) => p.id)).toEqual(['all1']);

    // Быстро переключаем фильтры: A (медленный) → B (быстрый).
    rerender({ filters: { categoryId: 'cat-a' } });
    rerender({ filters: { categoryId: 'cat-b' } });
    await waitFor(() => expect(result.current.products.map((p) => p.id)).toEqual(['b1']));

    // Поздний ответ A не должен перетереть актуальный B.
    await act(async () => {
      resolveA({ products: [card('a1')], nextCursor: null });
      await Promise.resolve();
    });
    expect(result.current.products.map((p) => p.id)).toEqual(['b1']);
  });

  it('ошибка первой загрузки → initialError (nextPageError пуст)', async () => {
    loadCatalogProducts.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useStorefrontCatalog('pub1'), { wrapper });

    await waitFor(() => expect(result.current.initialError).toBe('boom'));
    expect(result.current.nextPageError).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.products).toEqual([]);
  });

  it('ошибка догрузки → nextPageError, товары первой страницы сохранены', async () => {
    loadCatalogProducts.mockImplementation((q: StorefrontCatalogQuery) => {
      if (q.cursor === null) return Promise.resolve({ products: [card('p1')], nextCursor: 'c1' });
      return Promise.reject(new Error('page2 failed'));
    });

    const { result } = renderHook(() => useStorefrontCatalog('pub1'), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.nextPageError).toBe('page2 failed'));

    expect(result.current.initialError).toBeNull();
    expect(result.current.products.map((p) => p.id)).toEqual(['p1']);
    expect(result.current.hasNextPage).toBe(true);
    expect(result.current.fetchingNextPage).toBe(false);
  });

  it('refresh повторяет первую страницу', async () => {
    loadCatalogProducts.mockResolvedValue({ products: [card('p1')], nextCursor: null });

    const { result } = renderHook(() => useStorefrontCatalog('pub1'), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(loadCatalogProducts).toHaveBeenCalledTimes(1);

    act(() => result.current.refresh());
    await waitFor(() => expect(loadCatalogProducts).toHaveBeenCalledTimes(2));
  });
});
