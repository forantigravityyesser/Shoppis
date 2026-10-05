// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const { loadProductsByIds } = vi.hoisted(() => ({ loadProductsByIds: vi.fn() }));

vi.mock('../composition/container', () => ({
  deps: () => ({ storefrontCatalogRepository: { loadProductsByIds } }),
}));

import { useStorefrontFavoriteProducts } from './useStorefrontFavoriteProducts';
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
  loadProductsByIds.mockReset();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

describe('useStorefrontFavoriteProducts', () => {
  it('без publicId не ходит в сеть', () => {
    const { result } = renderHook(() => useStorefrontFavoriteProducts(null, ['p1']), { wrapper });

    expect(result.current.loading).toBe(false);
    expect(result.current.products).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(loadProductsByIds).not.toHaveBeenCalled();
  });

  it('пустой ids не ходит в сеть', () => {
    const { result } = renderHook(() => useStorefrontFavoriteProducts('pub1', []), { wrapper });

    expect(result.current.loading).toBe(false);
    expect(result.current.products).toEqual([]);
    expect(loadProductsByIds).not.toHaveBeenCalled();
  });

  it('enabled=false не ходит в сеть (PAUSED магазин)', () => {
    const { result } = renderHook(() => useStorefrontFavoriteProducts('pub1', ['p1'], false), {
      wrapper,
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.products).toEqual([]);
    expect(loadProductsByIds).not.toHaveBeenCalled();
  });

  it('грузит карточки в порядке ids и отбрасывает id, которых нет в ответе', async () => {
    // Сервер отдаёт в другом порядке и без p3 (архив).
    loadProductsByIds.mockResolvedValue([card('p2'), card('p1')]);

    const { result } = renderHook(() => useStorefrontFavoriteProducts('pub1', ['p1', 'p3', 'p2']), {
      wrapper,
    });
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.products.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(loadProductsByIds).toHaveBeenCalledWith('pub1', ['p1', 'p3', 'p2']);
  });

  it('снятие из избранного убирает товар сразу, до ответа сети (keepPreviousData)', async () => {
    let resolveSecond: (value: StorefrontProductCard[]) => void = () => {};
    loadProductsByIds
      .mockImplementationOnce(() => Promise.resolve([card('p1'), card('p2')]))
      .mockImplementationOnce(
        () =>
          new Promise<StorefrontProductCard[]>((resolve) => {
            resolveSecond = resolve;
          }),
      );

    const { result, rerender } = renderHook(
      (props: { ids: string[] }) => useStorefrontFavoriteProducts('pub1', props.ids),
      { wrapper, initialProps: { ids: ['p1', 'p2'] } },
    );
    await waitFor(() => expect(result.current.products.map((p) => p.id)).toEqual(['p1', 'p2']));

    rerender({ ids: ['p1'] });
    // Новый запрос ещё не завершён, но снятый p2 исчезает немедленно.
    expect(result.current.products.map((p) => p.id)).toEqual(['p1']);
    expect(result.current.loading).toBe(false);

    await act(async () => {
      resolveSecond([card('p1')]);
      await Promise.resolve();
    });
    expect(result.current.products.map((p) => p.id)).toEqual(['p1']);
  });

  it('ошибка загрузки → error, товаров нет', async () => {
    loadProductsByIds.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useStorefrontFavoriteProducts('pub1', ['p1']), { wrapper });

    await waitFor(() => expect(result.current.error).toBe('boom'));
    expect(result.current.loading).toBe(false);
    expect(result.current.products).toEqual([]);
  });

  it('refresh повторяет запрос', async () => {
    loadProductsByIds.mockResolvedValue([card('p1')]);

    const { result } = renderHook(() => useStorefrontFavoriteProducts('pub1', ['p1']), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(loadProductsByIds).toHaveBeenCalledTimes(1);

    act(() => result.current.refresh());
    await waitFor(() => expect(loadProductsByIds).toHaveBeenCalledTimes(2));
  });
});
